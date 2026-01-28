
import { WordData } from '../types/word';

export type QuestionType = 'synonym' | 'antonym';

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

export const generateQuiz = (
  words: { id: number; swedish_word: string; word_data: any }[],
  type: QuestionType,
  count: number = 10
): QuizQuestion[] => {
  const questions: QuizQuestion[] = [];

  // Create a quick lookup map for meanings of ALL words (for options)
  const meaningMap = new Map<string, string>();
  words.forEach(w => {
    if (w.word_data?.meanings?.[0]?.english) {
      meaningMap.set(w.swedish_word, w.word_data.meanings[0].english);
    }
  });

  // 1. Filter usable words
  const validWords = words.filter(word => {
    if (!word.word_data) return false;
    const data = word.word_data as WordData;
    if (type === 'synonym') {
      return data.synonyms && data.synonyms.length > 0;
    } else {
      return data.antonyms && data.antonyms.length > 0;
    }
  });

  if (validWords.length < 4) {
    console.warn('Not enough words with metadata to generate a quiz');
    return [];
  }

  // 2. Select random target words
  const shuffledWords = shuffle(validWords);
  const selectedTargets = shuffledWords.slice(0, count);

  selectedTargets.forEach(target => {
    const data = target.word_data as WordData;

    // 3. Determine correct answer
    // For now, take the first one or a random one from the list
    const sourceList = type === 'synonym' ? data.synonyms : data.antonyms;
    const correctAnswerText = sourceList[Math.floor(Math.random() * sourceList.length)];

    // 4. Generate distractors
    const otherWords = validWords.filter(w => w.id !== target.id);
    const distractors = shuffle(otherWords)
      .slice(0, 3)
      .map(w => w.swedish_word);

    // 5. Build Options with Meanings
    // We try to find meanings for the correct answer and distractors if they exist in our DB
    const rawOptions = shuffle([correctAnswerText, ...distractors]);

    const options: QuizOption[] = rawOptions.map(optText => ({
      word: optText,
      meaning: meaningMap.get(optText) // Try to look up meaning if this word exists in our DB
    }));

    questions.push({
      id: `${target.id}-${Date.now()}`,
      type,
      targetWord: target.swedish_word,
      targetMeaning: data.meanings?.[0]?.english,
      correctAnswer: correctAnswerText,
      options
    });
  });

  return questions;
};
