import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { db, LocalWord, LocalUserProgress } from "@/services/db";
import type { WordData } from "@/types/word";

export interface Word {
  id: number;
  swedish_word: string;
  kelly_level: string | null;
  kelly_source_id: number | null;
  frequency_rank: number | null;
  sidor_source_id: number | null;
  sidor_rank: number | null;
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
}

export interface WordWithProgress extends Word {
  progress?: UserProgress;
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
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// Frequency ranges mapped to CEFR-like levels
export const FREQUENCY_LEVELS = [
  { label: "A1", value: "A1", range: [1, 1500] as [number, number], description: "Most common (1-1500)" },
  { label: "A2", value: "A2", range: [1501, 3000] as [number, number], description: "Common (1501-3000)" },
  { label: "B1", value: "B1", range: [3001, 5000] as [number, number], description: "Intermediate (3001-5000)" },
  { label: "B2", value: "B2", range: [5001, 7000] as [number, number], description: "Upper intermediate (5001-7000)" },
  { label: "C1", value: "C1", range: [7001, 9000] as [number, number], description: "Advanced (7001-9000)" },
  { label: "C2", value: "C2", range: [9001, 99999] as [number, number], description: "Proficient (9001+)" },
];

// Sidor ranges mapped to CEFR-like levels (600 words per level)
export const SIDOR_LEVELS = [
  { label: "A1", value: "A1", range: [1, 600] as [number, number], description: "Beginner (1-600)" },
  { label: "A2", value: "A2", range: [601, 1200] as [number, number], description: "Elementary (601-1200)" },
  { label: "B1", value: "B1", range: [1201, 1800] as [number, number], description: "Intermediate (1201-1800)" },
  { label: "B2", value: "B2", range: [1801, 2400] as [number, number], description: "Upper intermediate (1801-2400)" },
  { label: "C1", value: "C1", range: [2401, 3000] as [number, number], description: "Advanced (2401-3000)" },
  { label: "C2", value: "C2", range: [3001, 99999] as [number, number], description: "Proficient (3001+)" },
];

export function useWords(filters?: {
  kellyLevel?: string;
  frequencyRange?: [number, number];
  sidorRange?: [number, number];
  learnedOnly?: boolean;
  search?: string;
  listType?: "kelly" | "frequency" | "sidor";
}) {
  const { user } = useAuth();

  return useLiveQuery(async () => {
    let collection = db.words.toCollection();

    if (filters?.kellyLevel) {
      collection = db.words.where('kelly_level').equals(filters.kellyLevel);
    } else if (filters?.frequencyRange) {
      collection = db.words.where('frequency_rank').between(filters.frequencyRange[0], filters.frequencyRange[1], true, true);
    } else if (filters?.sidorRange) {
      collection = db.words.where('sidor_rank').between(filters.sidorRange[0], filters.sidorRange[1], true, true);
    }

    let words = await collection.toArray();

    // Filter by list type exclusively if not already filtered by range
    if (!filters?.kellyLevel && !filters?.frequencyRange && !filters?.sidorRange) {
      if (filters?.listType === "kelly") {
        words = words.filter(w => !!w.kelly_level);
      } else if (filters?.listType === "frequency") {
        words = words.filter(w => !!w.frequency_rank);
      } else if (filters?.listType === "sidor") {
        words = words.filter(w => !!w.sidor_rank);
      }
    }

    // Search filter
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      words = words.filter(w => w.swedish_word.toLowerCase().includes(search));
    }

    // Sort
    if (filters?.listType === "kelly") {
      words.sort((a, b) => (a.kelly_source_id || 0) - (b.kelly_source_id || 0));
    } else if (filters?.listType === "frequency") {
      words.sort((a, b) => (a.frequency_rank || 0) - (b.frequency_rank || 0));
    } else if (filters?.listType === "sidor") {
      words.sort((a, b) => (a.sidor_rank || 0) - (b.sidor_rank || 0));
    }

    // Merge with progress - Optimized: Fetch all relevant progress at once
    const result: WordWithProgress[] = [];

    // Create a Set of swedish words to query progress for (optimization)
    const swedishWords = words.map(w => w.swedish_word);

    // Bulk fetch progress for these words
    const progressList = await db.progress.where('word_swedish').anyOf(swedishWords).toArray();
    const progressMap = new Map(progressList.map(p => [p.word_swedish, p]));

    for (const w of words) {
      const progress = progressMap.get(w.swedish_word);

      if (filters?.learnedOnly && !progress?.is_learned) continue;

      result.push({
        id: w.id || 0,
        swedish_word: w.swedish_word,
        kelly_level: w.kelly_level || null,
        kelly_source_id: w.kelly_source_id || null,
        frequency_rank: w.frequency_rank || null,
        sidor_source_id: null,
        sidor_rank: w.sidor_rank || null,
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
        } : undefined
      });
    }

    return result;
  }, [filters, user?.id]);
}

