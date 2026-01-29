
import { createClient } from '@supabase/supabase-js';

const url = "https://bhblsdgfzmnttwqsherk.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYmxzZGdmem1udHR3cXNoZXJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4NzYyNCwiZXhwIjoyMDg0ODYzNjI0fQ.U5SejPbDU1Cgm4RWrcgXJ8Zuvga9X_QgL4UTTS3uREM";

const supabase = createClient(url, key);

async function check() {
    try {
        const uid = "93232064-18dc-4d45-8ee8-c0009bb68356";
        const { data: progress, error } = await supabase
            .from('user_progress')
            .select('*, words!inner(swedish_word)')
            .eq('user_id', uid)
            .limit(1);

        if (error) console.error(error);

        if (progress && progress.length > 0) {
            console.log("Joined result structure:");
            console.log(JSON.stringify(progress[0], null, 2));
            const wordsField = progress[0].words;
            console.log("Is words an array?", Array.isArray(wordsField));
            console.log("words field content:", wordsField);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
