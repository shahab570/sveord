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

        // 1. Fetch EVERYTHING in parallel for speed
        const [allWords, allProgress] = await Promise.all([
            db.words.toArray(),
            db.progress.where('user_id').equals(user.id).toArray()
        ]);

        // 2. Build Progress Map & SILENT CLEANUP of legacy data
        const progressMap = new Map();
        for (const rawP of allProgress) {
            const p = rawP as any;
            // Self-heal: If we find boolean or string statuses, fix them in the DB silently
            if (typeof p.is_learned !== 'number' || typeof p.is_reserve !== 'number') {
                const fixed = {
                    ...p,
                    is_learned: p.is_learned === true || p.is_learned === 1 || p.is_learned === "1" ? 1 : 0,
                    is_reserve: p.is_reserve === true || p.is_reserve === 1 || p.is_reserve === "1" ? 1 : 0
                };
                db.progress.put(fixed);
                progressMap.set(String(p.word_id), fixed);
            } else {
                progressMap.set(String(p.word_id), p);
            }
        }

        // 3. Initialize stats containers
        const cefrCounts: Record<string, { total: number; learned: number; reserved: number }> = {};
        CEFR_ORDER.forEach(l => cefrCounts[l] = { total: 0, learned: 0, reserved: 0 });
        cefrCounts["Unknown"] = { total: 0, learned: 0, reserved: 0 };

        let totalMastered = 0;
        let totalToStudy = 0;
        const totalUnique = allWords.length;

        // 4. Iterate words to classify and count
        for (const word of allWords) {
            const level = determineUnifiedLevel(word);
            const prog = progressMap.get(String(word.id));

            // Populate total for the level
            if (cefrCounts[level]) {
                cefrCounts[level].total++;
            } else {
                cefrCounts["Unknown"].total++;
            }

            // 4. Check Status - Simple 0/1 checks
            if (prog?.is_reserve === 1) {
                if (cefrCounts[level]) cefrCounts[level].reserved++;
                totalToStudy++;
            } else if (prog?.is_learned === 1) {
                if (cefrCounts[level]) cefrCounts[level].learned++;
                totalMastered++;
            }
        }

        // 5. Calculate Daily Velocity
        const todayStart = startOfDay(new Date()).getTime();

        const learnedTodayCount = allProgress.filter(p =>
            p.is_learned === 1 &&
            p.learned_date &&
            new Date(p.learned_date).getTime() >= todayStart
        ).length;

        const reservedTodayCount = allProgress.filter(p =>
            p.is_reserve === 1 &&
            p.reserved_at &&
            new Date(p.reserved_at).getTime() >= todayStart
        ).length;

        // 6. Format Output
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
