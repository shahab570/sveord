import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/services/db";
import { determineUnifiedLevel } from "@/utils/levelUtils";
import { startOfDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

export interface DashboardStats {
    cefrProgress: Record<string, { total: number; learned: number; reserved: number; percent: number }>;
    proficiency: {
        mastered: number;
        toStudy: number;
        totalUnique: number;
        completionPercent: number;
    };
    velocity: {
        learnedToday: number;
        reservedToday: number;
    };
    hasData: boolean;
}

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2", "D1"];

export function useUnifiedStats(): DashboardStats {
    const { user } = useAuth();

    const stats = useLiveQuery(async () => {
        if (!user) return null;

        // Diagnostic Log
        console.log(`[Stats] Recalculating for user ${user.id}...`);

        // 1. Fetch EVERYTHING
        const [allWords, allProgress] = await Promise.all([
            db.words.toArray(),
            db.progress.toArray()
        ]);

        // 2. SELF-HEALING: De-duplicate records by word_id
        // Historical sync bugs might have created multiple entries per word
        const deDuplicated = new Map();
        const duplicatesToDelete: number[] = [];

        for (const p of allProgress) {
            const key = String(p.word_id);
            const existing = deDuplicated.get(key);

            if (!existing) {
                deDuplicated.set(key, p);
            } else {
                // Keep the "Best" one (priority: Learned > Reserved > most recent)
                let keepNew = false;
                if (!existing.is_learned && p.is_learned) keepNew = true;
                else if (!existing.is_learned && !existing.is_reserve && p.is_reserve) keepNew = true;
                else if (p.last_synced_at && (!existing.last_synced_at || p.last_synced_at > existing.last_synced_at)) {
                    // If both have same status, keep the newer one
                    if (existing.is_learned === p.is_learned && existing.is_reserve === p.is_reserve) keepNew = true;
                }

                if (keepNew) {
                    if (existing.id) duplicatesToDelete.push(existing.id as any);
                    deDuplicated.set(key, p);
                } else {
                    if (p.id) duplicatesToDelete.push(p.id as any);
                }
            }
        }

        // Silent Cleanup
        if (duplicatesToDelete.length > 0) {
            console.log(`[Stats] Cleaning up ${duplicatesToDelete.length} duplicates...`);
            db.progress.bulkDelete(duplicatesToDelete as any);
        }

        const myProgressList = Array.from(deDuplicated.values());
        const filteredProgress = myProgressList.filter(p => !p.user_id || p.user_id === user.id);

        // 3. ZERO-TRUST TOTALS (Directly from clean progress list)
        const totalMastered = filteredProgress.filter(p => !!p.is_learned).length;
        const totalToStudy = filteredProgress.filter(p => !!p.is_reserve).length;

        console.log(`[Stats] Records: Clean=${myProgressList.length}, TotalUnique=${deDuplicated.size}`);
        console.log(`[Stats] Direct Counts -> Mastered: ${totalMastered}, Queue: ${totalToStudy}`);

        // 3. Build Mapping for Level Bars (Hybrid ID + Swedish Word matching)
        const progressMap = new Map(); // Map by string ID
        const textFallbackMap = new Map(); // Map by lowercase Swedish word

        for (const p of filteredProgress) {
            progressMap.set(String(p.word_id), p);
            if (p.word_swedish) {
                textFallbackMap.set(p.word_swedish.toLowerCase(), p);
            }
        }

        // 4. Initialize stats containers
        const cefrCounts: Record<string, { total: number; learned: number; reserved: number }> = {};
        CEFR_ORDER.forEach(l => cefrCounts[l] = { total: 0, learned: 0, reserved: 0 });
        cefrCounts["Unknown"] = { total: 0, learned: 0, reserved: 0 };

        const totalUnique = allWords.length;

        // 5. Iterate words to classify by Level
        for (const word of allWords) {
            const level = determineUnifiedLevel(word);

            // HYBRID LOOKUP: Try ID first, then fallback to Swedish Text match
            const prog = progressMap.get(String(word.id)) || textFallbackMap.get(word.swedish_word.toLowerCase());

            if (cefrCounts[level]) {
                cefrCounts[level].total++;
            } else {
                cefrCounts["Unknown"].total++;
            }

            if (!!prog?.is_reserve) {
                if (cefrCounts[level]) cefrCounts[level].reserved++;
            } else if (!!prog?.is_learned) {
                if (cefrCounts[level]) cefrCounts[level].learned++;
            }
        }

        // 6. Calculate Daily Velocity
        const todayStart = startOfDay(new Date()).getTime();

        const learnedTodayCount = filteredProgress.filter(p =>
            !!p.is_learned &&
            p.learned_date &&
            new Date(p.learned_date).getTime() >= todayStart
        ).length;

        const reservedTodayCount = filteredProgress.filter(p =>
            !!p.is_reserve &&
            p.reserved_at &&
            new Date(p.reserved_at).getTime() >= todayStart
        ).length;

        // 7. Format Output
        const cefrProgress: any = {};
        CEFR_ORDER.forEach(level => {
            const data = cefrCounts[level];
            cefrProgress[level] = {
                ...data,
                percent: data.total > 0 ? Math.round((data.learned / data.total) * 100) : 0
            };
        });

        return {
            cefrProgress,
            proficiency: {
                mastered: totalMastered,
                toStudy: totalToStudy,
                totalUnique,
                completionPercent: totalUnique > 0 ? Math.round((totalMastered / totalUnique) * 100) : 0
            },
            velocity: {
                learnedToday: learnedTodayCount,
                reservedToday: reservedTodayCount
            },
            hasData: totalUnique > 0
        };
    }, [user?.id]); // Re-run when user changes

    return stats || {
        cefrProgress: {},
        proficiency: { mastered: 0, toStudy: 0, totalUnique: 0, completionPercent: 0 },
        velocity: { learnedToday: 0, reservedToday: 0 },
        hasData: false
    };
}
