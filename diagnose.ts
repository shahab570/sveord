import { db } from './src/services/db';

async function diagnose() {
    const allProgress = await db.progress.toArray();
    const learnedToday = allProgress.filter(p => {
        if (!p.is_learned || !p.learned_date) return false;
        const date = new Date(p.learned_date);
        const today = new Date();
        return date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();
    });

    console.log(`Progress records for today: ${learnedToday.length}`);

    for (const p of learnedToday) {
        const word = await db.words.get(p.word_swedish);
        if (!word) {
            console.log(`MISSING WORD: ${p.word_swedish}`);
        } else {
            console.log(`Found word: ${p.word_swedish}`);
        }
    }
}

diagnose();
