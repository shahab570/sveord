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
            const PAGE_SIZE = 1000;
            let hasMore = true;

            // 1. Sync Words (Paginated)
            while (hasMore) {
                const { data: words, error: wordsError } = await supabase
                    .from('words')
                    .select('*')
                    .range(from, from + PAGE_SIZE - 1);

                if (wordsError) throw wordsError;

                if (words && words.length > 0) {
                    allWords = [...allWords, ...words];
                    // Bulk put current batch immediately to save memory and show progress if needed
                    await db.words.bulkPut(words.map(w => ({
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
                const { data: progress, error: progressError } = await supabase
                    .from('user_progress')
                    .select('*, words(swedish_word)')
                    .eq('user_id', user.id)
                    .range(from, from + PAGE_SIZE - 1);

                if (progressError) throw progressError;

                if (progress && progress.length > 0) {
                    await db.progress.bulkPut(progress.map(p => ({
                        word_swedish: (p.words as any)?.swedish_word || '',
                        is_learned: p.is_learned || false,
                        user_meaning: p.user_meaning || undefined,
                        custom_spelling: p.custom_spelling || undefined,
                        learned_date: p.learned_date || undefined,
                        last_synced_at: new Date().toISOString()
                    })).filter(p => p.word_swedish !== ''));

                    if (progress.length < PAGE_SIZE) {
                        hasMore = false;
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

    // Initial sync on mount if DB is empty
    useEffect(() => {
        const checkAndSync = async () => {
            const count = await db.words.count();
            if (count === 0 && user) {
                await syncAll();
            }
        };
        checkAndSync();
    }, [user, syncAll]);

    return (
        <SyncContext.Provider value={{ isSyncing, lastSyncTime, syncAll, syncProgress, forceRefresh }}>
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
