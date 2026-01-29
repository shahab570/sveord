
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function diagnose() {
    console.log('--- DIAGNOSING SUPABASE STATE ---');

    const { count: wordCount } = await supabase.from('words').select('*', { count: 'exact', head: true });
    console.log('Total Words:', wordCount);

    const { count: progressCount } = await supabase.from('user_progress').select('*', { count: 'exact', head: true });
    console.log('Total User Progress Records:', progressCount);

    const { data: samples } = await supabase.from('user_progress').select('*, words(swedish_word)').limit(5);
    console.log('Sample Progress (should have word join):', JSON.stringify(samples, null, 2));

    process.exit(0);
}

diagnose();
