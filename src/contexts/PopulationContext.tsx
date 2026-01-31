import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApiKeys } from '@/hooks/useApiKeys';
import { db } from '@/services/db';
import { generateWordMeaning, generateMeaningsTrueBatch } from '@/services/geminiApi';
import { toast } from 'sonner';

interface PopulationStatus {
    completed: number;
    total: number;
    remaining: number;
    explanationCount: number;
    grammarCount: number;
}

interface PopulationContextType {
    status: PopulationStatus | null;
    isPopulating: boolean;
    isPaused: boolean;
    overwrite: boolean;
    setOverwrite: (val: boolean) => void;
    rangeStart: number;
    setRangeStart: (val: number) => void;
    rangeEnd: number;
    setRangeEnd: (val: number) => void;
    lastBatchInfo: string | null;
    error: string | null;
    processedCount: number;
    sessionTotal: number;
    startPopulation: (mode: 'missing_data' | 'missing_stories' | 'missing_grammar' | 'overwrite') => Promise<void>;
    pausePopulation: () => void;
    resumePopulation: () => void;
    fetchStatus: () => Promise<void>;
    cleanGrammar: () => Promise<void>;
    resetGrammar: () => Promise<void>;
    regenerateSingleWord: (wordId: number, swedishWord: string) => Promise<void>;
    regenerateFieldWithInstruction: (wordId: number, field: 'explanation' | 'meanings', instruction: string, swedishWordFallback?: string) => Promise<void>;
    enhanceUserNote: (text: string) => Promise<string>;
}

const PopulationContext = createContext<PopulationContextType | undefined>(undefined);

