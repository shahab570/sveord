import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { syncQueue } from "@/services/syncQueue";
import { validateProgress, sanitizeProgress } from "@/services/dataValidation";
import { db, LocalWord, LocalUserProgress } from "@/services/db";
import type { WordData } from "@/types/word";

export interface Word {
  id: number;
  swedish_word: string;
  created_at: string;
  word_data: WordData | null;
}

export interface UserProgress {
  id: string;
  user_id: string;
  word_id: number;
  is_learned: boolean | number;
  learned_date: string | null;
  user_meaning: string | null;
  custom_spelling: string | null;
  created_at: string;
  updated_at: string;
  // SRS Fields
  srs_next_review?: string;
  srs_interval?: number;
  srs_ease?: number;
  is_reserve?: boolean | number;
  reserved_at?: string | null;
}

export interface WordWithProgress extends Word {
  progress?: UserProgress;
  practice_count?: number;
}

export interface UploadHistoryItem {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  records_processed: number;
  list_type: string | null;
  uploaded_at: string;
}

// CEFR levels for categorization
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "D1"] as const;

export function useWords(filters?: {
  learnedOnly?: boolean;
  search?: string;
  listType?: "reserve";
}) {
  const { user } = useAuth();

  return useLiveQuery(async () => {
    // OPTIMIZATION: For Reserve or Learned lists, query Progress table FIRST
    // This avoids loading 13,000 words into memory when we only want the 10-50 saved words.
    if (!filters?.search && (filters?.listType === "reserve" || filters?.learnedOnly)) {
      let progressQuery = db.progress.toCollection();

      if (filters?.listType === "reserve") {
        progressQuery = db.progress.where('is_reserve').equals(1);
      } else if (filters?.learnedOnly) {
        progressQuery = db.progress.where('is_learned').equals(1);
      }

      const progressItems = await progressQuery.toArray();
      const filteredProgressItems = filters?.listType === "reserve"
        ? progressItems.filter(p => !p.is_learned)
        : progressItems;
      const wordIds = filteredProgressItems.map(p => p.word_id).filter((id): id is number => !!id);

      // If no reserved words, return empty immediately
      if (wordIds.length === 0) return [];

      const words = await db.words.where('id').anyOf(wordIds).toArray();
      const progressMap = new Map(filteredProgressItems.map(p => [p.word_id, p]));

      // Also get usage for just these words
      const swedishWords = words.map(w => w.swedish_word);
      const usageList = await db.wordUsage.where('wordSwedish').anyOf(swedishWords).toArray();
      const usageMap = new Map(usageList.map(u => [u.wordSwedish, u]));

      return words.map(w => {
        const progress = progressMap.get(w.id);
        const usage = usageMap.get(w.swedish_word);
        return {
          id: w.id || 0,
          swedish_word: w.swedish_word,
          created_at: "",
          word_data: w.word_data || null,
          progress: progress ? {
            id: progress.id || "",
            user_id: user?.id || "",
            word_id: w.id || 0,
            is_learned: !!progress.is_learned,
            learned_date: progress.learned_date || null,
            user_meaning: progress.user_meaning || null,
            custom_spelling: progress.custom_spelling || null,
            created_at: "",
            updated_at: "",
            srs_next_review: progress.srs_next_review,
            is_reserve: !!progress.is_reserve,
            // unified_level: progress.unified_level, // Not in DB schema
          } : undefined,
          practice_count: usage ? (usage.targetCount || 0) : 0,
          // last_practiced: usage ? usage.lastPracticed : undefined, // Not in DB schema
        };
      });
    }

    // FALLBACK: Original logic for full corpus browsing (Search, Kelly lists, Frequency lists)
    let collection = db.words.toCollection();

    collection = db.words.toCollection();

    let words = await collection.toArray();

    // Filter by list type exclusively if not already filtered by range
    if (filters?.listType === "reserve") {
      // We will filter by progress Map below
    }

    // Search filter
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      words = words.filter(w => w.swedish_word.toLowerCase().includes(search));
    }

    // Sort alphabetically
    words.sort((a, b) => a.swedish_word.localeCompare(b.swedish_word));

    // Merge with progress - Optimized: Fetch all relevant progress at once
    const result: WordWithProgress[] = [];

    // Create a Set of swedish words to query progress for (optimization)
    const swedishWords = words.map(w => w.swedish_word);

    // Bulk fetch progress for these words (Optimized: Use word IDs)
    const wordIds = words.map(w => w.id).filter((id): id is number => id !== undefined);
    const progressList = await db.progress.where('word_id').anyOf(wordIds).toArray();
    const progressMap = new Map(progressList.map(p => [p.word_id, p]));

    // Bulk fetch practice counts (wordUsage) - Still by spelling is fine for usage
    const usageList = await db.wordUsage.where('wordSwedish').anyOf(swedishWords).toArray();
    const usageMap = new Map(usageList.map(u => [u.wordSwedish, u]));

    for (const w of words) {
      const progress = progressMap.get(w.id);
      const usage = usageMap.get(w.swedish_word);

      if (filters?.learnedOnly && !progress?.is_learned) continue;
      if (filters?.listType === "reserve" && (!progress?.is_reserve || progress?.is_learned)) continue;

      result.push({
        id: w.id || 0,
        swedish_word: w.swedish_word,
        created_at: "",
        word_data: w.word_data || null,
        progress: progress ? {
          id: progress.id || "",
          user_id: user?.id || "",
          word_id: w.id || 0,
          is_learned: progress.is_learned,
          learned_date: progress.learned_date || null,
          user_meaning: progress.user_meaning || null,
          custom_spelling: progress.custom_spelling || null,
          created_at: "",
          updated_at: "",
          srs_next_review: progress.srs_next_review,
          is_reserve: !!progress.is_reserve,
        } : undefined,
        practice_count: usage?.targetCount || 0
      });
    }

    return result;
  }, [filters, user?.id]);
}

