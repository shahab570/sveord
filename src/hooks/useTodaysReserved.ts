import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/services/db";
import { WordWithProgress } from "./useWords";

// Reusing the same structure as useTodaysLearnedWords but for reserved words
export function useTodaysReservedWords() {
    const { user } = useAuth();

    return useLiveQuery(async () => {
        if (!user) return [];

        const now = new Date();
        const localStartOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // Fetch progress for reserved today from local DB
        // Using reserved_at timestamp
        const todaysReservedRaw = await db.progress
            .where('user_id').equals(user.id)
            .filter(p =>
                !!p.is_reserve &&
                !!p.reserved_at &&
                new Date(p.reserved_at).getTime() >= localStartOfToday
            )
            .toArray();

        // De-duplicate in case of sync issues
        const uniqueMap = new Map();
        for (const p of todaysReservedRaw) {
            if (!uniqueMap.has(p.word_id)) uniqueMap.set(p.word_id, p);
        }
        const todaysReserved = Array.from(uniqueMap.values());

        if (!todaysReserved.length) return [];

        // Fetch corresponding word data efficiently
        const result: WordWithProgress[] = [];
        const swedishWords = todaysReserved.map(p => p.word_swedish);
        const wordsList = await db.words.where('swedish_word').anyOf(swedishWords).toArray();
        const wordsMap = new Map(wordsList.map(w => [w.swedish_word, w]));

        const seenWords = new Set<string>();

        for (const p of todaysReserved) {
            if (seenWords.has(p.word_swedish)) continue;

            const w = wordsMap.get(p.word_swedish);
            if (w) {
                seenWords.add(p.word_swedish);
                result.push({
                    id: w.id || 0,
                    swedish_word: w.swedish_word,
                    created_at: "",
                    word_data: w.word_data || null,
                    progress: {
                        id: p.id || "",
                        user_id: user.id || "",
                        word_id: w.id || 0,
                        is_learned: !!p.is_learned,
                        learned_date: p.learned_date || null,
                        user_meaning: p.user_meaning || null,
                        custom_spelling: p.custom_spelling || null,
                        created_at: "",
                        updated_at: "",
                        srs_next_review: p.srs_next_review,
                        is_reserve: !!p.is_reserve,
                        reserved_at: p.reserved_at,
                    },
                });
            }
        }

        return result;
    }, [user?.id]);
}
