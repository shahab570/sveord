import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApiKeys } from '@/hooks/useApiKeys';
import { db } from '@/services/db';
import { generateWordMeaning } from '@/services/geminiApi';
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
    startBackgroundPopulation: () => Promise<void>;
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

            let maxId = startFromId;

            for (let i = 0; i < words.length; i++) {
                if (pauseRef.current) return { lastId: maxId, count: i };

                const word = words[i];
                maxId = word.id;
                setLastBatchInfo(`Generating meaning for "${word.swedish_word}" (${i + 1}/${words.length})...`);

                const result = await generateWordMeaning(word.swedish_word, apiKeys.geminiApiKey);

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

                    await supabase
                        .from('words')
                        .update({
                            word_data: wordData,
                        })
                        .eq('id', word.id);

                    // Update local DB for instant feedback
                    await db.words.update(word.swedish_word, { word_data: wordData });
                }

                if (!overwrite) {
                    setStatus(prev => prev ? {
                        ...prev,
                        completed: prev.completed + 1,
                        remaining: prev.remaining - 1
                    } : null);
                }
            }

            // Return the next ID to start from (maxId + 1)
            return { lastId: maxId + 1, count: words.length };
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

            const { lastId, count } = await runBatch(50, currentCursor);
            currentCursor = lastId;

            const hasMore = count === 50 && currentCursor <= rangeEnd;

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

    const startBackgroundPopulation = async () => {
        if (!hasApiKey || !apiKeys.geminiApiKey) {
            toast.error('No API key configured');
            return;
        }

        toast.loading("Starting cloud job...");
        try {
            const { error } = await supabase.functions.invoke('populate-meanings', {
                body: {
                    action: 'populate_background',
                    apiKey: apiKeys.geminiApiKey,
                    batchSize: 5,
                    startId: rangeStart,
                    rangeEnd: rangeEnd
                }
            });

            if (error) throw error;

            toast.dismiss();
            toast.success("Background job started! You can close this tab/PC now. Check back later.");
        } catch (err: any) {
            toast.dismiss();
            console.error("Cloud Job Error Full:", err);

            let errorMessage = err.message || "Unknown error";
            if (err.context && err.context.headers) {
                errorMessage += ` (Status: ${err.context.status})`;
            }
            if (typeof err === 'object' && err !== null) {
                errorMessage += " - Check console for full details";
            }

            toast.error("Failed to start cloud job: " + errorMessage);
        }
    };

    return (
        <PopulationContext.Provider value={{
            status, isPopulating, isPaused, overwrite, setOverwrite,
            rangeStart, setRangeStart, rangeEnd, setRangeEnd,
            lastBatchInfo, error, startPopulation, pausePopulation,
            resumePopulation, fetchStatus, regenerateSingleWord, startBackgroundPopulation
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
