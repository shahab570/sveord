
import { createClient } from '@supabase/supabase-js';

const url = "https://bhblsdgfzmnttwqsherk.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYmxzZGdmem1udHR3cXNoZXJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4NzYyNCwiZXhwIjoyMDg0ODYzNjI0fQ.U5SejPbDU1Cgm4RWrcgXJ8Zuvga9X_QgL4UTTS3uREM";

const supabase = createClient(url, key);

async function check() {
    try {
        const { data: allProgress } = await supabase.from('user_progress').select('id, word_id').limit(1000);
        const { data: allWords } = await supabase.from('words').select('id').limit(20000);
        const wordIds = new Set(allWords.map(w => w.id));

        const orphans = allProgress.filter(p => !wordIds.has(p.word_id));
        console.log("Total Progress Records:", allProgress.length);
        console.log("Total Words in DB:", allWords.length);
        console.log("Orphaned Progress Records:", orphans.length);

        if (orphans.length > 0) {
            console.log("Example orphaned word_id:", orphans[0].word_id);
            // Check if that word_id exists but maybe under a different name or something?
            const { data: missingWord } = await supabase.from('words').select('*').eq('id', orphans[0].word_id).maybeSingle();
            console.log("Direct lookup of missing word_id result:", missingWord);
        }

        const { data: joinTest } = await supabase.from('user_progress').select('id, word_id, words(swedish_word)').limit(5);
        console.log("Join test result samples:", JSON.stringify(joinTest, null, 2));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
