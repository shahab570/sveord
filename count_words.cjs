const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Using public key, strict count might work if public access allowed on 'words' table reads (usually is for this app)

const supabase = createClient(supabaseUrl, supabaseKey);

async function countWords() {
    // Count total words excluding FT if user wants them removed?
    // First, just total.
    const { count, error } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("Error counting:", error);
    } else {
        console.log(`Total Words in Database: ${count}`);
    }

    // Count FT
    const { count: ftCount } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true })
        .eq('is_ft', true);

    console.log(`FT Words: ${ftCount}`);
    console.log(`Unified Dictionary (Total - FT): ${count - ftCount}`);
}

countWords();
