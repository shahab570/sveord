import { WordData } from '../types/word';
import { db } from '../services/db';

export type QuestionType = 'synonym' | 'antonym' | 'meaning';

export interface QuizOption {
  word: string;
  meaning?: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  targetWord: string;
  targetMeaning?: string; // English definition of the target word
  correctAnswer: string;
  options: QuizOption[]; // Options are now objects with potential meanings
}

// Helper to shuffle an array
const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const generateQuiz = async (
  words: { id: number; swedish_word: string; word_data: any }[],
  type: QuestionType,
  count: number = 10
): Promise<number | null> => {
  // 0. Validation helper
  const isInvalidMeaning = (m?: string) => {
    if (!m) return true;
    const lower = m.toLowerCase();
    return (
      lower.includes("generation failed") ||
      lower.includes("analyzing") ||
      lower.includes("failed to generate") ||
      m.length < 3
    );
  };

  // 1. Fetch usage data
  const swedishWords = words.map(w => w.swedish_word);
  const usageList = await db.wordUsage.where('wordSwedish').anyOf(swedishWords).toArray();
  const usageMap = new Map(usageList.map(u => [u.wordSwedish, u]));

  // 2. Filter words by strategic limits AND data quality
  // Target limit: 3 times. Option limit: 4 times.
  const targetPool = words.filter(w =>
    (usageMap.get(w.swedish_word)?.targetCount || 0) < 3 &&
    !isInvalidMeaning(w.word_data?.meanings?.[0]?.english)
  );

  const optionPool = words.filter(w =>
    (usageMap.get(w.swedish_word)?.optionCount || 0) < 4 &&
    !isInvalidMeaning(w.word_data?.meanings?.[0]?.english)
  );

  if (targetPool.length === 0) {
    console.warn('No more words available for target questions (hit limits or invalid data)');
    return null;
  }

  const questions: QuizQuestion[] = [];
  const meaningMap = new Map<string, string>();
  words.forEach(w => {
    if (w.word_data?.meanings?.[0]?.english) {
      meaningMap.set(w.swedish_word, w.word_data.meanings[0].english);
    }
  });

  // 3. Filter usable target words based on metadata availability
  const validTargets = targetPool.filter(word => {
    if (!word.word_data) return false;
    const data = word.word_data as WordData;
    if (type === 'synonym') return data.synonyms && data.synonyms.length > 0;
    if (type === 'antonym') return data.antonyms && data.antonyms.length > 0;
    if (type === 'meaning') return data.meanings && data.meanings.length > 0;
    return false;
  });

  if (validTargets.length === 0) {
    console.warn('Not enough valid target words with metadata to generate a quiz');
    return null;
  }

  const shuffledTargets = shuffle(validTargets).slice(0, count);
  const updatedUsages = new Map<string, { target: number; option: number }>();

  shuffledTargets.forEach(target => {
    const data = target.word_data as WordData;

    // Auto-repair: If we somehow picked a word that has "Generation Failed" in the DB (even though we filtered), 
    // clear it out to allow re-generation.
    if (isInvalidMeaning(data.meanings?.[0]?.english)) {
      db.words.update(target.swedish_word, { word_data: undefined });
      return;
    }

    // Track target usage
    const targetUsage = updatedUsages.get(target.swedish_word) || { target: 0, option: 0 };
    targetUsage.target += 1;
    updatedUsages.set(target.swedish_word, targetUsage);

    if (type === 'meaning') {
      const correctAnswerText = data.meanings[0].english;
      const otherWordsWithMeanings = optionPool.filter(w =>
        w.swedish_word !== target.swedish_word &&
        w.word_data?.meanings?.[0]?.english &&
        w.word_data.meanings[0].english !== correctAnswerText
      );

      const selectedDistractorWords = shuffle(otherWordsWithMeanings).slice(0, 3);
      selectedDistractorWords.forEach(w => {
        const u = updatedUsages.get(w.swedish_word) || { target: 0, option: 0 };
        u.option += 1;
        updatedUsages.set(w.swedish_word, u);
      });

      const rawOptions = shuffle([correctAnswerText, ...selectedDistractorWords.map(w => w.word_data.meanings[0].english)]);
      questions.push({
        id: `${target.id}-${Date.now()}`,
        type,
        targetWord: target.swedish_word,
        targetMeaning: correctAnswerText,
        correctAnswer: correctAnswerText,
        options: rawOptions.map(optText => ({ word: optText }))
      });
    } else {
      const sourceList = type === 'synonym' ? data.synonyms : data.antonyms;
      const correctAnswerText = sourceList[Math.floor(Math.random() * sourceList.length)];

      const otherWords = optionPool.filter(w => w.swedish_word !== target.swedish_word);
      const selectedDistractorWords = shuffle(otherWords).slice(0, 3);
      selectedDistractorWords.forEach(w => {
        const u = updatedUsages.get(w.swedish_word) || { target: 0, option: 0 };
        u.option += 1;
        updatedUsages.set(w.swedish_word, u);
      });

      const rawOptions = shuffle([correctAnswerText, ...selectedDistractorWords.map(w => w.swedish_word)]);
      questions.push({
        id: `${target.id}-${Date.now()}`,
        type,
        targetWord: target.swedish_word,
        targetMeaning: data.meanings?.[0]?.english,
        correctAnswer: correctAnswerText,
        options: rawOptions.map(optText => ({
          word: optText,
          meaning: meaningMap.get(optText)
        }))
      });
    }
  });

  // 4. Save Usage and Quiz
  for (const [word, counts] of updatedUsages.entries()) {
    const existing = await db.wordUsage.get(word);
    await db.wordUsage.put({
      wordSwedish: word,
      targetCount: (existing?.targetCount || 0) + counts.target,
      optionCount: (existing?.optionCount || 0) + counts.option,
    });
  }

  const quizId = await db.quizzes.add({
    type,
    questions,
    isPracticed: 0,
    createdAt: new Date().toISOString(),
  });

  return quizId;
};

export const markQuizPracticed = async (id: number) => {
  await db.quizzes.update(id, {
    isPracticed: 1,
    practicedAt: new Date().toISOString()
  });
};