// Legacy list stats removed

export function useUserProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { syncProgress } = useSync();

  const upsertProgress = useMutation({
    mutationFn: async (data: {
      word_id: number;
      swedish_word?: string;
      is_learned?: boolean | number;
      user_meaning?: string;
      custom_spelling?: string;
      is_reserve?: boolean | number;
      reserved_at?: string;
      srs_difficulty?: "easy" | "good" | "hard" | "reset";
    }) => {
      if (!user) throw new Error("Not authenticated");

      // 1. Resolve Word (Local or Remote)
      let swedishWord = data.swedish_word?.toLowerCase();
      let word: LocalWord | undefined = await db.words.where('swedish_word').equals(swedishWord || "").first() || await db.words.get(data.word_id);

      if (!word && swedishWord) {
        const { data: remoteWord } = await supabase.from('words').select('*').eq('swedish_word', swedishWord).single();
        if (remoteWord) {
          word = { id: remoteWord.id, swedish_word: remoteWord.swedish_word, word_data: remoteWord.word_data as any, last_synced_at: new Date().toISOString() } as LocalWord;
          await db.words.put(word);
        }
      }
      if (!word) throw new Error("Word not found");

      // 2. Resolve Existing Progress
      const existing = await db.progress.where('word_id').equals(word.id).first();

      // 3. ENFORCE MUTUAL EXCLUSIVITY & Calculate Dates
      const updatePayload: any = { ...data, word_id: word.id, word_swedish: word.swedish_word, user_id: user.id };

      if (data.is_learned === true || data.is_learned === 1) {
        updatePayload.is_reserve = 0;
        updatePayload.reserved_at = null;
        updatePayload.learned_date = existing?.learned_date || new Date().toISOString();
      } else if (data.is_reserve === true || data.is_reserve === 1) {
        updatePayload.is_learned = 0;
        updatePayload.learned_date = null;
        updatePayload.reserved_at = existing?.reserved_at || data.reserved_at || new Date().toISOString();
      }

      // 4. Sanitize Everything
      const progressUpdate = sanitizeProgress(updatePayload, existing);

      // 5. Calculate SRS difficulty if provided
      if (data.srs_difficulty) {
        let ease = progressUpdate.srs_ease || 2.5;
        let interval = progressUpdate.srs_interval || 0;
        // Simple SRS calculation logic inline for clarity
        if (data.srs_difficulty === 'hard') { interval = 1; ease = Math.max(1.3, ease - 0.2); }
        else if (data.srs_difficulty === 'good') { interval = interval === 0 ? 1 : Math.ceil(interval * ease); }
        else if (data.srs_difficulty === 'easy') { interval = interval === 0 ? 4 : Math.ceil(interval * ease * 1.3); ease += 0.15; }
        else if (data.srs_difficulty === 'reset') { interval = 0; ease = 2.5; }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);
        progressUpdate.srs_next_review = nextReview.toISOString();
        progressUpdate.srs_interval = interval;
        progressUpdate.srs_ease = ease;
      }

      // 6. Final Save and Sync Queue
      await db.progress.put(progressUpdate);

      syncQueue.add({
        type: 'upsert_progress',
        data: { ...progressUpdate, is_learned: progressUpdate.is_learned === 1, is_reserve: progressUpdate.is_reserve === 1 }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["detailedStats"] });

      // No need for immediate sync - queue will handle it automatically
    },
  });

  const resetProgress = useMutation({
    mutationFn: async (filter: {
      all?: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      if (filter.all) {
        await db.progress.clear();
        await supabase.from("user_progress").delete().eq("user_id", user.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["detailedStats"] });
    },
  });

  const refreshWordData = useMutation({
    mutationFn: async (swedishWord: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data: remoteWord, error } = await supabase
        .from('words')
        .select('*')
        .eq('swedish_word', swedishWord)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!remoteWord) return;

      const existing = await db.words.get(remoteWord.id);

      const word: LocalWord = {
        id: remoteWord.id,
        swedish_word: remoteWord.swedish_word,
        word_data: remoteWord.word_data as any,
        last_synced_at: new Date().toISOString(),
      };

      await db.words.put(word);
      return word;
    }
  });

  return { upsertProgress, resetProgress, refreshWordData };
}

