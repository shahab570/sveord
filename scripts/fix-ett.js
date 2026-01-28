
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bhblsdgfzmnttwqsherk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYmxzZGdmem1udHR3cXNoZXJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4NzYyNCwiZXhwIjoyMDg0ODYzNjI0fQ.U5SejPbDU1Cgm4RWrcgXJ8Zuvga9X_QgL4UTTS3uREM';

async function main() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false }
    });

    console.log('=== Fixing Kelly Word #7 (ett) ===\n');

    // Update 'ett' to be A1 / ID 7
    const { data, error } = await supabase
        .from('words')
        .update({ kelly_source_id: 7, kelly_level: 'A1' })
        .ilike('swedish_word', 'ett')
        .select();

    if (error) {
        console.error('Update failed:', error);
    } else {
        console.log('Update successful:', data);
    }
}

main().catch(console.error);
