
import { db } from './src/services/db';

async function diagnoseQuizzes() {
    try {
        const quizzes = await db.quizzes.toArray();
        console.log(`Total quizzes: ${quizzes.length}`);

        if (quizzes.length > 0) {
            const lastQuiz = quizzes[quizzes.length - 1];
            console.log('--- Inspecting Last Quiz ---');
            lastQuiz.questions.forEach((q, i) => {
                const ca = q.correctAnswer;
                console.log(`Q${i + 1}: "${q.targetWord || "N/A"}"`);
                console.log(`  correctAnswer type: ${typeof ca}`);
                console.log(`  correctAnswer value:`, ca);
                console.log(`  Options:`, q.options?.map(o => o.word).join(', '));
            });
        }
    } catch (e) {
        console.error('Diagnosis failed:', e);
    }
}

diagnoseQuizzes();
