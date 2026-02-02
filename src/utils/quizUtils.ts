import { WordData } from '../types/word';
import { db } from '../services/db';
import { generateAIQuizData } from '../services/geminiApi';

export type QuestionType = 'synonym' | 'antonym' | 'meaning' | 'context' | 'dialogue' | 'translation' | 'recall' | 'similarity';

export const MAX_QUIZ_TARGET_LIMIT = 10; // Maximum number of times a word should be the primary target of a quiz

export interface QuizOption {
  word: string;
  meaning?: string;
  swedishWord?: string; // The associated Swedish word for lookups
}

export interface QuizBlank {
  index: number;
  answer: string;
  options: string[];
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  targetWord?: string;
  targetMeaning?: string;
  sentence?: string; // For 'context' type
  dialogue?: Array<{ speaker: string; text: string; translation?: string }>; // For 'dialogue' type
  blanks?: QuizBlank[]; // For context and dialogue types
  correctAnswer?: string; // For MCQ types
  options?: QuizOption[]; // For MCQ types
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

// Simple edit distance helper
const getEditDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

export const generateQuiz = async (
  words: { id: number; swedish_word: string; word_data: any; progress?: { learned_date?: string | null } }[],
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

  // 2. Filter and Rank words
  // First, filter out words that have already reached the global practice limit
  const validWords = words.filter(w => {
    if (isInvalidMeaning(w.word_data?.meanings?.[0]?.english)) return false;
    const usage = usageMap.get(w.swedish_word);
    return (usage?.targetCount || 0) < MAX_QUIZ_TARGET_LIMIT;
  });

  if (validWords.length === 0) {
    console.warn('All learned words have reached the mastery limit (MAX_QUIZ_TARGET_LIMIT)');
    return null;
  }

  // Rank words by usage frequency to strictly prioritize "under-practiced" ones
  // Primary: targetCount asc, Secondary: learned_date desc (newest first)
  const rankedPool = validWords.sort((a, b) => {
    const aUsage = usageMap.get(a.swedish_word)?.targetCount || 0;
    const bUsage = usageMap.get(b.swedish_word)?.targetCount || 0;

    if (aUsage !== bUsage) return aUsage - bUsage;

    // Tie-break: newer learned words first
    const aDate = a.progress?.learned_date || '';
    const bDate = b.progress?.learned_date || '';
    return bDate.localeCompare(aDate);
  });

  // Take the target candidates from the least-used words
  const targetPool = rankedPool.slice(0, Math.max(count * 2, 20));
  const optionPool = words.filter(w => !isInvalidMeaning(w.word_data?.meanings?.[0]?.english)); // Options can be any valid word

  if (targetPool.length === 0) {
    console.warn('No words available for quiz generation');
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
    if (type === 'meaning' || type === 'translation' || type === 'recall' || type === 'similarity') return data.meanings && data.meanings.length > 0;
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

      const rawOptions = shuffle([
        { word: correctAnswerText, swedishWord: target.swedish_word },
        ...selectedDistractorWords.map(w => ({ word: w.word_data.meanings[0].english, swedishWord: w.swedish_word }))
      ]);

      questions.push({
        id: `${target.id}-${Date.now()}`,
        type,
        targetWord: target.swedish_word,
        targetMeaning: correctAnswerText,
        correctAnswer: correctAnswerText,
        options: rawOptions
      });
    } else if (type === 'similarity') {
      const correctAnswerText = target.swedish_word;
      const targetMeaningText = data.meanings[0].english;

      // Find words that look similar (Edit distance <= 2)
      const distractors = optionPool
        .filter(w => w.swedish_word !== target.swedish_word)
        .sort((a, b) => {
          const distA = getEditDistance(target.swedish_word, a.swedish_word);
          const distB = getEditDistance(target.swedish_word, b.swedish_word);
          return distA - distB;
        })
        .slice(0, 3);

      distractors.forEach(w => {
        const u = updatedUsages.get(w.swedish_word) || { target: 0, option: 0 };
        u.option += 1;
        updatedUsages.set(w.swedish_word, u);
      });

      const rawOptions = shuffle([
        { word: correctAnswerText, swedishWord: target.swedish_word, meaning: targetMeaningText },
        ...distractors.map(w => ({
          word: w.swedish_word,
          swedishWord: w.swedish_word,
          meaning: meaningMap.get(w.swedish_word)
        }))
      ]);

      questions.push({
        id: `${target.id}-${Date.now()}`,
        type,
        targetWord: targetMeaningText, // English meaning is the prompt
        targetMeaning: correctAnswerText, // Swedish word is the answer
        correctAnswer: correctAnswerText,
        options: rawOptions
      });
    } else if (type === 'recall') {
      const correctAnswerText = target.swedish_word;
      const targetMeaningText = data.meanings[0].english;

      questions.push({
        id: `${target.id}-${Date.now()}`,
        type,
        targetWord: targetMeaningText, // English prompt
        targetMeaning: correctAnswerText, // Swedish answer
        correctAnswer: correctAnswerText,
        options: [] // No options for recall mode
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

      const rawOptions = shuffle([
        { word: correctAnswerText, swedishWord: correctAnswerText, meaning: data.meanings?.[0]?.english },
        ...selectedDistractorWords.map(w => ({
          word: w.swedish_word,
          swedishWord: w.swedish_word,
          meaning: meaningMap.get(w.swedish_word)
        }))
      ]);

      questions.push({
        id: `${target.id}-${Date.now()}`,
        type,
        targetWord: target.swedish_word,
        targetMeaning: data.meanings?.[0]?.english,
        correctAnswer: correctAnswerText,
        options: rawOptions
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




export const sanitizeQuestions = (questions: QuizQuestion[]): QuizQuestion[] => {
  return questions.map(q => {
    const sanitized = { ...q };

    // Common cleaning function to remove punctuation/spacing that breaks comparison
    const clean = (s: any) => {
      if (typeof s !== 'string') return s;
      // Remove trailing punctuation and extra spaces, but keep internal spaces for phrases
      return s.trim().replace(/[.,!?;]$/, '');
    };

    // 1. Sanitize Correct Answer (Must be a string for internal comparison logic)
    if (sanitized.correctAnswer) {
      if (typeof sanitized.correctAnswer === 'object' && sanitized.correctAnswer !== null) {
        sanitized.correctAnswer = (sanitized.correctAnswer as any).word || (sanitized.correctAnswer as any).text || JSON.stringify(sanitized.correctAnswer);
      }
      sanitized.correctAnswer = clean(String(sanitized.correctAnswer));
    }

    // 2. Sanitize Options (Convert strings to objects if necessary, and clean words)
    if (sanitized.options && Array.isArray(sanitized.options)) {
      sanitized.options = sanitized.options.map(opt => {
        let word = "";
        let meaning = "";
        let swedishWord = "";

        if (typeof opt === 'string') {
          word = opt;
        } else if (typeof opt === 'object' && opt !== null) {
          word = (opt as any).word || (opt as any).text || "";
          meaning = (opt as any).meaning || "";
          swedishWord = (opt as any).swedishWord || "";
        }

        return {
          word: clean(word),
          meaning: clean(meaning),
          swedishWord: clean(swedishWord)
        };
      });
    }

    // 3. Dialogue special handling
    if (sanitized.type === 'dialogue') {
      if (sanitized.dialogue) {
        sanitized.dialogue = sanitized.dialogue.map(turn => ({
          ...turn,
          text: String(turn.text || ""),
          translation: String(turn.translation || "")
        }));
      }
      if (sanitized.blanks) {
        sanitized.blanks = sanitized.blanks.map(blank => ({
          ...blank,
          answer: clean(typeof blank.answer === 'object' ? (blank.answer as any).word || (blank.answer as any).answer || JSON.stringify(blank.answer) : String(blank.answer || "")),
          options: (blank.options || []).map(opt => clean(typeof opt === 'object' ? (opt as any).word || (opt as any).option || JSON.stringify(opt) : String(opt || "")))
        }));
      }
    }

    // 4. Final verification: ensure correctAnswer exists IN options
    // (If AI missed it, we manually add it or fix the closest match to prevent a "dead" question)
    if (sanitized.correctAnswer && sanitized.options && sanitized.options.length > 0) {
      const match = sanitized.options.find(o => o.word.toLowerCase() === sanitized.correctAnswer?.toLowerCase());
      if (!match) {
        // If not found, force the first option to be correct to avoid a broken UI
        console.warn(`[Sanitize] Correct answer "${sanitized.correctAnswer}" not found in options. Syncing...`);
        sanitized.options[0].word = sanitized.correctAnswer;
      }
    }

    return sanitized;
  });
};

export const generateAIQuiz = async (
  words: { swedish_word: string; word_data: any; progress?: { learned_date?: string | null } }[],
  type: QuestionType,
  apiKey: string,
  count: number = 10
): Promise<number | null> => {
  // 1. Filter words for quality
  const isInvalidMeaning = (m?: string) => {
    if (!m) return true;
    const lower = m.toLowerCase();
    return lower.includes("failed") || lower.includes("analyzing") || m.length < 3;
  };

  const swedishWords = words.map(w => w.swedish_word);
  const usageList = await db.wordUsage.where('wordSwedish').anyOf(swedishWords).toArray();
  const usageMap = new Map(usageList.map(u => [u.wordSwedish, u]));

  const validWords = words.filter(w => {
    if (isInvalidMeaning(w.word_data?.meanings?.[0]?.english)) return false;
    const usage = usageMap.get(w.swedish_word);
    return (usage?.targetCount || 0) < MAX_QUIZ_TARGET_LIMIT;
  });

  if (validWords.length === 0) return null;

  const rankedPool = validWords.sort((a, b) => {
    const aUsage = usageMap.get(a.swedish_word)?.targetCount || 0;
    const bUsage = usageMap.get(b.swedish_word)?.targetCount || 0;
    if (aUsage !== bUsage) return aUsage - bUsage;

    // Newer words first
    const aDate = a.progress?.learned_date || '';
    const bDate = b.progress?.learned_date || '';
    return bDate.localeCompare(aDate);
  });

  const targetPool = rankedPool.slice(0, Math.max(count * 2, 20));

  if (targetPool.length === 0) return null;

  // 2. Select words and generate via BATCH API call
  const selectedWords = shuffle(targetPool).slice(0, count);
  // Single AI call for the entire set of words to minimize API usage
  const aiQuestions = await generateAIQuizData(selectedWords, type, apiKey);

  if (!aiQuestions || aiQuestions.length === 0) return null;

  // 3. Map to internal schema and save
  const questions: QuizQuestion[] = sanitizeQuestions(aiQuestions.map((q, i) => ({
    ...q,
    id: `${Date.now()}-${i}`,
    type: q.type as QuestionType
  })));

  // Track usage
  for (const word of selectedWords) {
    const existing = await db.wordUsage.get(word.swedish_word);
    await db.wordUsage.put({
      wordSwedish: word.swedish_word,
      targetCount: (existing?.targetCount || 0) + 1,
      optionCount: (existing?.optionCount || 0) + 3,
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
