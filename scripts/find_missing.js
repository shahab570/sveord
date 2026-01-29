import { createClient } from '@supabase/supabase-js';
const supabaseUrl = "https://bhblsdgfzmnttwqsherk.supabase.co";
const supabaseKey = "sb_publishable_waMqmpKauNXDBM8ktHMtFQ_YAVyge6A";

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMissing() {
    const { count: totalCount, error: totalError } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true });

    if (totalError) console.error('Total count error:', totalError);

    const { count: completedCount, error: completedError } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true })
        .not('word_data', 'is', null);

    if (completedError) console.error('Completed count error:', completedError);

    console.log(`Total: ${totalCount}, Completed: ${completedCount}, Missing: ${(totalCount || 0) - (completedCount || 0)}`);

    const { data: firstWords, error: fetchError } = await supabase
        .from('words')
        .select('id, swedish_word')
        .limit(10);

    if (fetchError) console.error('Fetch error:', fetchError);
    console.log('First 10 words:', firstWords ? firstWords.length : 0);
    if (firstWords && firstWords.length > 0) {
        console.log('Sample:', firstWords[0]);
    }

    const { data: allWords, error: allWordsError } = await supabase
        .from('words')
        .select('id, swedish_word, word_data')
        .limit(15000);

    if (allWordsError) console.error('All words fetch error:', allWordsError);

    const reallyMissing = allWords ? allWords.filter(w => !w.word_data) : [];
    console.log('Really missing count:', reallyMissing.length);
    if (reallyMissing.length > 0) {
        console.log('Missing words:', JSON.stringify(reallyMissing, null, 2));
    }

    // Check for duplicates
    const wordCounts = new Map();
    if (allWords) { // Ensure allWords is not null before iterating
        allWords.forEach(w => {
            wordCounts.set(w.swedish_word, (wordCounts.get(w.swedish_word) || 0) + 1);
        });
    }

    const duplicates = [...wordCounts.entries()].filter(([word, count]) => count > 1);
    console.log('Duplicates count:', duplicates.length);
    if (duplicates.length > 0) {
        console.log('Duplicate samples:', JSON.stringify(duplicates.slice(0, 5), null, 2));
    }
}

findMissing();
