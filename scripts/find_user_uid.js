
import { createClient } from '@supabase/supabase-js';

const url = "https://bhblsdgfzmnttwqsherk.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYmxzZGdmem1udHR3cXNoZXJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4NzYyNCwiZXhwIjoyMDg0ODYzNjI0fQ.U5SejPbDU1Cgm4RWrcgXJ8Zuvga9X_QgL4UTTS3uREM";

const supabase = createClient(url, key);

async function check() {
    try {
        const { data, error } = await supabase.from('profiles').select('id, email').eq('email', 'mjsahab570@gmail.com').single();
        console.log("User Profile:", JSON.stringify(data));
        if (error) console.error(error);

        if (data) {
            const { count, error: pError } = await supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('user_id', data.id);
            console.log("User Progress Count:", count);
            if (pError) console.error(pError);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
