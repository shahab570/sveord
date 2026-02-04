const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

async function fetchWithTimeout(url, options, timeout = 7000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function check() {
    const fetchCounts = async (filter = '') => {
        const url = `${supabaseUrl}/rest/v1/words?select=count&${filter}`;

        const res = await fetchWithTimeout(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Range-Unit': 'items',
                'Prefer': 'count=exact'
            }
        });
        const contentRange = res.headers.get('content-range');
        return parseInt(contentRange?.split('/')[1] || '0');
    }

    try {
        const total = await fetchCounts();
        const kelly = await fetchCounts('kelly_level=not.is.null');
        const frequency = await fetchCounts('frequency_rank=not.is.null');
        const sidor = await fetchCounts('sidor_rank=not.is.null');

        console.log('--- SUPABASE DATABASE STATS ---');
        console.log('TOTAL_UNIQUE_ROWS:', total);
        console.log('KELLY_LIST_ROWS:', kelly);
        console.log('FREQ_LIST_ROWS:', frequency);
        console.log('SIDOR_LIST_ROWS:', sidor);

        // Check for "Kelly 8000" claim specifically
        // Maybe try to count anything that has kelly_level? (Already done above)

    } catch (err) {
        console.error('Error fetching from Supabase:', err.message);
    }
}

check();
