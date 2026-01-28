
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bhblsdgfzmnttwqsherk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYmxzZGdmem1udHR3cXNoZXJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4NzYyNCwiZXhwIjoyMDg0ODYzNjI0fQ.U5SejPbDU1Cgm4RWrcgXJ8Zuvga9X_QgL4UTTS3uREM';

async function main() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false }
    });

    console.log('=== Debugging Kelly Word #7 (ett) ===\n');

    // 1. Check ALL "ett" rows
    const { data: ettRows, error: err7 } = await supabase
        .from('words')
        .select('*')
        .ilike('swedish_word', 'ett');

    if (ettRows && ettRows.length > 0) {
        console.log(`Found ${ettRows.length} row(s) for 'ett':`);
        ettRows.forEach(w => {
            console.log(`- ID=${w.id}, KellyID=${w.kelly_source_id}, Level=${w.kelly_level}`);
        });
    } else {
        console.log("Word 'ett' not found.");
    }

    // 2. Check by ID directly
    const { data: id7, error: errId7 } = await supabase
        .from('words')
        .select('*')
        .eq('kelly_source_id', 7)
        .single();

    if (id7) {
        console.log(`Word with KellyID=7: ${id7.swedish_word}`);
    } else {
        console.log("No word found with KellyID=7");
    }
}

main().catch(console.error);
