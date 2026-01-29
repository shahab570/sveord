
const url = "https://bhblsdgfzmnttwqsherk.supabase.co/rest/v1/words?id=eq.1&select=*";
const key = "sb_publishable_waMqmpKauNXDBM8ktHMtFQ_YAVyge6A";

async function check() {
    try {
        const res = await fetch(url, {
            headers: {
                "apikey": key,
                "Authorization": `Bearer ${key}`
            }
        });
        const data = await res.json();
        console.log("Word ID=1 Data (Anon Key):", JSON.stringify(data));
        console.log("Status:", res.status);
    } catch (e) {
        console.error(e);
    }
}
check();
