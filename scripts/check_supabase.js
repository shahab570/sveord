
const url = "https://bhblsdgfzmnttwqsherk.supabase.co/rest/v1/words?select=count";
const key = "sb_publishable_waMqmpKauNXDBM8ktHMtFQ_YAVyge6A";

async function check() {
    try {
        const res = await fetch(url, {
            headers: {
                "apikey": key,
                "Authorization": `Bearer ${key}`,
                "Prefer": "count=exact"
            }
        });
        const count = res.headers.get("Content-Range");
        console.log("Words Count from Supabase Header:", count);

        const progressRes = await fetch("https://bhblsdgfzmnttwqsherk.supabase.co/rest/v1/user_progress?select=count", {
            headers: {
                "apikey": key,
                "Authorization": `Bearer ${key}`,
                "Prefer": "count=exact"
            }
        });
        console.log("Progress Count from Supabase Header:", progressRes.headers.get("Content-Range"));
    } catch (e) {
        console.error(e);
    }
}
check();