export function PopulationProvider({ children }: { children: React.ReactNode }) {
    const { apiKeys } = useApiKeys();
    const [status, setStatus] = useState<PopulationStatus | null>(null);
    const [isPopulating, setIsPopulating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentMode, setCurrentMode] = useState<'missing_data' | 'missing_stories' | 'missing_grammar' | 'overwrite'>('missing_data');
    const [rangeStart, setRangeStart] = useState<number>(1);
    const [rangeEnd, setRangeEnd] = useState<number>(15000);
    const [lastBatchInfo, setLastBatchInfo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processedCount, setProcessedCount] = useState(0);
    const [sessionTotal, setSessionTotal] = useState(0);
    const pauseRef = useRef(false);

    const enhanceUserNote = async (text: string): Promise<string> => {
        if (!apiKeys.geminiApiKey && !apiKeys.deepseekApiKey) {
            toast.error("No API key configured");
            throw new Error("No API key");
        }

        if (apiKeys.deepseekApiKey) {
            try {
                const { enhanceTextDeepSeek } = await import('@/services/deepseekApi');
                const result = await enhanceTextDeepSeek(text, apiKeys.deepseekApiKey);

                if (!('error' in result)) {
                    return result.text;
                }
            } catch (e) {
                console.warn("DeepSeek error, falling back to Gemini");
            }
        }

        if (!apiKeys.geminiApiKey) {
            toast.error("DeepSeek failed and no Gemini key available");
            throw new Error("No meaningful fallback");
        }

        const { enhanceText } = await import('@/services/geminiApi');
        const result = await enhanceText(text, apiKeys.geminiApiKey);

        if ('error' in result) {
            toast.error(result.details || "Failed to enhance text");
            throw new Error(result.error);
        }
        return result.text;
    };

    const hasApiKey = !!apiKeys.geminiApiKey;

    useEffect(() => {
        if (hasApiKey) {
            fetchStatus();
        }
    }, [hasApiKey]);

    const fetchStatus = async () => {
        try {
            const { count: totalCount } = await supabase
                .from('words')
                .select('*', { count: 'exact', head: true });

            const { count: completedCount } = await supabase
                .from('words')
                .select('*', { count: 'exact', head: true })
                .not('word_data', 'is', null);

            const { count: explanationCount } = await supabase
                .from('words')
                .select('*', { count: 'exact', head: true })
                .not('word_data->>inflectionExplanation', 'is', null)
                .not('word_data->>inflectionExplanation', 'eq', '');

            const { count: grammarCount } = await supabase
                .from('words')
                .select('*', { count: 'exact', head: true })
                .not('word_data->>grammaticalForms', 'is', null);

            const { data: maxIdData } = await supabase
                .from('words')
                .select('id')
                .order('id', { ascending: false })
                .limit(1)
                .single();

            if (maxIdData?.id && !isPopulating) {
                setRangeEnd(prev => Math.max(prev, maxIdData.id));
            }

            setStatus({
                total: totalCount || 0,
                completed: completedCount || 0,
                remaining: (totalCount || 0) - (completedCount || 0),
                explanationCount: explanationCount || 0,
                grammarCount: grammarCount || 0,
            });
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch status:', err);
        }
    };

    const runBatch = async (startFromId: number): Promise<{ lastId: number, count: number }> => {
        if (!hasApiKey || !apiKeys.geminiApiKey) {
            setError('No API key configured');
            return { lastId: startFromId, count: 0 };
        }

        const batchSize = (currentMode === 'missing_stories' || currentMode === 'missing_grammar') ? 100 : 50;
        try {
            let query = supabase.from('words').select('id, swedish_word, word_data');
            query = query.gte('id', startFromId).lte('id', rangeEnd);

            if (currentMode === 'missing_data') {
                query = query.is('word_data', null);
            } else if (currentMode === 'missing_stories') {
                // Find words that have data but NO inflectionExplanation (null, missing, or empty)
                query = query.or('word_data.is.null,word_data->>inflectionExplanation.is.null,word_data->>inflectionExplanation.eq.""');
            } else if (currentMode === 'missing_grammar') {
                // Find words that have data but NO grammaticalForms (stored as array in JSON)
                query = query.or('word_data.is.null,word_data->>grammaticalForms.is.null');
            }
            // else overwrite mode doesn't need extra filter

            const { data: words, error: fetchError } = await query
                .order('id', { ascending: true })
                .limit(batchSize);

            if (fetchError) throw fetchError;
            if (!words || words.length === 0) return { lastId: startFromId, count: 0 };

            const rangeStr = `${words[0].swedish_word} - ${words[words.length - 1].swedish_word}`;
            setLastBatchInfo(`[${rangeStr}] Processing ${words.length} words...`);

            const swedishWords = words.map(w => w.swedish_word);
            const onlyExplanations = currentMode === 'missing_stories';
            const onlyGrammar = currentMode === 'missing_grammar';
            const resultsMap = await generateMeaningsTrueBatch(
                swedishWords,
                apiKeys.geminiApiKey,
                undefined,
                undefined,
                undefined,
                onlyExplanations,
                onlyGrammar
            );

            if (!resultsMap || resultsMap.size === 0) {
                console.warn("Batch generated no results, skipping ahead to avoid getting stuck.");
                setProcessedCount(prev => prev + words.length);
                const lastProcessedId = words[words.length - 1].id;
                return { lastId: lastProcessedId + 1, count: words.length };
            }

            setLastBatchInfo(`[${rangeStr}] Saving ${resultsMap.size} results...`);

            const supabaseUpdates: any[] = [];
            const dexieUpdates: any[] = [];
            let successCount = 0;

            for (const word of words) {
                const result = resultsMap.get(word.swedish_word) || resultsMap.get(word.swedish_word.toLowerCase());

                if (result) {
                    const existingData = word.word_data as any;
                    const wordData = {
                        word_type: result.partOfSpeech || (existingData?.word_type || ''),
                        gender: result.gender || (existingData?.gender || ''),
                        inflectionExplanation: result.inflectionExplanation || (existingData?.inflectionExplanation || null),
                        meanings: (existingData && existingData.meanings && existingData.meanings.length > 0) ? existingData.meanings : (result.meanings || []),
                        examples: (existingData && existingData.examples && existingData.examples.length > 0) ? existingData.examples : (result.examples || []),
                        synonyms: (existingData && existingData.synonyms && existingData.synonyms.length > 0) ? existingData.synonyms : (result.synonyms || []),
                        antonyms: (existingData && existingData.antonyms && existingData.antonyms.length > 0) ? existingData.antonyms : (result.antonyms || []),
                        grammaticalForms: result.grammaticalForms || (existingData?.grammaticalForms || null),
                        populated_at: new Date().toISOString(),
                    };

                    supabaseUpdates.push({ id: word.id, swedish_word: word.swedish_word, word_data: wordData });
                    dexieUpdates.push({ ...word, word_data: wordData });

                    if (result.grammaticalForms && result.grammaticalForms.length > 0) {
                        successCount++;
                    }
                }
            }

            if (supabaseUpdates.length > 0) {
                const { error: upError } = await supabase.from('words').upsert(supabaseUpdates);
                if (upError) console.error("Supabase bulk upsert failed:", upError);
                await db.words.bulkPut(dexieUpdates);
            }

            setLastBatchInfo(`[${rangeStr}] Complete! Saved ${successCount} forms.`);
            setProcessedCount(prev => prev + words.length);
            const lastProcessedId = words.length > 0 ? words[words.length - 1].id : startFromId;
            return { lastId: lastProcessedId + 1, count: words.length };

        } catch (err: any) {
            setError(err.message || 'Failed to process batch');
            return { lastId: startFromId, count: 0 };
        }
    };

    const regenerateSingleWord = async (wordId: number, swedishWord: string) => {
        if (!hasApiKey || !apiKeys.geminiApiKey) {
            toast.error('No API key configured');
            return;
        }

        try {
            toast.info(`Regenerating "${swedishWord}"...`);
            const { data: currentWord } = await supabase.from('words').select('word_data').eq('id', wordId).single();
            const result = await generateWordMeaning(swedishWord, apiKeys.geminiApiKey);

            if ('meanings' in result) {
                const existingData = currentWord?.word_data as any;
                const wordData = {
                    word_type: result.partOfSpeech || (existingData?.word_type || ''),
                    gender: result.gender || (existingData?.gender || ''),
                    inflectionExplanation: result.inflectionExplanation || null,
                    meanings: (existingData && existingData.meanings && existingData.meanings.length > 0) ? existingData.meanings : (result.meanings || []),
                    examples: (existingData && existingData.examples && existingData.examples.length > 0) ? existingData.examples : (result.examples || []),
                    synonyms: (existingData && existingData.synonyms && existingData.synonyms.length > 0) ? existingData.synonyms : (result.synonyms || []),
                    antonyms: (existingData && existingData.antonyms && existingData.antonyms.length > 0) ? existingData.antonyms : (result.antonyms || []),
                    grammaticalForms: result.grammaticalForms || (existingData?.grammaticalForms || null),
                    populated_at: new Date().toISOString(),
                };

                await supabase.from('words').update({ word_data: wordData }).eq('id', wordId);
                await db.words.update(swedishWord, { word_data: wordData });
                toast.success(`Updated "${swedishWord}"`);
                await fetchStatus();
            } else {
                toast.error(`Failed: ${result.error}${result.details ? ` (${result.details})` : ''}`);
            }
        } catch (err: any) {
            toast.error(err.message || 'Regeneration failed');
        }
    };

    const startPopulation = async (mode: 'missing_data' | 'missing_stories' | 'missing_grammar' | 'overwrite' = 'missing_data') => {
        if (isPopulating) return;
        setCurrentMode(mode);
        setIsPopulating(true);
        setIsPaused(false);
        pauseRef.current = false;
        setError(null);
        setProcessedCount(0);
        setSessionTotal(rangeEnd - rangeStart + 1);

        let currentCursor = rangeStart;
        const runNextBatch = async () => {
            if (pauseRef.current) {
                setIsPopulating(false);
                return;
            }

            const { lastId, count } = await runBatch(currentCursor);
            currentCursor = lastId;

            if (count > 0 && currentCursor <= rangeEnd && !pauseRef.current) {
                // Refresh status every batch to show progress in real-time
                await fetchStatus();
                setTimeout(runNextBatch, 200); // Faster inter-batch delay
            } else {
                setIsPopulating(false);
                if (count === 0 && !pauseRef.current) {
                    await fetchStatus();
                    toast.success("All words in range processed!");
                }
            }
        };

        runNextBatch();
    };

    const pausePopulation = () => {
        pauseRef.current = true;
        setIsPaused(true);
        setIsPopulating(false);
    };

    const resumePopulation = () => {
        setIsPaused(false);
        startPopulation(currentMode);
    };

    const regenerateFieldWithInstruction = async (wordId: number, field: 'explanation' | 'meanings', instruction: string, swedishWordFallback?: string) => {
        if (!hasApiKey || !apiKeys.geminiApiKey) {
            toast.error("No API key configured");
            return;
        }

        console.log(`[PopulationContext] Regenerating ${field} for wordId: ${wordId}, fallback: ${swedishWordFallback}`);

        try {
            let currentWord = await db.words.where("id").equals(wordId).first();

            if (!currentWord && swedishWordFallback) {
                console.log(`[PopulationContext] Word not found by ID ${wordId}, trying swedish_word fallback: ${swedishWordFallback}`);
                currentWord = await db.words.get(swedishWordFallback);
            }

            if (!currentWord) {
                // Try fetching from supabase if not in local DB
                const query = supabase.from('words').select('*');
                if (wordId > 0) query.eq('id', wordId);
                else if (swedishWordFallback) query.eq('swedish_word', swedishWordFallback);

                const { data } = await query.maybeSingle();
                if (data) {
                    await db.words.put(data as any);
                    currentWord = data as any;
                }
            }

            if (!currentWord) {
                toast.error("Word not found in database");
                return;
            }

            const result = await generateWordMeaning(currentWord.swedish_word, apiKeys.geminiApiKey, undefined, undefined, instruction);

            if ('error' in result) {
                console.error(`[PopulationContext] AI Generation Error for "${currentWord.swedish_word}":`, result);
                toast.error(`${result.error}${result.details ? `: ${result.details}` : ''}`);
                return;
            }

            console.log(`[PopulationContext] AI result for "${currentWord.swedish_word}":`, result);

            const updatedData = { ...currentWord.word_data };
            if (field === 'explanation') {
                updatedData.inflectionExplanation = result.inflectionExplanation || updatedData.inflectionExplanation;
            } else {
                // For meanings regenerate, we prioritize the new meanings
                updatedData.meanings = (result.meanings && result.meanings.length > 0) ? result.meanings : updatedData.meanings;

                // For other fields, only update if AI provided something new and non-empty
                if (result.examples && result.examples.length > 0) updatedData.examples = result.examples;
                if (result.partOfSpeech) updatedData.word_type = result.partOfSpeech;
                if (result.gender) updatedData.gender = result.gender;
                if (result.synonyms && result.synonyms.length > 0) updatedData.synonyms = result.synonyms;
                if (result.antonyms && result.antonyms.length > 0) updatedData.antonyms = result.antonyms;
                if (result.grammaticalForms && result.grammaticalForms.length > 0) updatedData.grammaticalForms = result.grammaticalForms;
            }
            updatedData.populated_at = new Date().toISOString();

            await supabase.from('words').update({ word_data: updatedData as any }).eq('id', wordId);
            await db.words.update(currentWord.swedish_word, { word_data: updatedData as any });
            toast.success("AI Content updated!");
            await fetchStatus();
        } catch (err: any) {
            toast.error(err.message || "Update failed");
        }
    };

    const cleanGrammar = async () => {
        setIsPopulating(true);
        setLastBatchInfo("Cleaning up hallucinated grammar forms...");
        try {
            let allWords: any[] = [];
            let lastId = 0;
            let hasMore = true;

            // Page through ALL words to overcome the 1000-limit
            while (hasMore) {
                const { data, error: fetchError } = await supabase
                    .from('words')
                    .select('id, swedish_word, word_data')
                    .not('word_data', 'is', null)
                    .gt('id', lastId)
                    .order('id', { ascending: true })
                    .limit(1000);

                if (fetchError) throw fetchError;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allWords = [...allWords, ...data];
                    lastId = data[data.length - 1].id;
                    setLastBatchInfo(`Scanning for hallucinations... ${allWords.length}`);
                }
            }

            const nonInflectableTypes = ['adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'particle'];
            const supabaseUpdates: any[] = [];
            const dexieUpdates: any[] = [];
            let count = 0;

            for (const word of allWords) {
                const data = word.word_data as any;
                const type = (data?.word_type || '').toLowerCase();

                if (nonInflectableTypes.includes(type) && data.grammaticalForms && data.grammaticalForms.length > 0) {
                    const updatedData = { ...data, grammaticalForms: [] };
                    supabaseUpdates.push({ id: word.id, swedish_word: word.swedish_word, word_data: updatedData });
                    dexieUpdates.push({ ...word, word_data: updatedData });
                    count++;
                }
            }

            // Process updates in chunks of 500
            const CHUNK_SIZE = 500;
            for (let i = 0; i < supabaseUpdates.length; i += CHUNK_SIZE) {
                const supChunk = supabaseUpdates.slice(i, i + CHUNK_SIZE);
                const dexChunk = dexieUpdates.slice(i, i + CHUNK_SIZE);

                setLastBatchInfo(`Cleaning... ${i + supChunk.length} / ${supabaseUpdates.length}`);
                await supabase.from('words').upsert(supChunk);
                await db.words.bulkPut(dexChunk);
            }

            toast.success(`Cleaned up grammar for ${count} non-inflectable words.`);
            await fetchStatus();
        } catch (err: any) {
            toast.error(err.message || "Cleanup failed");
        } finally {
            setIsPopulating(false);
            setLastBatchInfo(null);
        }
    };

    const resetGrammar = async () => {
        if (!confirm("This will wipe all existing 'Grammar Forms' progress so you can start fresh with the new SAOL rules. Are you sure?")) return;

        setIsPopulating(true);
        setLastBatchInfo("Resetting grammar progress...");
        try {
            let allWords: any[] = [];
            let lastId = 0;
            let hasMore = true;

            // Page through ALL words to overcome the 1000-limit
            while (hasMore) {
                const { data, error: fetchError } = await supabase
                    .from('words')
                    .select('id, swedish_word, word_data')
                    .not('word_data', 'is', null)
                    .gt('id', lastId)
                    .order('id', { ascending: true })
                    .limit(1000);

                if (fetchError) throw fetchError;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allWords = [...allWords, ...data];
                    lastId = data[data.length - 1].id;
                    setLastBatchInfo(`Fetching words to reset... ${allWords.length}`);
                }
            }

            if (allWords.length === 0) return;

            // Process in chunks to avoid overwhelming the network
            const CHUNK_SIZE = 500;
            for (let i = 0; i < allWords.length; i += CHUNK_SIZE) {
                const chunk = allWords.slice(i, i + CHUNK_SIZE);
                const supabaseUpdates: any[] = [];
                const dexieUpdates: any[] = [];

                for (const word of chunk) {
                    const data = word.word_data as any;
                    // Fully remove the key to ensure the counter hits 0
                    const updatedData = { ...data };
                    delete updatedData.grammaticalForms;
                    supabaseUpdates.push({ id: word.id, swedish_word: word.swedish_word, word_data: updatedData });
                    dexieUpdates.push({ ...word, word_data: updatedData });
                }

                if (supabaseUpdates.length > 0) {
                    setLastBatchInfo(`Resetting... ${i + chunk.length} / ${allWords.length}`);
                    await supabase.from('words').upsert(supabaseUpdates);
                    await db.words.bulkPut(dexieUpdates);
                }
            }

            setRangeStart(1); // Reset start point to the beginning
            toast.success(`Grammar progress reset for ${allWords.length} words.`);
            await fetchStatus();
        } catch (err: any) {
            toast.error(err.message || "Reset failed");
        } finally {
            setIsPopulating(false);
            setLastBatchInfo(null);
        }
    };

    return (
        <PopulationContext.Provider value={{
            status, isPopulating, isPaused, overwrite: currentMode === 'overwrite', setOverwrite: (val) => setCurrentMode(val ? 'overwrite' : 'missing_data'),
            rangeStart, setRangeStart, rangeEnd, setRangeEnd,
            lastBatchInfo, error, processedCount, sessionTotal,
            startPopulation, pausePopulation, resumePopulation,
            fetchStatus, cleanGrammar, resetGrammar, regenerateSingleWord, regenerateFieldWithInstruction,
            enhanceUserNote
        }}>
            {children}
        </PopulationContext.Provider>
    );
}

export function usePopulation() {
    const context = useContext(PopulationContext);
    if (context === undefined) {
        throw new Error('usePopulation must be used within a PopulationProvider');
    }
    return context;
}
