const supabaseUrl = "https://bhblsdgfzmnttwqsherk.supabase.co";
const supabaseKey = "sb_publishable_waMqmpKauNXDBM8ktHMtFQ_YAVyge6A";

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

        console.log('--- SUPABASE LIVE COUNTS ---');
        console.log('TOTAL_UNIQUE_ROWS:', total);
        console.log('KELLY_LIST_ROWS:', kelly);
        console.log('FREQ_LIST_ROWS:', frequency);
        console.log('SIDOR_LIST_ROWS:', sidor);

        // Check if there are any words with 'is_ft'
        const ft = await fetchCounts('is_ft=eq.1');
        console.log('FT_LIST_ROWS:', ft);

    } catch (err) {
        console.error('Error fetching from Supabase:', err.message);
    }
}

check();
