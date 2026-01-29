
import { createClient } from '@supabase/supabase-js';

const url = "https://bhblsdgfzmnttwqsherk.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYmxzZGdmem1udHR3cXNoZXJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4NzYyNCwiZXhwIjoyMDg0ODYzNjI0fQ.U5SejPbDU1Cgm4RWrcgXJ8Zuvga9X_QgL4UTTS3uREM";

const supabase = createClient(url, key);

async function check() {
    try {
        const uid = "93232064-18dc-4d45-8ee8-c0009bb68356";
        const { data: progress, error } = await supabase
            .from('user_progress')
            .select('*, words(swedish_word)')
            .eq('user_id', uid);

        if (error) console.error(error);

        console.log("Total records found for user:", progress ? progress.length : 0);
        if (progress && progress.length > 0) {
            const learnedCount = progress.filter(p => p.is_learned).length;
            console.log("Learned records (is_learned=true):", learnedCount);
            console.log("Sample record:", JSON.stringify(progress[0], null, 2));

            const nullWords = progress.filter(p => !p.words);
            console.log("Records with missing joined word:", nullWords.length);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