// Hook to get level stats for a specific list type
export function useLevelStats(listType: "kelly" | "frequency" | "sidor") {
  const { user } = useAuth();

  return useLiveQuery(async () => {
    // Initialize stats object
    const stats: Record<string, { total: number; learned: number }> = {};

    // Get all learned items first to avoid repeated queries
    const learnedProgress = await db.progress.where('is_learned').equals(1).toArray();

    if (listType === "kelly") {
      for (const level of CEFR_LEVELS) {
        // Count total words in this level
        const total = await db.words.where('kelly_level').equals(level).count();

        // Count learned words in this level
        // We filter the pre-fetched progress items
        let learned = 0;
        for (const p of learnedProgress) {
          const w = await db.words.where('swedish_word').equals(p.word_swedish).first();
          if (w && w.kelly_level === level) {
            learned++;
          }
        }

        stats[level] = { total, learned };
      }
    } else if (listType === "frequency") {
      for (const freqLevel of FREQUENCY_LEVELS) {
        const total = await db.words.where('frequency_rank').between(freqLevel.range[0], freqLevel.range[1], true, true).count();

        let learned = 0;
        for (const p of learnedProgress) {
          const w = await db.words.where('swedish_word').equals(p.word_swedish).first();
          if (w && w.frequency_rank && w.frequency_rank >= freqLevel.range[0] && w.frequency_rank <= freqLevel.range[1]) {
            learned++;
          }
        }

        stats[freqLevel.label] = { total, learned };
      }
    } else {
      // Sidor list
      for (const sidorLevel of SIDOR_LEVELS) {
        const total = await db.words.where('sidor_rank').between(sidorLevel.range[0], sidorLevel.range[1], true, true).count();

        let learned = 0;
        for (const p of learnedProgress) {
          const w = await db.words.where('swedish_word').equals(p.word_swedish).first();
          if (w && w.sidor_rank && w.sidor_rank >= sidorLevel.range[0] && w.sidor_rank <= sidorLevel.range[1]) {
            learned++;
          }
        }

        stats[sidorLevel.label] = { total, learned };
      }
    }

    return stats;
  }, [listType, user?.id]);
}