export function useStats() {
  const { user } = useAuth();

  return useLiveQuery(async () => {
    if (!user) return null;

    const totalWords = await db.words.count();

    // Fetch all learned words once (truthy)
    const learnedProgress = await db.progress
      .where('user_id').equals(user.id)
      .filter(p => p.is_learned === 1)
      .toArray();

    // Get the word IDs for all learned items
    const learnedWordIds = learnedProgress.map(p => p.word_id);

    // Calculate unique learned words count
    const learnedWords = new Set(learnedWordIds).size;

    return {
      totalWords,
      learnedWords,
      reserveStats: {
        total: new Set((await db.progress.where('user_id').equals(user.id).filter(p => p.is_reserve === 1).toArray()).map(p => p.word_id)).size,
        learned: new Set((await db.progress.where('user_id').equals(user.id).filter(p => p.is_reserve === 1 && p.is_learned === 1).toArray()).map(p => p.word_id)).size
      },
      encounteredStats: {
        total: totalWords,
        learned: new Set([...learnedWordIds, ...(await db.progress.where('user_id').equals(user.id).filter(p => p.is_reserve === 1).toArray()).map(p => p.word_id)]).size
      }
    };
  }, [user?.id]);
}

export function useDetailedStats() {
  const { user } = useAuth();

  return useLiveQuery(async () => {
    if (!user) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const localStartOfToday = today.getTime();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const allReserved = await db.progress.where('user_id').equals(user.id).filter(p => p.is_reserve === 1).toArray();

    // Reserve stats
    const reservedTodayItems = allReserved.filter(p => p.reserved_at && new Date(p.reserved_at).getTime() >= localStartOfToday);
    const reservedToday = new Set(reservedTodayItems.map(p => p.word_id)).size;

    const allLearned = await db.progress.where('user_id').equals(user.id).filter(p => p.is_learned === 1).toArray();

    const learnedTodayItems = allLearned.filter(p => p.learned_date && new Date(p.learned_date).getTime() >= localStartOfToday);
    const learnedToday = new Set(learnedTodayItems.map(p => p.word_id)).size;

    const learnedThisWeekItems = allLearned.filter(p => p.learned_date && new Date(p.learned_date).getTime() >= weekAgo.getTime());
    const learnedThisWeek = new Set(learnedThisWeekItems.map(p => p.word_id)).size;

    const learnedThisMonthItems = allLearned.filter(p => p.learned_date && new Date(p.learned_date).getTime() >= monthAgo.getTime());
    const learnedThisMonth = new Set(learnedThisMonthItems.map(p => p.word_id)).size;

    // Bulk fetch words for today's learned items (by word_id)
    const todayWordIds = learnedTodayItems.map(p => p.word_id);
    if (todayWordIds.length > 0) {
      const todayWords = await db.words.where('id').anyOf(todayWordIds).toArray();
      // No per-list breakdown needed anymore
    }

    // Daily counts for chart (Learned, Study Later, Encountered)
    const dailyCounts: { date: string; learned: number; reserved: number; encountered: number }[] = [];

    const allLearnedIds = allLearned.map(p => p.word_id);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dTime = d.getTime();
      const nextDTime = nextD.getTime();

      const allLearnedToday = allLearned.filter(p => p.learned_date && new Date(p.learned_date).getTime() >= dTime && new Date(p.learned_date).getTime() < nextDTime);
      const allLearnedTodayCount = new Set(allLearnedToday.map(p => p.word_id)).size;

      const learnedCount = allLearnedTodayCount;

      const reservedProgress = allReserved.filter(p => p.reserved_at && new Date(p.reserved_at).getTime() >= dTime && new Date(p.reserved_at).getTime() < nextDTime);
      const reservedCount = new Set(reservedProgress.map(p => p.word_id)).size;

      // Calculate encountered as unique union of learned and reserved for this day
      const encounteredSet = new Set([
        ...allLearnedToday.map(p => p.word_id),
        ...reservedProgress.map(p => p.word_id)
      ]);

      dailyCounts.push({
        date: d.toISOString().split("T")[0],
        learned: learnedCount,
        reserved: reservedCount,
        encountered: encounteredSet.size
      });
    }

    return {
      allTime: new Set(allLearned.map(p => p.word_id)).size,
      learnedToday,
      learnedThisWeek,
      learnedThisMonth,
      reservedToday,
      dailyCounts,
      avgPerDay: Math.round((learnedThisMonth / 30) * 10) / 10
    };
  }, [user?.id]);
}

