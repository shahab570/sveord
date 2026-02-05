import { db } from "@/services/db";
import { CEFR_LEVELS } from "@/hooks/useWords";

// Since we are running in browser context, we can use the db instance directly which is synced.
// However, the user wants ALL worlds including ones potentially not yet visited if using lazy loading?
// The db.words table SHOULD populate with everything if they synced, or at least progressive.
// But earlier we saw lazy loading.
// To satisfy the "combine A1 list of all list" requirement, we might need to fetch from Supabase if the user is authenticated.

import { supabase } from "@/integrations/supabase/client";

// Simple level determination based on word_data
function determineLevel(word: any) {
    if (word.word_data?.cefr_level) return word.word_data.cefr_level;
    return "D1";
}

export async function exportUnifiedList() {
    console.log("Starting unified export...");

    // 1. Fetch ALL words from remote Supabase (bypass local lazy load)
    // This might take a moment.
    const allWords = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('words')
            .select('*')
            .range(from, from + limit - 1);

        if (error) {
            console.error("Fetch error", error);
            throw error;
        }

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allWords.push(...data);
            from += limit;
            console.log(`Fetched ${allWords.length} words...`);
        }
    }

    // 2. Fetch User Progress (Remote)
    const allProgress = [];
    from = 0;
    hasMore = true;

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    while (hasMore) {
        const { data, error } = await supabase
            .from('user_progress')
            .select('*')
            .eq('user_id', user.id)
            .range(from, from + limit - 1);

        if (error) {
            console.error("Fetch progress error", error);
            throw error;
        }

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allProgress.push(...data);
            from += limit;
        }
    }

    // 3. Consolidate
    const progressMap = new Map();
    allProgress.forEach(p => {
        // Priority logic: Learned > Reserved > Neutral
        const existing = progressMap.get(p.word_id);
        if (!existing) {
            progressMap.set(p.word_id, p);
        } else {
            if (!existing.is_learned && p.is_learned) progressMap.set(p.word_id, p);
            else if (!existing.is_reserve && p.is_reserve) progressMap.set(p.word_id, p);
        }
    });

    const map = new Map();
    for (const w of allWords) {
        const swedish = w.swedish_word?.trim();
        if (!swedish) continue;
        const lowerKey = swedish.toLowerCase();

        const prog = progressMap.get(w.id);

        const wordObj = {
            id: w.id,
            swedish_word: swedish,
            word_data: w.word_data,
            is_learned: prog?.is_learned ? true : false,
            is_reserve: prog?.is_reserve ? true : false,
            is_encountered: (prog?.is_learned || prog?.is_reserve) ? true : false,
            user_meaning: prog?.user_meaning || null,
            custom_spelling: prog?.custom_spelling || null,
            learned_date: prog?.learned_date || null,
            reserved_at: prog?.reserved_at || null,
            unified_level: "Unknown" as string
        };

        if (map.has(lowerKey)) {
            const existing = map.get(lowerKey);
            // Merge strategy
            existing.word_data = existing.word_data || wordObj.word_data;

            existing.is_learned = existing.is_learned || wordObj.is_learned;
            existing.is_reserve = existing.is_reserve || wordObj.is_reserve;
            existing.is_encountered = existing.is_encountered || wordObj.is_encountered;

            existing.user_meaning = existing.user_meaning || wordObj.user_meaning;
            existing.custom_spelling = existing.custom_spelling || wordObj.custom_spelling;

            existing.unified_level = determineLevel(existing);
            map.set(lowerKey, existing);
        } else {
            wordObj.unified_level = determineLevel(wordObj);
            map.set(lowerKey, wordObj);
        }
    }

    const consolidatedList = Array.from(map.values());

    // Sort
    consolidatedList.sort((a: any, b: any) => {
        const levelOrder: any = { "A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6, "Unknown": 7 };
        const la = levelOrder[a.unified_level] || 99;
        const lb = levelOrder[b.unified_level] || 99;
        if (la !== lb) return la - lb;
        return a.swedish_word.localeCompare(b.swedish_word);
    });

    // Download
    const blob = new Blob([JSON.stringify(consolidatedList, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unified_words_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    return consolidatedList.length;
}
