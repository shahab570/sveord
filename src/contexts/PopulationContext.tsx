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
    startPopulation: () => Promise<void>;
    pausePopulation: () => void;
    resumePopulation: () => void;
    fetchStatus: () => Promise<void>;
    regenerateSingleWord: (wordId: number, swedishWord: string) => Promise<void>;
    enhanceUserNote: (text: string) => Promise<string>;
}

const PopulationContext = createContext<PopulationContextType | undefined>(undefined);

export function PopulationProvider({ children }: { children: React.ReactNode }) {
    const { apiKeys } = useApiKeys();
    const [status, setStatus] = useState<PopulationStatus | null>(null);
    const [isPopulating, setIsPopulating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [overwrite, setOverwrite] = useState(false);
    const [rangeStart, setRangeStart] = useState<number>(1);
    const [rangeEnd, setRangeEnd] = useState<number>(15000);
    const [lastBatchInfo, setLastBatchInfo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pauseRef = useRef(false);

    // Import this dynamically or assume it's imported at top
    // create a wrapper function
    const enhanceUserNote = async (text: string): Promise<string> => {
        // Fix: Don't fail if Gemini key is missing but DeepSeek key exists
        if (!apiKeys.geminiApiKey && !apiKeys.deepseekApiKey) {
            toast.error("No API key configured");
            throw new Error("No API key");
        }

        // Try DeepSeek first if available
        if (apiKeys.deepseekApiKey) {
            try {
                const { enhanceTextDeepSeek } = await import('@/services/deepseekApi');
                const result = await enhanceTextDeepSeek(text, apiKeys.deepseekApiKey);

                if ('error' in result) {
                    console.warn("DeepSeek failed, falling back to Gemini:", result.error);
                    // Fall through to Gemini if available
                } else {
                    return result.text;
                }
            } catch (e) {
                console.warn("DeepSeek error, falling back to Gemini");
            }
        }

        // Fallback to Gemini
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

            // Fetch Max ID to imply range end
            const { data: maxIdData } = await supabase
                .from('words')
                .select('id')
                .order('id', { ascending: false })
                .limit(1)
                .single();

            if (maxIdData?.id && !isPopulating) {
                // Only verify/update rangeEnd if not currently running to avoid weird UI jumps
                setRangeEnd(prev => Math.max(prev, maxIdData.id));
            }

            const total = totalCount || 0;
            const completed = completedCount || 0;

            setStatus({
                total,
                completed,
                remaining: total - completed,
            });
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch status:', err);
        }
    };

    const runBatch = async (batchSize: number = 50, startFromId: number): Promise<{ lastId: number, count: number }> => {
        if (!hasApiKey || !apiKeys.geminiApiKey) {
            setError('No API key configured');
            return { lastId: startFromId, count: 0 };
        }

        try {
            let query = supabase.from('words').select('id, swedish_word');

            // Range filtering starting from the cursor
            query = query.gte('id', startFromId).lte('id', rangeEnd);

            if (!overwrite) {
                query = query.is('word_data', null);
            }

            const { data: words, error: fetchError } = await query
                .order('id', { ascending: true })
                .limit(batchSize);

            if (fetchError) throw fetchError;
            if (!words || words.length === 0) return { lastId: startFromId, count: 0 };

            setLastBatchInfo(`Generating batch: ${words[0].swedish_word} ... ${words[words.length - 1].swedish_word} (${words.length} words)`);

            // Extract words for API
            const swedishWords = words.map(w => w.swedish_word);

            // ONE API Call for all words
            const resultsMap = await generateMeaningsTrueBatch(swedishWords, apiKeys.geminiApiKey);

            const updatePromises: any[] = [];
            let successCount = 0;

            for (const word of words) {
                const result = resultsMap.get(word.swedish_word) || resultsMap.get(word.swedish_word.toLowerCase());

                if (result) {
                    const wordData = {
                        word_type: result.partOfSpeech || '',
                        gender: result.gender || '',
                        meanings: result.meanings || [],
                        examples: result.examples || [],
                        synonyms: result.synonyms || [],
                        antonyms: result.antonyms || [],
                        populated_at: new Date().toISOString(),
                    };

                    // Queue updates
                    updatePromises.push(
                        supabase.from('words').update({ word_data: wordData }).eq('id', word.id)
                    );
                    updatePromises.push(
                        db.words.update(word.swedish_word, { word_data: wordData })
                    );
                    successCount++;
                } else {
                    console.warn(`Batch generation missed word: ${word.swedish_word}`);
                }
            }

            // Fire-and-forget DB updates (don't await)
            Promise.all(updatePromises).then(() => {
                if (!overwrite) {
                    // Update status counts loosely (might be slightly out of sync with real-time but much faster)
                    setStatus(prev => prev ? {
                        ...prev,
                        completed: Math.min(prev.completed + successCount, prev.total),
                        remaining: Math.max(prev.remaining - successCount, 0)
                    } : null);
                }
            }).catch(e => console.error("Background DB save failed:", e));

            // Return immediately to start next batch
            const lastProcessedId = words.length > 0 ? words[words.length - 1].id : startFromId;
            return { lastId: lastProcessedId + 1, count: words.length };

        } catch (err: any) {
            setError(err.message || 'Failed to process batch');
            // If it fails, we return the same ID so it *might* retry or user can restart
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
            const result = await generateWordMeaning(swedishWord, apiKeys.geminiApiKey);

            if ('meanings' in result) {
                const wordData = {
                    word_type: result.partOfSpeech || '',
                    gender: result.gender || '',
                    meanings: result.meanings || [],
                    examples: result.examples || [],
                    synonyms: result.synonyms || [],
                    antonyms: result.antonyms || [],
                    populated_at: new Date().toISOString(),
                };

                const { error: updateError } = await supabase
                    .from('words')
                    .update({
                        word_data: wordData,
                    })
                    .eq('id', wordId);

                if (updateError) throw updateError;

                // Update local DB for instant feedback
                await db.words.update(swedishWord, { word_data: wordData });

                toast.success(`Updated "${swedishWord}"`);
                await fetchStatus();
            } else {
                toast.error(`Failed: ${result.error}`);
            }
        } catch (err: any) {
            toast.error(err.message || 'Regeneration failed');
        }
    };

    const startPopulation = async () => {
        setIsPopulating(true);
        setIsPaused(false);
        pauseRef.current = false;
        setError(null);
        toast.success(`Starting generation for IDs ${rangeStart} to ${rangeEnd}...`);

        let currentCursor = rangeStart;

        const runNextBatch = async () => {
            if (pauseRef.current) {
                setIsPopulating(false);
                return;
            }

            const BATCH_SIZE = 20;
            const { lastId, count } = await runBatch(BATCH_SIZE, currentCursor);
            currentCursor = lastId;

            const hasMore = count === BATCH_SIZE && currentCursor <= rangeEnd;

            if (hasMore && !pauseRef.current) {
                setTimeout(runNextBatch, 200);
            } else if (!pauseRef.current) {
                setIsPopulating(false);
                await fetchStatus();
                toast.success(`🎉 Segment ${rangeStart}-${rangeEnd} complete!`);
            }
        };

        runNextBatch();
    };

    const pausePopulation = () => {
        pauseRef.current = true;
        setIsPaused(true);
        setIsPopulating(false);
        toast.info('Generation paused');
    };

    const resumePopulation = () => {
        // Resume should probably keep the cursor, but since we don't store it in state,
        // it resets to rangeStart. However, if overwrite is false, it naturally skips.
        // If overwrite is true, the user might want it to continue from where it stopped.
        // For now, we'll let it start from rangeStart or the user can manually update rangeStart.
        setIsPaused(false);
        startPopulation();
    };

    return (
        <PopulationContext.Provider value={{
            status, isPopulating, isPaused, overwrite, setOverwrite,
            rangeStart, setRangeStart, rangeEnd, setRangeEnd,
            lastBatchInfo, error, startPopulation, pausePopulation,
            resumePopulation, fetchStatus, regenerateSingleWord,
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