// Learning Prediction Hook - uses local data
export function useLearningPrediction() {
  const { user } = useAuth();
  const stats = useDetailedStats();
  const allStats = useStats();

  return useQuery({
    queryKey: ["learningPrediction", user?.id, stats?.allTime],
    queryFn: async () => {
      if (!stats || !allStats) return null;

      const remainingWords = allStats.totalWords - allStats.learnedWords;
      const avgWordsPerDay = stats.avgPerDay;

      let estimatedCompletionDate: string | null = null;
      let daysRemaining: number | null = null;

      if (avgWordsPerDay > 0 && remainingWords > 0) {
        daysRemaining = Math.ceil(remainingWords / avgWordsPerDay);
        const completionDate = new Date();
        completionDate.setDate(completionDate.getDate() + daysRemaining);
        estimatedCompletionDate = completionDate.toISOString().split("T")[0];
      }

      return {
        totalWords: allStats.totalWords,
        learnedCount: allStats.learnedWords,
        remainingWords,
        avgWordsPerDay,
        daysRemaining,
        estimatedCompletionDate,
      };
    },
    enabled: !!stats && !!allStats,
  });
}

// B1 Goal Tracker Hook - Track progress toward A1+A2+B1 completion by April 1st
export function useB1GoalProgress() {
  const { user } = useAuth();
  const stats = useDetailedStats();

  return useLiveQuery(async () => {
    if (!user) return null;

    // Target deadline: April 1st, 2026
    const deadline = new Date(2026, 3, 1); // Month is 0-indexed, so 3 = April
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const timeDiff = deadline.getTime() - today.getTime();
    const daysUntilDeadline = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

    // Get all learned progress
    const learnedProgress = await db.progress.where('is_learned').equals(1).toArray();
    const learnedSwedishWords = new Set(learnedProgress.map(p => p.word_swedish));

    // Collect unique words in A1, A2, B1 across all lists
    const targetLevels = ["A1", "A2", "B1"];
    const b1WordsSet = new Set<string>();
    const learnedB1WordsSet = new Set<string>();

    // Unified approach: Use CEFR level from word_data
    const allWords = await db.words.toArray();
    for (const w of allWords) {
      const level = (w.word_data as any)?.cefr_level;
      if (level && targetLevels.includes(level)) {
        b1WordsSet.add(w.swedish_word);
        if (learnedSwedishWords.has(w.swedish_word)) {
          learnedB1WordsSet.add(w.swedish_word);
        }
      }
    }

    const totalB1Words = b1WordsSet.size;
    const learnedB1Words = learnedB1WordsSet.size;
    const remainingB1Words = totalB1Words - learnedB1Words;
    const progressPercent = totalB1Words > 0 ? (learnedB1Words / totalB1Words) * 100 : 0;

    // Calculate required words per day
    const requiredWordsPerDay = daysUntilDeadline > 0
      ? Math.ceil(remainingB1Words / daysUntilDeadline)
      : remainingB1Words;

    // Current pace from detailed stats
    const currentPace = stats?.avgPerDay || 0;
    const isOnTrack = currentPace >= requiredWordsPerDay;

    // Calculate if goal is achievable at current pace
    const daysNeededAtCurrentPace = currentPace > 0
      ? Math.ceil(remainingB1Words / currentPace)
      : null;
    const projectedCompletionDate = daysNeededAtCurrentPace
      ? new Date(today.getTime() + daysNeededAtCurrentPace * 24 * 60 * 60 * 1000)
      : null;

    return {
      totalB1Words,
      learnedB1Words,
      remainingB1Words,
      progressPercent,
      daysUntilDeadline,
      deadline: deadline.toISOString().split('T')[0],
      requiredWordsPerDay,
      currentPace,
      isOnTrack,
      daysNeededAtCurrentPace,
      projectedCompletionDate: projectedCompletionDate?.toISOString().split('T')[0] || null,
    };
  }, [user?.id, stats?.avgPerDay]);
}

