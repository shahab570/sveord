const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

async function testFetch() {
    // Try fetching just one word
    const url = `${supabaseUrl}/rest/v1/words?select=*&limit=1`;
    console.log(`Fetching: ${url}`);

    try {
        const res = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`Body: ${text.substring(0, 500)}`); // Show first 500 chars

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testFetch();
