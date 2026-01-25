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

            // 1. Sync Words
            const { data: words, error: wordsError } = await supabase
                .from('words')
                .select('*');

            if (wordsError) throw wordsError;

            if (words) {
                // Bulk put to merge duplicates (handled by schema &swedish_word)
                await db.words.bulkPut(words.map(w => ({
                    swedish_word: w.swedish_word,
                    kelly_level: w.kelly_level || undefined,
                    kelly_source_id: w.kelly_source_id || undefined,
                    frequency_rank: w.frequency_rank || undefined,
                    sidor_rank: w.sidor_rank || undefined,
                    word_data: w.word_data as any,
                    last_synced_at: new Date().toISOString()
                })));
            }

            // 2. Sync Progress
            await syncProgress();

            setLastSyncTime(new Date());
            console.log('Full sync completed');
        } catch (error) {
            console.error('Sync failed:', error);
            toast.error('Failed to sync data with server');
        } finally {
            setIsSyncing(false);
        }
    }, [user, isSyncing]);

    const syncProgress = useCallback(async () => {
        if (!user) return;
        try {
            const { data: progress, error: progressError } = await supabase
                .from('user_progress')
                .select('*, words(swedish_word)')
                .eq('user_id', user.id);

            if (progressError) throw progressError;

            if (progress) {
                await db.progress.bulkPut(progress.map(p => ({
                    word_swedish: (p.words as any).swedish_word,
                    is_learned: p.is_learned || false,
                    user_meaning: p.user_meaning || undefined,
                    custom_spelling: p.custom_spelling || undefined,
                    learned_date: p.learned_date || undefined,
                    last_synced_at: new Date().toISOString()
                })));
            }
        } catch (error) {
            console.error('Progress sync failed:', error);
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
        <SyncContext.Provider value={{ isSyncing, lastSyncTime, syncAll, syncProgress }}>
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
