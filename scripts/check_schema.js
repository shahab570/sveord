
import { createClient } from '@supabase/supabase-js';

const url = "https://bhblsdgfzmnttwqsherk.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYmxzZGdmem1udHR3cXNoZXJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4NzYyNCwiZXhwIjoyMDg0ODYzNjI0fQ.U5SejPbDU1Cgm4RWrcgXJ8Zuvga9X_QgL4UTTS3uREM";

const supabase = createClient(url, key);

async function check() {
    try {
        console.log("--- Checking user_progress schema ---");
        const { data: cols, error: cErr } = await supabase.from('user_progress').select('*').limit(1);
        if (cErr) console.error(cErr);
        if (cols && cols.length > 0) {
            console.log("Columns in user_progress:", Object.keys(cols[0]));
        }

        console.log("\n--- Testing Join ---");
        // Test with both singular and plural
        const { data: joinPlural, error: errP } = await supabase.from('user_progress').select('*, words(swedish_word)').limit(1);
        console.log("Join 'words' (plural) success:", !errP);
        if (joinPlural) console.log("Sample join result:", JSON.stringify(joinPlural[0]));

        const { data: joinSingular, error: errS } = await supabase.from('user_progress').select('*, word(swedish_word)').limit(1);
        console.log("Join 'word' (singular) success:", !errS);
        if (joinSingular) console.log("Sample join result:", JSON.stringify(joinSingular[0]));

        console.log("\n--- Checking for orphans ---");
        const { data: allProgress } = await supabase.from('user_progress').select('id, word_id').limit(1000);
        const { data: allWords } = await supabase.from('words').select('id');
        const wordIds = new Set(allWords.map(w => w.id));

        const orphans = allProgress.filter(p => !wordIds.has(p.word_id));
        console.log("Total Progress Records:", allProgress.length);
        console.log("Orphaned Progress Records (no matching word_id):", orphans.length);
        if (orphans.length > 0) {
            console.log("Sample orphans:", JSON.stringify(orphans.slice(0, 5)));
        }

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
