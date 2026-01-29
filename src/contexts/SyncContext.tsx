import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { db, LocalWord, LocalUserProgress } from '@/services/db';
import { toast } from 'sonner';

interface SyncContextType {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    syncAll: () => Promise<void>;
    syncProgress: () => Promise<void>;
    syncMissingStories: () => Promise<void>;
    forceRefresh: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    const syncAll = useCallback(async () => {
        if (!user || isSyncing) return;
        setIsSyncing(true);
        try {
            console.log('Starting full sync...');
            let allWords: any[] = [];
            let from = 0;
            const PAGE_SIZE = 500;
            let hasMore = true;

            // 1. Sync Words (Paginated)
            while (hasMore) {
                const { data: words, error: wordsError } = await supabase
                    .from('words')
                    .select('*')
                    .order('id', { ascending: true }) // Explicit ordering
                    .range(from, from + PAGE_SIZE - 1);

                if (wordsError) throw wordsError;

                if (words && words.length > 0) {
                    allWords = [...allWords, ...words];
                    // Bulk put current batch immediately to save memory and show progress if needed
                    await db.words.bulkPut(words.map(w => ({
                        id: w.id, // CRITICAL FIX: Save the Supabase ID locally
                        swedish_word: w.swedish_word,
                        kelly_level: w.kelly_level || undefined,
                        kelly_source_id: w.kelly_source_id || undefined,
                        frequency_rank: w.frequency_rank || undefined,
                        sidor_rank: w.sidor_rank || undefined,
                        word_data: w.word_data as any,
                        last_synced_at: new Date().toISOString()
                    })));

                    if (words.length < PAGE_SIZE) {
                        hasMore = false;
                    } else {
                        from += PAGE_SIZE;
                    }
                } else {
                    hasMore = false;
                }
            }

            // 2. Sync Progress
            await syncProgress();

            setLastSyncTime(new Date());
            console.log('Full sync completed');
        } catch (error: any) {
            console.error('Sync failed:', error);
            if (error.name === 'BulkError') {
                toast.error(`Sync failed for some records: ${error.message}. Try Force Refresh.`);
            } else {
                toast.error(`Failed to sync data: ${error.message}`);
            }
        } finally {
            setIsSyncing(false);
        }
    }, [user, isSyncing]);

    const forceRefresh = useCallback(async () => {
        if (!user || isSyncing) return;
        const confirm = window.confirm("This will clear your local cache and re-download everything. Continue?");
        if (!confirm) return;

        setIsSyncing(true);
        try {
            console.log('Clearing local database...');
            await db.words.clear();
            await db.progress.clear();
            setIsSyncing(false); // Enable syncAll to run
            await syncAll();
        } catch (error: any) {
            console.error('Force refresh failed:', error);
            toast.error('Failed to clear local database');
        } finally {
            setIsSyncing(false);
        }
    }, [user, isSyncing, syncAll]);

    const syncProgress = useCallback(async () => {
        if (!user) return;
        try {
            let from = 0;
            const PAGE_SIZE = 1000;
            let hasMore = true;

            while (hasMore) {
                // Use !inner to ensure we only get progress where the word still exists
                const { data: progress, error: progressError } = await supabase
                    .from('user_progress')
                    .select('*, words(swedish_word)') // Remove !inner which was hiding the property
                    .eq('user_id', user.id)
                    .range(from, from + PAGE_SIZE - 1);

                if (progressError) throw progressError;

                if (progress && progress.length > 0) {
                    const progressRecords = progress
                        .map(p => {
                            // Handle both object and array response (Supabase flexibility)
                            const wordData = Array.isArray(p.words) ? p.words[0] : p.words;
                            return {
                                word_swedish: wordData?.swedish_word,
                                is_learned: p.is_learned ? 1 : 0,
                                user_meaning: p.user_meaning || undefined,
                                custom_spelling: p.custom_spelling || undefined,
                                learned_date: p.learned_date || undefined,
                                last_synced_at: new Date().toISOString()
                            };
                        })
                        .filter(p => !!p.word_swedish); // Filter out any orphans

                    if (progressRecords.length > 0) {
                        await db.progress.bulkPut(progressRecords as any);
                    }

                    if (progress.length < PAGE_SIZE) {
                        hasMore = false;
                        toast.success(`Successfully synced ${from + progress.length} progress records.`);
                    } else {
                        from += PAGE_SIZE;
                    }
                } else {
                    hasMore = false;
                }
            }
        } catch (error: any) {
            console.error('Progress sync failed:', error);
            if (error.name === 'BulkError') {
                toast.error(`Progress sync failed for some records: ${error.message}. Try Force Refresh.`);
            } else {
                toast.error(`Failed to sync progress: ${error.message}`);
            }
            throw error;
        }
    }, [user]);

    const syncMissingStories = useCallback(async () => {
        if (!user || isSyncing) return;
        setIsSyncing(true);
        try {
            const localWordsMissingStories = await db.words
                .filter(w => !w.word_data?.inflectionExplanation)
                .toArray();

            if (localWordsMissingStories.length === 0) {
                toast.info("All local words already have stories.");
                return;
            }

            const CHUNK_SIZE = 500;
            let updatedCount = 0;

            for (let i = 0; i < localWordsMissingStories.length; i += CHUNK_SIZE) {
                const chunk = localWordsMissingStories.slice(i, i + CHUNK_SIZE);
                const swedishWords = chunk.map(w => w.swedish_word);

                const { data: cloudWords, error } = await supabase
                    .from('words')
                    .select('id, swedish_word, word_data')
                    .in('swedish_word', swedishWords)
                    .not('word_data->>inflectionExplanation', 'is', null)
                    .not('word_data->>inflectionExplanation', 'eq', '');

                if (error) throw error;

                if (cloudWords && cloudWords.length > 0) {
                    const updates = cloudWords.map(cw => {
                        const local = chunk.find(lw => lw.swedish_word === cw.swedish_word);
                        return {
                            ...local,
                            id: cw.id,
                            word_data: cw.word_data as any,
                            last_synced_at: new Date().toISOString()
                        } as LocalWord;
                    });

                    await db.words.bulkPut(updates);
                    updatedCount += cloudWords.length;
                }
            }

            toast.success(`Updated ${updatedCount} words with stories from cloud.`);
            setLastSyncTime(new Date());
        } catch (error: any) {
            console.error('Story sync failed:', error);
            toast.error(`Failed to sync stories: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    }, [user, isSyncing]);

    // Initial sync on mount if DB is empty
    useEffect(() => {
        const checkAndSync = async () => {
            if (!user) return;

            const wordCount = await db.words.count();
            if (wordCount === 0) {
                console.log('Words missing, triggering full sync...');
                await syncAll();
            } else {
                // Words are there, but check for progress
                const progressCount = await db.progress.count();
                if (progressCount === 0) {
                    console.log('Progress missing, triggering progress sync...');
                    await syncProgress();
                }
            }
        };
        checkAndSync();
    }, [user, syncAll, syncProgress]);

    return (
        <SyncContext.Provider value={{ isSyncing, lastSyncTime, syncAll, syncProgress, syncMissingStories, forceRefresh }}>
            {children}
        </SyncContext.Provider>
    );
}

export function useSync() {
    const context = useContext(SyncContext);
    if (context === undefined) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
}
