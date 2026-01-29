
const url = "https://bhblsdgfzmnttwqsherk.supabase.co/rest/v1/words?select=id,swedish_word&limit=1";
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
        console.log("Words Sample Data:", JSON.stringify(data));

        const progressRes = await fetch("https://bhblsdgfzmnttwqsherk.supabase.co/rest/v1/user_progress?select=id&limit=1", {
            headers: {
                "apikey": key,
                "Authorization": `Bearer ${key}`
            }
        });
        const progressData = await progressRes.json();
        console.log("Progress Sample Data:", JSON.stringify(progressData));
    } catch (e) {
        console.error(e);
    }
}
check();
