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

        // 2. Resolve "Ground Truth" for this user
        // We filter for this user's records but also orphans (which might belong to them)
        const myEntries = allProgress.filter(p => !p.user_id || p.user_id === user.id);

        // 3. De-duplicate by word_id based strictly on RECENCY
        // Status (Learned vs Reserved) is secondary to what the user did LATEST
        const bestRecordsMap = new Map();

        for (const p of myEntries) {
            const key = String(p.word_id);
            const existing = bestRecordsMap.get(key);

            if (!existing) {
                bestRecordsMap.set(key, p);
            } else {
                // Determine which one is more recent/reliable
                const pTime = Math.max(
                    new Date(p.learned_date || 0).getTime(),
                    new Date(p.reserved_at || 0).getTime(),
                    new Date(p.last_synced_at || 0).getTime()
                );
                const existingTime = Math.max(
                    new Date(existing.learned_date || 0).getTime(),
                    new Date(existing.reserved_at || 0).getTime(),
                    new Date(existing.last_synced_at || 0).getTime()
                );

                // Priority: UserID > Recency > Status
                let useNew = false;
                if (!existing.user_id && p.user_id) useNew = true;
                else if (p.user_id === existing.user_id && pTime > existingTime) useNew = true;

                if (useNew) {
                    bestRecordsMap.set(key, p);
                }
            }
        }

        const filteredProgress = Array.from(bestRecordsMap.values());

        // 4. Calculate Totals
        const totalMastered = filteredProgress.filter(p => !!p.is_learned).length;
        const totalToStudy = filteredProgress.filter(p => !!p.is_reserve).length;

        console.log(`[DashboardStats] ${user.id}: Words=${allWords.length}, CleanRecords=${filteredProgress.length}, Mastered=${totalMastered}, ToStudy=${totalToStudy}`);

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

            if (prog?.is_reserve) {
                if (cefrCounts[level]) cefrCounts[level].reserved++;
            } else if (prog?.is_learned) {
                if (cefrCounts[level]) cefrCounts[level].learned++;
            }
        }

        // 6. Calculate Daily Velocity
        const todayStart = startOfDay(new Date()).getTime();

        const learnedProgress = filteredProgress.filter(p => !!p.is_learned);
        const reservedProgress = filteredProgress.filter(p => !!p.is_reserve);

        const learnedTodayCount = learnedProgress.filter(p =>
            p.learned_date && new Date(p.learned_date).getTime() >= todayStart
        ).length;

        const reservedTodayCount = reservedProgress.filter(p =>
            p.reserved_at && new Date(p.reserved_at).getTime() >= todayStart
        ).length;

        console.log(`[DashboardStats] Velocity -> LearnedToday: ${learnedTodayCount}, ReservedToday: ${reservedTodayCount}`);

        console.log(`[Stats] Velocity Today -> Learned: ${learnedTodayCount}, Reserved: ${reservedTodayCount}`);

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
