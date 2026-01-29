import { db } from './src/services/db';

async function cleanupFailedGenerations() {
    const words = await db.words.toArray();
    let count = 0;

    for (const word of words) {
        const meaning = word.word_data?.meanings?.[0]?.english;
        if (meaning && (
            meaning.includes("Generation Failed") ||
            meaning.includes("Analyzing") ||
            meaning.includes("Failed to generate")
        )) {
            console.log(`Cleaning up failed generation for: ${word.swedish_word}`);
            // Remove word_data to allow re-generation
            await db.words.update(word.swedish_word, { word_data: undefined });
            count++;
        }
    }

    console.log(`Finished cleaning ${count} words.`);
}

cleanupFailedGenerations();
