const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN; // Get this from user

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

// CEFR Levels for reference
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

// Frequency ranges
const FREQUENCY_LEVELS = [
    { label: "A1", range: [1, 1500] },
    { label: "A2", range: [1501, 3000] },
    { label: "B1", range: [3001, 5000] },
    { label: "B2", range: [5001, 7000] },
    { label: "C1", range: [7001, 9000] },
    { label: "C2", range: [9001, 99999] },
];

// Sidor ranges
const SIDOR_LEVELS = [
    { label: "A1", range: [1, 600] },
    { label: "A2", range: [601, 1200] },
    { label: "B1", range: [1201, 1800] },
    { label: "B2", range: [1801, 2400] },
    { label: "C1", range: [2401, 3000] },
    { label: "C2", range: [3001, 99999] },
];

function getHeaders() {
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken || supabaseKey}` // Prefer access token if available
    };
    return headers;
}

async function fetchAllWords() {
    let allWords = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    console.log("Step 1: Fetching all words from Supabase...");

    while (hasMore) {
        const url = `${supabaseUrl}/rest/v1/words?select=*&offset=${from}&limit=${limit}`;
        try {
            const res = await fetch(url, { headers: getHeaders() });

            if (!res.ok) throw new Error(`Fetch error: ${res.statusText}`);

            const chunk = await res.json();
            if (chunk.length === 0) {
                hasMore = false;
                if (allWords.length === 0) {
                    console.log("  > WARNING: Fetched 0 words. If the table is not empty, check your permissions or SUPABASE_ACCESS_TOKEN.");
                }
            } else {
                allWords = [...allWords, ...chunk];
                from += limit;
                process.stdout.write(`\rFetched ${allWords.length} words...`);
            }
        } catch (err) {
            console.error("\nError fetching words chunk:", err);
            hasMore = false;
        }
    }
    console.log("\nWords fetch complete.");
    return allWords;
}

async function fetchUserProgress() {
    let allProgress = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    console.log("Step 2: Fetching user progress from Supabase...");

    while (hasMore) {
        const url = `${supabaseUrl}/rest/v1/user_progress?select=*&offset=${from}&limit=${limit}`;
        try {
            const res = await fetch(url, { headers: getHeaders() });

            if (!res.ok) throw new Error(`Fetch error: ${res.statusText}`);

            const chunk = await res.json();
            if (chunk.length === 0) {
                hasMore = false;
            } else {
                allProgress = [...allProgress, ...chunk];
                from += limit;
                process.stdout.write(`\rFetched ${allProgress.length} progress records...`);
            }
        } catch (err) {
            console.error("\nError fetching progress chunk:", err);
            hasMore = false;
        }
    }
    console.log("\nProgress fetch complete.");
    return allProgress;
}

function determineLevel(word) {
    if (word.kelly_level && CEFR_LEVELS.includes(word.kelly_level)) return word.kelly_level;
    if (word.frequency_rank) {
        for (const level of FREQUENCY_LEVELS) {
            if (word.frequency_rank >= level.range[0] && word.frequency_rank <= level.range[1]) return level.label;
        }
    }
    if (word.sidor_rank) {
        for (const level of SIDOR_LEVELS) {
            if (word.sidor_rank >= level.range[0] && word.sidor_rank <= level.range[1]) return level.label;
        }
    }
    return "Unknown";
}

async function consolidate() {
    try {
        if (!accessToken) {
            console.log("\n⚠️  NOTE: No SUPABASE_ACCESS_TOKEN found in .env. Fetching as anonymous. If RLS is enabled, you may get 0 results.\n");
        }

        const [words, progress] = await Promise.all([fetchAllWords(), fetchUserProgress()]);

        if (words.length === 0) {
            console.error("\nFAILED: No words found. Cannot consolidate empty list.");
            return;
        }

        console.log("Step 3: Indexing progress...");
        const progressMap = new Map();
        progress.forEach(p => {
            const existing = progressMap.get(p.word_id);
            if (!existing) {
                progressMap.set(p.word_id, p);
            } else {
                if (!existing.is_learned && p.is_learned) progressMap.set(p.word_id, p);
                else if (!existing.is_reserve && p.is_reserve) progressMap.set(p.word_id, p);
            }
        });

        console.log("Step 4: Consolidating and deduplicating words...");
        const map = new Map();

        for (const w of words) {
            const swedish = w.swedish_word ? w.swedish_word.trim() : null;
            if (!swedish) continue;

            const lowerKey = swedish.toLowerCase();
            const prog = progressMap.get(w.id);

            const wordObj = {
                ...w,
                swedish_word: swedish,
                is_learned: prog?.is_learned ? true : false,
                is_reserve: prog?.is_reserve ? true : false,
                is_encountered: (prog?.is_learned || prog?.is_reserve) ? true : false,
                user_meaning: prog?.user_meaning || null,
                custom_spelling: prog?.custom_spelling || null,
                learned_date: prog?.learned_date || null,
                reserved_at: prog?.reserved_at || null
            };

            if (map.has(lowerKey)) {
                const existing = map.get(lowerKey);
                existing.kelly_level = existing.kelly_level || wordObj.kelly_level;
                existing.frequency_rank = existing.frequency_rank || wordObj.frequency_rank;
                existing.sidor_rank = existing.sidor_rank || wordObj.sidor_rank;
                existing.word_data = existing.word_data || wordObj.word_data;
                existing.kelly_source_id = existing.kelly_source_id || wordObj.kelly_source_id;
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
        consolidatedList.sort((a, b) => {
            const levelOrder = { "A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6, "Unknown": 7 };
            const la = levelOrder[a.unified_level] || 99;
            const lb = levelOrder[b.unified_level] || 99;
            if (la !== lb) return la - lb;
            return a.swedish_word.localeCompare(b.swedish_word);
        });

        console.log(`\n--- RESULTS ---`);
        console.log(`Total Words Scanned: ${words.length}`);
        console.log(`Consolidated Unique Words: ${consolidatedList.length}`);

        const counts = {};
        consolidatedList.forEach(w => {
            counts[w.unified_level] = (counts[w.unified_level] || 0) + 1;
        });
        console.log("\nCounts by Unified Level:", counts);

        const outputPath = path.join(__dirname, 'unified_words.json');
        fs.writeFileSync(outputPath, JSON.stringify(consolidatedList, null, 2));

        console.log(`\nSUCCESS: Unified list saved to: ${outputPath}`);
    } catch (e) {
        console.error("Critical error in consolidation:", e);
    }
}

consolidate();
