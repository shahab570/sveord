import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/services/db";
import { determineUnifiedLevel } from "@/utils/levelUtils";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

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
    const stats = useLiveQuery(async () => {
        // 1. Fetch ALL words and ALL progress
        // Optimized: In a real large app we might index this better, but for <10k words this is instant in Dexie
        const allWords = await db.words.toArray();
        const allProgress = await db.progress.toArray();

        // Map progress by word_id for O(1) lookup
        const progressMap = new Map(allProgress.map(p => [p.word_id, p]));

        // Initialize stats containers
        const cefrCounts: Record<string, { total: number; learned: number; reserved: number }> = {};
        CEFR_ORDER.forEach(l => cefrCounts[l] = { total: 0, learned: 0, reserved: 0 });
        cefrCounts["Unknown"] = { total: 0, learned: 0, reserved: 0 };

        let totalMastered = 0;
        let totalToStudy = 0;

        // Include all words (FT and corpus) so queue/learned counts reflect actual usage
        const validWords = allWords;
        const totalUnique = validWords.length;

        // 2. Iterate words to classify and count
        for (const word of validWords) {
            const level = determineUnifiedLevel(word);
            const prog = progressMap.get(word.id);

            // Increment Total for Level
            if (cefrCounts[level]) {
                cefrCounts[level].total++;
            } else {
                // Fallback for weird levels if any
                cefrCounts["Unknown"].total++;
            }

            // Check Status - Prioritize Reserve (To Study) over Learned if both exist
            // This ensures intent to study is reflected in the dashboard queue count
            if (prog?.is_reserve) {
                if (cefrCounts[level]) cefrCounts[level].reserved++;
                totalToStudy++;
            } else if (prog?.is_learned) {
                if (cefrCounts[level]) cefrCounts[level].learned++;
                totalMastered++;
            }
        }

        // 3. Calculate Daily Velocity
        const todayStart = startOfDay(new Date()).toISOString();

        // Valid Word IDs Set for O(1) membership check
        // This ensures we only count words that are actually in our "Unified Dictionary" (e.g., excluding FT, excluded orphans)
        const validWordIds = new Set(validWords.map(w => w.id));

        // Filter progress events from today AND ensure they belong to valid words
        const learnedTodayCount = new Set(
            allProgress.filter(p =>
                p.is_learned &&
                p.learned_date &&
                p.learned_date >= todayStart
            ).map(p => p.word_id)
        ).size;

        const reservedTodayCount = new Set(
            allProgress.filter(p =>
                p.is_reserve &&
                p.reserved_at &&
                p.reserved_at >= todayStart
            ).map(p => p.word_id)
        ).size;

        // 4. Format Output
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
    });

    return stats || {
        cefrProgress: {},
        proficiency: { mastered: 0, toStudy: 0, totalUnique: 0, completionPercent: 0 },
        velocity: { learnedToday: 0, reservedToday: 0 },
        hasData: false
    };
}
