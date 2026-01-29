
import { createClient } from '@supabase/supabase-js';

const url = "https://bhblsdgfzmnttwqsherk.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYmxzZGdmem1udHR3cXNoZXJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4NzYyNCwiZXhwIjoyMDg0ODYzNjI0fQ.U5SejPbDU1Cgm4RWrcgXJ8Zuvga9X_QgL4UTTS3uREM";

const supabase = createClient(url, key);

async function check() {
    try {
        const { count: wordCount, error: wError } = await supabase.from('words').select('*', { count: 'exact', head: true });
        console.log("Words Count (Service Key):", wordCount);
        if (wError) console.error(wError);

        const { count: progressCount, error: pError } = await supabase.from('user_progress').select('*', { count: 'exact', head: true });
        console.log("Progress Count (Service Key):", progressCount);
        if (pError) console.error(pError);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
