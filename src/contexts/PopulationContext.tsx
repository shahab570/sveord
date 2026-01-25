import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApiKeys } from '@/hooks/useApiKeys';
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
    lastBatchInfo: string | null;
    error: string | null;
    startPopulation: () => Promise<void>;
    pausePopulation: () => void;
    resumePopulation: () => void;
    fetchStatus: () => Promise<void>;
}

const PopulationContext = createContext<PopulationContextType | undefined>(undefined);

export function PopulationProvider({ children }: { children: React.ReactNode }) {
    const { apiKeys } = useApiKeys();
    const [status, setStatus] = useState<PopulationStatus | null>(null);
    const [isPopulating, setIsPopulating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [overwrite, setOverwrite] = useState(false);
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

    const runBatch = async (batchSize: number = 50): Promise<boolean> => {
        if (!hasApiKey || !apiKeys.geminiApiKey) {
            setError('No API key configured');
            return false;
        }

        try {
            let query = supabase.from('words').select('id, swedish_word');
            if (!overwrite) {
                query = query.is('word_data', null);
            }

            const { data: words, error: fetchError } = await query
                .order('id', { ascending: true })
                .limit(batchSize);

            if (fetchError) throw fetchError;
            if (!words || words.length === 0) return false;

            for (let i = 0; i < words.length; i++) {
                if (pauseRef.current) return false;

                const word = words[i];
                setLastBatchInfo(`Generating meaning for "${word.swedish_word}" (${i + 1}/${words.length})...`);

                const result = await generateWordMeaning(word.swedish_word, apiKeys.geminiApiKey);

                if ('meanings' in result) {
                    await supabase
                        .from('words')
                        .update({
                            word_data: {
                                word_type: result.partOfSpeech || '',
                                gender: result.gender || '',
                                meanings: result.meanings || [],
                                examples: result.examples || [],
                                synonyms: result.synonyms || [],
                                antonyms: result.antonyms || [],
                                populated_at: new Date().toISOString(),
                            },
                        })
                        .eq('id', word.id);
                }

                if (!overwrite) {
                    setStatus(prev => prev ? {
                        ...prev,
                        completed: prev.completed + 1,
                        remaining: prev.remaining - 1
                    } : null);
                }
            }

            return words.length === batchSize;
        } catch (err: any) {
            setError(err.message || 'Failed to process batch');
            return false;
        }
    };

    const startPopulation = async () => {
        setIsPopulating(true);
        setIsPaused(false);
        pauseRef.current = false;
        setError(null);
        toast.success('Starting background generation...');

        const runNextBatch = async () => {
            if (pauseRef.current) {
                setIsPopulating(false);
                return;
            }

            const shouldContinue = await runBatch(50);

            if (shouldContinue && !pauseRef.current) {
                setTimeout(runNextBatch, 200);
            } else if (!pauseRef.current) {
                setIsPopulating(false);
                await fetchStatus();
                toast.success('🎉 Generation complete!');
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
        setIsPaused(false);
        startPopulation();
    };

    return (
        <PopulationContext.Provider value={{
            status, isPopulating, isPaused, overwrite, setOverwrite,
            lastBatchInfo, error, startPopulation, pausePopulation,
            resumePopulation, fetchStatus
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