export function useTodaysLearnedWords() {
  const { user } = useAuth();

  return useLiveQuery(async () => {
    if (!user) return [];

    const now = new Date();
    const localStartOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Fetch progress for today from local DB
    const todaysProgressRaw = await db.progress
      .where('user_id').equals(user.id)
      .filter(p => !!p.is_learned && !!p.learned_date && new Date(p.learned_date).getTime() >= localStartOfToday)
      .toArray();

    // De-duplicate in case of sync issues
    const uniqueMap = new Map();
    for (const p of todaysProgressRaw) {
      if (!uniqueMap.has(p.word_id)) uniqueMap.set(p.word_id, p);
    }
    const todaysProgress = Array.from(uniqueMap.values());

    if (!todaysProgress.length) return [];

    // Fetch corresponding word data efficiently
    const result: WordWithProgress[] = [];
    const swedishWords = todaysProgress.map(p => p.word_swedish);
    const wordsList = await db.words.where('swedish_word').anyOf(swedishWords).toArray();
    const wordsMap = new Map(wordsList.map(w => [w.swedish_word, w]));

    const seenWords = new Set<string>();

    for (const p of todaysProgress) {
      if (seenWords.has(p.word_swedish)) continue;

      const w = wordsMap.get(p.word_swedish);
      if (w) {
        seenWords.add(p.word_swedish);
        result.push({
          id: w.id || 0,
          swedish_word: w.swedish_word,
          created_at: "",
          word_data: w.word_data || null,
          progress: {
            id: p.id || "",
            user_id: user.id || "",
            word_id: w.id || 0,
            is_learned: !!p.is_learned,
            learned_date: p.learned_date || null,
            user_meaning: p.user_meaning || null,
            custom_spelling: p.custom_spelling || null,
            created_at: "",
            updated_at: "",
            srs_next_review: p.srs_next_review,
            is_reserve: !!p.is_reserve,
          },
        });
      }
    }

    return result;
  }, [user?.id]);
}