export function useUserProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const upsertProgress = useMutation({
    mutationFn: async (data: {
      word_id: number;
      swedish_word?: string;
      is_learned?: boolean;
      user_meaning?: string;
      custom_spelling?: string;
      srs_difficulty?: "easy" | "good" | "hard" | "reset";
    }) => {
      if (!user) throw new Error("Not authenticated");

      // 1. Get word info
      let swedishWord = data.swedish_word;
      let word: LocalWord | undefined;

      // If we have the swedish_word (PK), use it directly - fastest
      if (swedishWord) {
        word = await db.words.get(swedishWord);
      }

      // If we don't have it, or it wasn't found by PK, try to find by ID (slower scan)
      if (!word) {
        word = await db.words.filter(w => w.id === data.word_id).first();
      }

      // Fallback: If still not found locally (partial sync?), fetch from Supabase and cache it
      if (!word) {
        console.log(`Word "${data.swedish_word || data.word_id}" not found locally, fetching from remote...`);

        let query = supabase.from('words').select('*');
        if (data.swedish_word) {
          query = query.eq('swedish_word', data.swedish_word);
        } else {
          query = query.eq('id', data.word_id);
        }

        const { data: remoteWord, error } = await query.single();

        if (error || !remoteWord) throw new Error("Word not found in local DB or Remote");

        word = {
          id: remoteWord.id,
          swedish_word: remoteWord.swedish_word,
          kelly_level: remoteWord.kelly_level || undefined,
          kelly_source_id: remoteWord.kelly_source_id || undefined,
          frequency_rank: remoteWord.frequency_rank || undefined,
          sidor_rank: remoteWord.sidor_rank || undefined,
          word_data: remoteWord.word_data as any,
          last_synced_at: new Date().toISOString()
        };

        // Self-heal local DB
        await db.words.put(word);
      }

      swedishWord = word.swedish_word;

      // 2. Calculate SRS if difficulty is provided
      const existing = await db.progress.where('word_swedish').equals(swedishWord).first();

      let srsUpdate: Partial<LocalUserProgress> = {};
      if (data.srs_difficulty) {
        let ease = existing?.srs_ease || 2.5;
        let interval = existing?.srs_interval || 0;

        switch (data.srs_difficulty) {
          case "hard":
            interval = 1;
            ease = Math.max(1.3, ease - 0.2);
            break;
          case "good":
            interval = interval === 0 ? 1 : Math.ceil(interval * ease);
            break;
          case "easy":
            interval = interval === 0 ? 4 : Math.ceil(interval * ease * 1.3);
            ease += 0.15;
            break;
          case "reset":
            interval = 0;
            ease = 2.5;
            break;
        }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);

        srsUpdate = {
          srs_next_review: nextReview.toISOString(),
          srs_interval: interval,
          srs_ease: ease,
        };
      }

      // 3. Update Local DB
      const progressData: LocalUserProgress = {
        word_swedish: swedishWord,
        is_learned: data.is_learned === undefined ? (existing?.is_learned || 0) : (data.is_learned ? 1 : 0),
        user_meaning: data.user_meaning ?? existing?.user_meaning,
        custom_spelling: data.custom_spelling ?? existing?.custom_spelling,
        learned_date: data.is_learned ? ((existing?.learned_date) || new Date().toISOString()) : existing?.learned_date,
        last_synced_at: new Date().toISOString(),
        ...srsUpdate,
      };

      await db.progress.put(progressData);

      // 4. Update Supabase (Background)
      // Find all word IDs in Supabase with this swedish_word to keep them in sync
      const { data: remoteWords } = await supabase
        .from("words")
        .select("id")
        .eq("swedish_word", swedishWord);

      const remoteWordIds = remoteWords?.map(w => w.id) || [data.word_id];

      for (const rid of remoteWordIds) {
        const { data: remoteExisting } = await supabase
          .from("user_progress")
          .select("id")
          .eq("user_id", user.id)
          .eq("word_id", rid)
          .maybeSingle();

        const remotePayload = {
          user_id: user.id,
          word_id: rid,
          is_learned: !!progressData.is_learned,
          user_meaning: progressData.user_meaning,
          custom_spelling: progressData.custom_spelling,
          learned_date: progressData.learned_date,
          // Note: Support for SRS columns in Supabase might need a migration if they don't exist
          // For now we'll store them if possible, but prioritize local IndexedDB for SRS logic
        };

        if (remoteExisting) {
          await supabase.from("user_progress").update(remotePayload).eq("id", remoteExisting.id);
        } else {
          await supabase.from("user_progress").insert(remotePayload);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["detailedStats"] });
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

  return { upsertProgress, resetProgress };
}

export function useStats() {
  const { user } = useAuth();

  return useLiveQuery(async () => {
    if (!user) return null;

    const totalWords = await db.words.count();
    const learnedProgress = await db.progress.where('is_learned').equals(1).toArray();
    const learnedWords = learnedProgress.length;

    // Kelly level counts
    const kellyStats: Record<string, { total: number; learned: number }> = {};
    for (const level of CEFR_LEVELS) {
      const total = await db.words.where('kelly_level').equals(level).count();
      const learned = (await Promise.all(
        learnedProgress.map(async p => {
          const w = await db.words.where('swedish_word').equals(p.word_swedish).first();
          return w?.kelly_level === level ? 1 : 0;
        })
      )).reduce((a, b) => a + b, 0);
      kellyStats[level] = { total, learned };
    }

    // Frequency level counts
    const frequencyStats: Record<string, { total: number; learned: number }> = {};
    for (const freqLevel of FREQUENCY_LEVELS) {
      const total = await db.words.where('frequency_rank').between(freqLevel.range[0], freqLevel.range[1], true, true).count();
      const learned = (await Promise.all(
        learnedProgress.map(async p => {
          const w = await db.words.where('swedish_word').equals(p.word_swedish).first();
          return (w?.frequency_rank && w.frequency_rank >= freqLevel.range[0] && w.frequency_rank <= freqLevel.range[1]) ? 1 : 0;
        })
      )).reduce((a, b) => a + b, 0);
      frequencyStats[freqLevel.label] = { total, learned };
    }

    // Sidor level counts
    const sidorStats: Record<string, { total: number; learned: number }> = {};
    for (const sidorLevel of SIDOR_LEVELS) {
      const total = await db.words.where('sidor_rank').between(sidorLevel.range[0], sidorLevel.range[1], true, true).count();
      const learned = (await Promise.all(
        learnedProgress.map(async p => {
          const w = await db.words.where('swedish_word').equals(p.word_swedish).first();
          return (w?.sidor_rank && w.sidor_rank >= sidorLevel.range[0] && w.sidor_rank <= sidorLevel.range[1]) ? 1 : 0;
        })
      )).reduce((a, b) => a + b, 0);
      sidorStats[sidorLevel.label] = { total, learned };
    }

    return {
      totalWords,
      learnedWords,
      kellyStats,
      frequencyStats,
      sidorStats,
    };
  }, [user?.id]);
}

export function useDetailedStats() {
  const { user } = useAuth();

  return useLiveQuery(async () => {
    if (!user) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const allLearned = await db.progress.where('is_learned').equals(1).toArray();

    const learnedTodayItems = allLearned.filter(p => p.learned_date && new Date(p.learned_date) >= today);
    const learnedToday = learnedTodayItems.length;
    const learnedThisWeek = allLearned.filter(p => p.learned_date && new Date(p.learned_date) >= weekAgo).length;
    const learnedThisMonth = allLearned.filter(p => p.learned_date && new Date(p.learned_date) >= monthAgo).length;

    // Breakdown for today
    let kellyToday = 0;
    let frequencyToday = 0;
    let sidorToday = 0;

    for (const p of learnedTodayItems) {
      const w = await db.words.where('swedish_word').equals(p.word_swedish).first();
      if (w?.kelly_level) kellyToday++;
      if (w?.frequency_rank) frequencyToday++;
      if (w?.sidor_rank) sidorToday++;
    }

    // Daily counts for chart
    const dailyCounts: { date: string; count: number }[] = [];
    let maxDaily = 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const count = allLearned.filter(p => p.learned_date && new Date(p.learned_date) >= d && new Date(p.learned_date) < nextD).length;
      if (count > maxDaily) maxDaily = count;
      dailyCounts.push({
        date: d.toISOString().split("T")[0],
        count,
      });
    }

    return {
      learnedToday,
      kellyToday,
      frequencyToday,
      sidorToday,
      learnedThisWeek,
      learnedThisMonth,
      allTime: allLearned.length,
      avgPerDay: Math.round((learnedThisMonth / 30) * 10) / 10,
      maxDaily,
      dailyCounts,
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

export function useTodaysLearnedWords() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["todaysLearnedWords", user?.id],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const { data: todaysProgress } = await supabase
        .from("user_progress")
        .select("*, words!inner(id, swedish_word, kelly_level, kelly_source_id, frequency_rank, sidor_source_id, sidor_rank)")
        .eq("user_id", user!.id)
        .eq("is_learned", true)
        .gte("learned_date", today.toISOString());

      if (!todaysProgress) return [];

      return todaysProgress.map((p) => {
        const word = p.words as any;
        return {
          id: word.id,
          swedish_word: word.swedish_word,
          kelly_level: word.kelly_level,
          kelly_source_id: word.kelly_source_id,
          frequency_rank: word.frequency_rank,
          sidor_source_id: word.sidor_source_id,
          sidor_rank: word.sidor_rank,
          created_at: "",
          progress: {
            id: p.id,
            user_id: p.user_id,
            word_id: p.word_id,
            is_learned: p.is_learned,
            learned_date: p.learned_date,
            user_meaning: p.user_meaning,
            custom_spelling: p.custom_spelling,
            created_at: p.created_at,
            updated_at: p.updated_at,
          },
        } as WordWithProgress;
      });
    },
    enabled: !!user,
  });
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
      kelly_level?: string;
      frequency_rank?: number;
      sidor_rank?: number;
      sidor_source_id?: number;
    }) => {
      const { error } = await supabase.from("words").insert({
        swedish_word: data.swedish_word.toLowerCase().trim(),
        kelly_level: data.kelly_level || null,
        frequency_rank: data.frequency_rank || null,
        sidor_rank: data.sidor_rank || null,
        sidor_source_id: data.sidor_source_id || null,
      });

      if (error) {
        // Provide user-friendly error message for RLS policy violations
        if (error.code === "42501" || error.message?.includes("row-level security")) {
          throw new Error("You don't have permission to add words. Admin role required.");
        }
        throw error;
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

export function useNextFrequencyId() {
  return useQuery({
    queryKey: ["nextFrequencyId"],
    queryFn: async () => {
      const { data } = await supabase
        .from("words")
        .select("frequency_rank")
        .not("frequency_rank", "is", null)
        .order("frequency_rank", { ascending: false })
        .limit(1);

      return (data?.[0]?.frequency_rank || 0) + 1;
    },
  });
}

export function useNextSidorId() {
  return useQuery({
    queryKey: ["nextSidorId"],
    queryFn: async () => {
      const { data } = await supabase
        .from("words")
        .select("sidor_rank")
        .not("sidor_rank", "is", null)
        .order("sidor_rank", { ascending: false })
        .limit(1);

      return (data?.[0]?.sidor_rank || 0) + 1;
    },
  });
}
