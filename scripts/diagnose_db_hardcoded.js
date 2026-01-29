
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://bhblsdgfzmnttwqsherk.supabase.co";
const supabaseKey = "sb_publishable_waMqmpKauNXDBM8ktHMtFQ_YAVyge6A"; // Using publishable key, hope it works for count

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    try {
        console.log('--- DIAGNOSING SUPABASE STATE ---');

        const { count: wordCount, error: wError } = await supabase.from('words').select('*', { count: 'exact', head: true });
        if (wError) console.error('Words Error:', wError);
        console.log('Total Words:', wordCount);

        const { count: progressCount, error: pError } = await supabase.from('user_progress').select('*', { count: 'exact', head: true });
        if (pError) console.error('Progress Error:', pError);
        console.log('Total User Progress Records:', progressCount);

        const { data: samples, error: sError } = await supabase.from('user_progress').select('*').limit(3);
        if (sError) console.error('Samples Error:', sError);
        console.log('Sample Progress Records:', JSON.stringify(samples, null, 2));
    } catch (e) {
        console.error('Fatal Error:', e);
    }
    process.exit(0);
}

diagnose();