export function useUploadHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ["uploadHistory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("upload_history")
        .select("*")
        .eq("user_id", user!.id)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as UploadHistoryItem[];
    },
    enabled: !!user,
  });

  const addUpload = useMutation({
    mutationFn: async (data: {
      file_name: string;
      file_type: string;
      records_processed: number;
      list_type?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("upload_history").insert({
        ...data,
        user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploadHistory"] });
    },
  });

  const deleteUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("upload_history")
        .delete()
        .eq("id", uploadId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploadHistory"] });
    },
  });

  return { history, addUpload, deleteUpload };
}

export function useAddWord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      swedish_word: string;
    }) => {
      // 1. Try to INSERT
      const cleanWord = data.swedish_word.toLowerCase().trim();
      const { data: inserted, error } = await supabase.from("words").insert({
        swedish_word: cleanWord,
      }).select("id").single();

      let wordId: number;

      if (error) {
        // Handle DUPLICATE (409) - Word exists globally but not locally?
        if (error.code === "23505" || error.code === "409") { // Postgres unique violation or HTTP conflict
          console.log("Word exists globally, fetching...");
          const { data: existing, error: fetchError } = await supabase
            .from("words")
            .select("id")
            .eq("swedish_word", cleanWord)
            .single();

          if (fetchError || !existing) throw error; // Rethrow original if we can't find it
          wordId = existing.id;
        }
        // Handle PERMISSIONS
        else if (error.code === "42501" || error.message?.includes("row-level security")) {
          throw new Error("You don't have permission to add words. Admin role required.");
        } else {
          throw error;
        }
      } else {
        wordId = inserted.id;
      }

      // 2. Add/Update local DB to ensure we have it
      await db.words.put({
        id: wordId,
        swedish_word: cleanWord,
        last_synced_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["words"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["levelStats"] });
      queryClient.invalidateQueries({ queryKey: ["learningPrediction"] });
    },
  });
}

export function useDeleteWord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (swedishWord: string) => {
      // 1. Delete from Supabase
      const { error } = await supabase
        .from("words")
        .delete()
        .eq("swedish_word", swedishWord);

      if (error) {
        if (error.code === "42501" || error.message?.includes("row-level security")) {
          throw new Error("You don't have permission to delete words. Admin role required.");
        }
        throw error;
      }

      // 2. Delete from Local DB
      const wordsToDelete = await db.words.where("swedish_word").equals(swedishWord).toArray();
      const idsToDelete = wordsToDelete.map(w => w.id);
      await db.words.bulkDelete(idsToDelete);

      // 3. Delete any associated progress
      const progress = await db.progress.where("word_id").anyOf(idsToDelete).toArray();
      if (progress.length > 0) {
        await db.progress.bulkDelete(progress.map(p => p.id!));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["words"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["levelStats"] });
      queryClient.invalidateQueries({ queryKey: ["learningPrediction"] });
    },
  });
}
