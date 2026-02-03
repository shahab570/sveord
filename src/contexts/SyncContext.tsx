import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
    pushLocalToCloud: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const syncLockRef = useRef(false);

    const setSyncing = (val: boolean) => {
        syncLockRef.current = val;
        setIsSyncing(val);
    };

    const syncProgress = useCallback(async (silent = false) => {
        if (!user) return;
        try {
            let from = 0;
            const PAGE_SIZE = 1000;
            let hasMore = true;

            while (hasMore) {
                // Fetch progress AND full word data for joined words
                const { data: progress, error: progressError } = await supabase
                    .from('user_progress')
                    .select('*, words(*)') // Fetch full word data to prevent orphans
                    .eq('user_id', user.id)
                    .range(from, from + PAGE_SIZE - 1);

                if (progressError) throw progressError;

                if (progress && progress.length > 0) {
                    const progressRecords: any[] = [];
                    const wordUpdates: LocalWord[] = [];

                    // Optimization: Bulk fetch local progress to preserve local-only fields (SRS, Reserve)
                    // since Supabase might not have these columns or they might be missing
                    const swedishWords = progress.map((p: any) => {
                        const wd = Array.isArray(p.words) ? p.words[0] : p.words;
                        return wd?.swedish_word;
                    }).filter(Boolean);

                    const localProgressList = await db.progress.where('word_swedish').anyOf(swedishWords).toArray();
                    const localProgressMap = new Map(localProgressList.map(item => [item.word_swedish, item]));

                    for (const row of progress) {
                        const p = row as any;
                        const wordData = Array.isArray(p.words) ? p.words[0] : p.words;
                        if (!wordData) continue;

                        const existingProgress = localProgressMap.get(wordData.swedish_word);

                        progressRecords.push({
                            word_swedish: wordData.swedish_word,
                            is_learned: p.is_learned ? 1 : 0,
                            user_meaning: p.user_meaning || undefined,
                            custom_spelling: p.custom_spelling || undefined,
                            learned_date: p.learned_date || undefined,
                            last_synced_at: new Date().toISOString(),
                            // Robust Sync: Prefer remote value if it exists, otherwise preserve local value
                            // This prevents wiping local state for fields not yet in Supabase (like is_reserve or SRS)
                            is_reserve: p.is_reserve !== undefined ? (p.is_reserve ? 1 : 0) : (existingProgress?.is_reserve || 0),
                            srs_next_review: p.srs_next_review || existingProgress?.srs_next_review,
                            srs_interval: p.srs_interval || existingProgress?.srs_interval,
                            srs_ease: p.srs_ease || existingProgress?.srs_ease,
                        });

                        // Ensure we have this word in our local database too!
                        const existing = await db.words.get(wordData.swedish_word);
                        wordUpdates.push({
                            id: wordData.id,
                            swedish_word: wordData.swedish_word,
                            kelly_level: wordData.kelly_level || undefined,
                            kelly_source_id: wordData.kelly_source_id || undefined,
                            frequency_rank: wordData.frequency_rank || undefined,
                            sidor_rank: wordData.sidor_rank || undefined,
                            word_data: wordData.word_data as any,
                            last_synced_at: new Date().toISOString(),
                            is_ft: (wordData.word_data as any)?.is_ft ? 1 : existing?.is_ft // Restore from JSON or preserve local
                        });
                    }

                    if (wordUpdates.length > 0) {
                        await db.words.bulkPut(wordUpdates);
                    }
                    if (progressRecords.length > 0) {
                        await db.progress.bulkPut(progressRecords as any);
                    }

                    if (progress.length < PAGE_SIZE) {
                        hasMore = false;
                        if (!silent) {
                            toast.success(`Successfully synced ${from + progress.length} progress records.`);
                        }
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

    const syncAll = useCallback(async () => {
        if (!user || syncLockRef.current) return;
        setSyncing(true);
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
                    const wordUpdates = await Promise.all(words.map(async w => {
                        const existing = await db.words.get(w.swedish_word);
                        return {
                            id: w.id, // CRITICAL FIX: Save the Supabase ID locally
                            swedish_word: w.swedish_word,
                            kelly_level: w.kelly_level || undefined,
                            kelly_source_id: w.kelly_source_id || undefined,
                            frequency_rank: w.frequency_rank || undefined,
                            sidor_rank: w.sidor_rank || undefined,
                            word_data: w.word_data as any,
                            last_synced_at: new Date().toISOString(),
                            is_ft: (w.word_data as any)?.is_ft ? 1 : existing?.is_ft // Restore from JSON or preserve local
                        };
                    }));
                    await db.words.bulkPut(wordUpdates);

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
            await syncProgress(true);

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
            setSyncing(false);
        }
    }, [user, syncProgress]);

    const forceRefresh = useCallback(async () => {
        if (!user || syncLockRef.current) return;
        const confirm = window.confirm("This will clear your local cache and re-download everything. Continue?");
        if (!confirm) return;

        setSyncing(true);
        try {
            console.log('Clearing local database...');
            await db.words.clear();
            await db.progress.clear();
            syncLockRef.current = false; // Temporarily unlock to let syncAll run
            await syncAll();
        } catch (error: any) {
            console.error('Force refresh failed:', error);
            toast.error('Failed to clear local database');
        } finally {
            setSyncing(false);
        }
    }, [user, syncAll]);

    const syncMissingStories = useCallback(async () => {
        if (!user || syncLockRef.current) return;
        setSyncing(true);
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
            setSyncing(false);
        }
    }, [user]);

    const pushLocalToCloud = useCallback(async () => {
        if (!user || syncLockRef.current) return;
        setSyncing(true);
        const toastId = toast.loading("Checking for local data to backup...");
        try {
            // 1. Get all local progress
            const allLocalProgress = await db.progress.toArray();

            // 2. Identify words that need backup (Reserve, Learned, SRS)
            // We want to ensure specific local states are reflected in cloud
            const meaningfulProgress = allLocalProgress.filter(p =>
                p.is_reserve === 1 ||
                p.is_learned === 1 ||
                (p.srs_interval && p.srs_interval > 0)
            );

            if (meaningfulProgress.length === 0) {
                toast.dismiss(toastId);
                toast.info("No local progress found to push.");
                return;
            }

            toast.loading(`Backing up ${meaningfulProgress.length} items to cloud...`, { id: toastId });

            const CHUNK_SIZE = 100;
            let successCount = 0;

            for (let i = 0; i < meaningfulProgress.length; i += CHUNK_SIZE) {
                const chunk = meaningfulProgress.slice(i, i + CHUNK_SIZE);

                // We need word IDs for Supabase
                const swedishWords = chunk.map(p => p.word_swedish);
                const { data: cloudWords, error: wordError } = await supabase
                    .from('words')
                    .select('id, swedish_word')
                    .in('swedish_word', swedishWords);

                if (wordError) throw wordError;

                const cloudWordMap = new Map(cloudWords?.map(cw => [cw.swedish_word, cw.id]));

                const updates = chunk.map(p => {
                    const wordId = cloudWordMap.get(p.word_swedish);
                    if (!wordId) return null; // Skip if word doesn't exist in cloud (rare)

                    return {
                        user_id: user.id,
                        word_id: wordId,
                        is_learned: p.is_learned === 1,
                        is_reserve: p.is_reserve === 1,
                        srs_next_review: p.srs_next_review || null,
                        srs_interval: p.srs_interval || 0,
                        srs_ease: p.srs_ease || 2.5,
                        user_meaning: p.user_meaning || null,
                        custom_spelling: p.custom_spelling || null,
                        updated_at: new Date().toISOString(),
                        learned_date: p.learned_date || null
                    };
                }).filter(Boolean);

                if (updates.length > 0) {
                    const { error } = await supabase
                        .from('user_progress')
                        .upsert(updates as any, { onConflict: 'user_id,word_id', ignoreDuplicates: false });

                    if (error) throw error;
                    successCount += updates.length;
                }
            }

            toast.success(`Successfully backed up ${successCount} items to cloud!`, { id: toastId });
            setLastSyncTime(new Date());

        } catch (error: any) {
            console.error('Push backup failed:', error);
            toast.error(`Backup failed: ${error.message}`, { id: toastId });
        } finally {
            setSyncing(false);
        }
    }, [user]);
    useEffect(() => {
        const checkAndSync = async () => {
            if (!user) return;

            const wordCount = await db.words.count();
            if (wordCount === 0) {
                console.log('Words missing, triggering full sync...');
                await syncAll();
            } else {
                // Always sync progress on mount to ensure local device is up to date with cloud
                console.log('Refreshing progress from cloud...');
                if (!syncLockRef.current) {
                    setSyncing(true);
                    try {
                        await syncProgress(true);
                    } finally {
                        setSyncing(false);
                    }
                }
            }
        };
        checkAndSync();
    }, [user?.id, syncAll, syncProgress]);

    return (
        <SyncContext.Provider value={{ isSyncing, lastSyncTime, syncAll, syncProgress, syncMissingStories, forceRefresh, pushLocalToCloud }}>
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
