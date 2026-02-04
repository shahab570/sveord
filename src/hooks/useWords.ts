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
  is_ft?: number | boolean;
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
  listType?: "kelly" | "frequency" | "sidor" | "ft" | "reserve";
  ftOnly?: boolean;
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
    } else if (filters?.ftOnly || filters?.listType === "ft") {
      // FT words
      collection = db.words.toCollection();
    } else if (filters?.listType === "reserve") {
      // Reserve words are those that have is_reserve = 1 in progress table
      // We can't efficiently filter 'words' table by 'progress' table fields with Dexie.where 
      // without index, so we'll fetch all and filter in JS or do a separate PK query.
      collection = db.words.toCollection();
    } else {
      // Default: Search across all lists including FT - use a compound index if possible or just filter
      // For now, let's ensure the baseline collection includes all rows
      collection = db.words.toCollection();
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
      } else if (filters?.listType === "ft") {
        words = words.filter(w =>
          w.is_ft === 1 ||
          (w.word_data && !w.kelly_level && !w.frequency_rank && !w.sidor_rank) ||
          (w.word_data as any)?.is_ft === true // Check inside JSON too
        );
      } else if (filters?.listType === "reserve") {
        // We will filter by progress Map below
      }
    }

    // Search filter
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      words = words.filter(w => w.swedish_word.toLowerCase().includes(search));
    }

    // Sort
    if (filters?.listType === "kelly" || filters?.kellyLevel) {
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
      if (filters?.listType === "reserve" && !progress?.is_reserve) continue;

      result.push({
        id: w.id || 0,
        swedish_word: w.swedish_word,
        kelly_level: w.kelly_level || null,
        kelly_source_id: w.kelly_source_id || null,
        frequency_rank: w.frequency_rank || null,
        sidor_source_id: null,
        sidor_rank: w.sidor_rank || null,
        is_ft: (w.is_ft || (!w.kelly_level && !w.frequency_rank && !w.sidor_rank)) ? 1 : 0,
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

// Hook to get level stats for a specific list type
export function useLevelStats(listType: "kelly" | "frequency" | "sidor" | "ft") {
  const { user } = useAuth();

  return useLiveQuery(async () => {
    // Initialize stats object
    const stats: Record<string, { total: number; learned: number }> = {};

    // Get all learned items first to avoid repeated queries
    const learnedProgress = await db.progress.filter(p => !!p.is_learned).toArray();
    const learnedWordIds = Array.from(new Set(learnedProgress.map(p => p.word_id)));

    // Bulk fetch unique words
    const learnedWords = await db.words.where('id').anyOf(learnedWordIds).toArray();

    if (listType === "kelly") {
      for (const level of CEFR_LEVELS) {
        // Count total words in this level
        const total = await db.words.where('kelly_level').equals(level).count();

        // Count learned words in this level from unique set
        const learned = learnedWords.filter(w => w.kelly_level === level).length;

        stats[level] = { total, learned };
      }
    } else if (listType === "frequency") {
      for (const freqLevel of FREQUENCY_LEVELS) {
        const total = await db.words.where('frequency_rank').between(freqLevel.range[0], freqLevel.range[1], true, true).count();

        const learned = learnedWords.filter(w =>
          w.frequency_rank && w.frequency_rank >= freqLevel.range[0] && w.frequency_rank <= freqLevel.range[1]
        ).length;

        stats[freqLevel.label] = { total, learned };
      }
    } else if (listType === "sidor") {
      // Sidor list
      for (const sidorLevel of SIDOR_LEVELS) {
        const total = await db.words.where('sidor_rank').between(sidorLevel.range[0], sidorLevel.range[1], true, true).count();

        const learned = learnedWords.filter(w =>
          w.sidor_rank && w.sidor_rank >= sidorLevel.range[0] && w.sidor_rank <= sidorLevel.range[1]
        ).length;

        stats[sidorLevel.label] = { total, learned };
      }
    } else {
      // FT list
      const total = await db.words.where('is_ft').equals(1).count();
      const learned = learnedWords.filter(w => w.is_ft).length;
      stats["Total"] = { total, learned };
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
      is_learned?: boolean | number;
      user_meaning?: string;
      custom_spelling?: string;
      is_reserve?: boolean | number;
      reserved_at?: string;
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
      const existing = await db.progress.where('word_id').equals(data.word_id).first();

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
      const isNowLearned = !!data.is_learned;
      const wasLearned = existing?.is_learned === 1; // stored as number 0/1 locally

      // Determine new learned date:
      // 1. If explicitly marking learned now -> update date to now (refreshes Today's review)
      // 2. If just updating content (meaning/spelling) while already learned -> keep existing date
      // 3. If unlearning -> keep existing date (or null? usually keep for history)

      let newLearnedDate = existing?.learned_date;
      if (isNowLearned && !wasLearned) {
        // Transitioning to learned -> Set new date
        newLearnedDate = new Date().toISOString();
      } else if (isNowLearned && wasLearned) {
        // Already learned, just updating fields -> Keep date (unless it was somehow null)
        newLearnedDate = existing?.learned_date || new Date().toISOString();
      } else if (isNowLearned) {
        // Fallback
        newLearnedDate = new Date().toISOString();
      }

      let isLearnedVal = data.is_learned !== undefined ? (data.is_learned ? 1 : 0) : existing?.is_learned;
      let isReserveVal = data.is_reserve !== undefined ? (data.is_reserve ? 1 : 0) : existing?.is_reserve;

      // Enforce mutual exclusivity
      if (data.is_learned === true) {
        isReserveVal = 0; // If learning, un-reserve
      } else if (data.is_reserve === true) {
        isLearnedVal = 0; // If reserving, un-learn
      }

      const progressUpdate: LocalUserProgress = {
        ...existing,
        user_id: user.id,
        word_id: data.word_id,
        word_swedish: swedishWord,
        is_learned: isLearnedVal ?? 0,
        is_reserve: isReserveVal ?? 0,
        user_meaning: data.user_meaning !== undefined ? data.user_meaning : existing?.user_meaning,
        custom_spelling: data.custom_spelling !== undefined ? data.custom_spelling : existing?.custom_spelling,
        reserved_at: data.reserved_at !== undefined ? data.reserved_at : (isReserveVal === 1 ? (existing?.reserved_at || new Date().toISOString()) : undefined),
        learned_date: newLearnedDate,
        last_synced_at: new Date().toISOString(), // This is for local sync status, not remote
        ...srsUpdate,
      };

      await db.progress.put(progressUpdate);

      // 4. Update Supabase (Background)
      // Find all word IDs in Supabase with this swedish_word to keep them in sync
      const remoteWordIds = [data.word_id];

      if (user?.id) {
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
            is_learned: progressUpdate.is_learned === 1,
            user_meaning: progressUpdate.user_meaning,
            custom_spelling: progressUpdate.custom_spelling,
            learned_date: progressUpdate.learned_date,
            is_reserve: progressUpdate.is_reserve === 1,
          };

          if (remoteExisting) {
            await supabase.from("user_progress").update(remotePayload).eq("id", remoteExisting.id);
          } else {
            await supabase.from("user_progress").insert(remotePayload);
          }
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
        kelly_level: remoteWord.kelly_level || undefined,
        kelly_source_id: remoteWord.kelly_source_id || undefined,
        frequency_rank: remoteWord.frequency_rank || undefined,
        sidor_rank: remoteWord.sidor_rank || undefined,
        word_data: remoteWord.word_data as any,
        last_synced_at: new Date().toISOString(),
        is_ft: ((remoteWord.word_data as any)?.is_ft) ? 1 : existing?.is_ft
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
    const learnedProgress = await db.progress.filter(p => !!p.is_learned).toArray();

    // Get the word IDs for all learned items
    const learnedWordIds = learnedProgress.map(p => p.word_id);

    // Calculate unique learned words count
    const learnedWords = new Set(learnedWordIds).size;

    // Fetch all learned word definitions in bulk to check levels (by ID)
    const learnedWordDefs = await db.words.where('id').anyOf(learnedWordIds).toArray();

    // Index learned words by swedish_word for quick lookup (if needed) or just iterate
    // Since we need to aggregate by different levels, iterating the definitions is easiest

    // Initialize stats
    const kellyStats: Record<string, { total: number; learned: number }> = {};
    CEFR_LEVELS.forEach(l => kellyStats[l] = { total: 0, learned: 0 });

    const frequencyStats: Record<string, { total: number; learned: number }> = {};
    FREQUENCY_LEVELS.forEach(l => frequencyStats[l.label] = { total: 0, learned: 0 });

    const sidorStats: Record<string, { total: number; learned: number }> = {};
    SIDOR_LEVELS.forEach(l => sidorStats[l.label] = { total: 0, learned: 0 });

    // 1. Calculate totals (this still requires counting all words, but we can do it efficiently)
    // We can't avoid 3 full scans for totals unless we cache them, but they are just counts.
    // Optimization: Run these in parallel
    await Promise.all([
      ...CEFR_LEVELS.map(async level => {
        const count = await db.words.where('kelly_level').equals(level).count();
        if (kellyStats[level]) kellyStats[level].total = count;
      }),
      ...FREQUENCY_LEVELS.map(async l => {
        const count = await db.words.where('frequency_rank').between(l.range[0], l.range[1], true, true).count();
        if (frequencyStats[l.label]) frequencyStats[l.label].total = count;
      }),
      ...SIDOR_LEVELS.map(async l => {
        const count = await db.words.where('sidor_rank').between(l.range[0], l.range[1], true, true).count();
        if (sidorStats[l.label]) sidorStats[l.label].total = count;
      })
    ]);

    // 2. Aggregate learned counts from the bulk-fetched definitions
    for (const w of learnedWordDefs) {
      // Kelly
      if (w.kelly_level && kellyStats[w.kelly_level]) {
        kellyStats[w.kelly_level].learned++;
      }

      // Frequency
      if (w.frequency_rank) {
        for (const l of FREQUENCY_LEVELS) {
          if (w.frequency_rank >= l.range[0] && w.frequency_rank <= l.range[1]) {
            frequencyStats[l.label].learned++;
            break;
          }
        }
      }

      // Sidor
      if (w.sidor_rank) {
        for (const l of SIDOR_LEVELS) {
          if (w.sidor_rank >= l.range[0] && w.sidor_rank <= l.range[1]) {
            sidorStats[l.label].learned++;
            break;
          }
        }
      }
    }

    return {
      totalWords,
      learnedWords,
      kellyStats: {
        ...kellyStats,
        total: Object.values(kellyStats).reduce((acc, curr) => ({
          total: acc.total + curr.total,
          learned: acc.learned + curr.learned
        }), { total: 0, learned: 0 })
      },
      frequencyStats: {
        ...frequencyStats,
        total: Object.values(frequencyStats).reduce((acc, curr) => ({
          total: acc.total + curr.total,
          learned: acc.learned + curr.learned
        }), { total: 0, learned: 0 })
      },
      sidorStats: {
        ...sidorStats,
        total: Object.values(sidorStats).reduce((acc, curr) => ({
          total: acc.total + curr.total,
          learned: acc.learned + curr.learned
        }), { total: 0, learned: 0 })
      },
      ftStats: {
        total: await db.words.filter(w => !!w.is_ft || (!w.kelly_level && !w.frequency_rank && !w.sidor_rank)).count(),
        learned: learnedWordDefs.filter(w => !!w.is_ft || (!w.kelly_level && !w.frequency_rank && !w.sidor_rank)).length
      },
      reserveStats: {
        total: new Set((await db.progress.filter(p => !!p.is_reserve).toArray()).map(p => p.word_id)).size,
        learned: new Set((await db.progress.filter(p => !!p.is_reserve && !!p.is_learned).toArray()).map(p => p.word_id)).size
      },
      encounteredStats: {
        total: totalWords,
        learned: new Set([...learnedWordIds, ...(await db.progress.filter(p => !!p.is_reserve).toArray()).map(p => p.word_id)]).size
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

    const allReserved = await db.progress.filter(p => !!p.is_reserve).toArray();

    // Reserve stats
    const reservedTodayItems = allReserved.filter(p => p.reserved_at && new Date(p.reserved_at).getTime() >= localStartOfToday);
    const reservedToday = new Set(reservedTodayItems.map(p => p.word_id)).size;

    const allLearned = await db.progress.filter(p => !!p.is_learned).toArray();

    const learnedTodayItems = allLearned.filter(p => p.learned_date && new Date(p.learned_date).getTime() >= localStartOfToday);
    const learnedToday = new Set(learnedTodayItems.map(p => p.word_id)).size;

    const learnedThisWeekItems = allLearned.filter(p => p.learned_date && new Date(p.learned_date) >= weekAgo);
    const learnedThisWeek = new Set(learnedThisWeekItems.map(p => p.word_id)).size;

    const learnedThisMonthItems = allLearned.filter(p => p.learned_date && new Date(p.learned_date) >= monthAgo);
    const learnedThisMonth = new Set(learnedThisMonthItems.map(p => p.word_id)).size;

    // Breakdown for today
    let kellyToday = 0;
    let frequencyToday = 0;
    let sidorToday = 0;
    let ftToday = 0;

    // Bulk fetch words for today's learned items (by word_id)
    const todayWordIds = learnedTodayItems.map(p => p.word_id);
    if (todayWordIds.length > 0) {
      const todayWords = await db.words.where('id').anyOf(todayWordIds).toArray();
      for (const w of todayWords) {
        if (w.kelly_level) kellyToday++;
        if (w.frequency_rank) frequencyToday++;
        if (w.sidor_rank) sidorToday++;
        if (w.is_ft || (!w.kelly_level && !w.frequency_rank && !w.sidor_rank)) ftToday++;
      }
    }

    // Daily counts for chart (Kelly, Study Later, Encountered)
    const dailyCounts: { date: string; kelly: number; reserved: number; encountered: number }[] = [];

    // Fetch word definitions for all learned items to check if they are Kelly (by word_id)
    const allLearnedIds = allLearned.map(p => p.word_id);
    const allLearnedWords = await db.words.where('id').anyOf(allLearnedIds).toArray();
    const learnedKellyIds = new Set(allLearnedWords.filter(w => !!w.kelly_level).map(w => w.id));

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dTime = d.getTime();
      const nextDTime = nextD.getTime();

      const allLearnedToday = allLearned.filter(p => p.learned_date && new Date(p.learned_date).getTime() >= dTime && new Date(p.learned_date).getTime() < nextDTime);
      const allLearnedTodayCount = new Set(allLearnedToday.map(p => p.word_id)).size;

      const kellyProgress = allLearned.filter(p => p.learned_date && new Date(p.learned_date).getTime() >= dTime && new Date(p.learned_date).getTime() < nextDTime && learnedKellyIds.has(p.word_id));
      const kellyCount = new Set(kellyProgress.map(p => p.word_id)).size;

      const reservedProgress = allReserved.filter(p => p.reserved_at && new Date(p.reserved_at).getTime() >= dTime && new Date(p.reserved_at).getTime() < nextDTime);
      const reservedCount = new Set(reservedProgress.map(p => p.word_id)).size;

      // Calculate encountered as unique union of learned and reserved for this day
      const encounteredSet = new Set([
        ...allLearnedToday.map(p => p.word_id),
        ...reservedProgress.map(p => p.word_id)
      ]);

      dailyCounts.push({
        date: d.toISOString().split("T")[0],
        kelly: kellyCount,
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
      kellyToday,
      frequencyToday,
      sidorToday,
      ftToday,
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

    // Kelly list - A1, A2, B1 levels
    for (const level of targetLevels) {
      const kellyWords = await db.words.where('kelly_level').equals(level).toArray();
      for (const w of kellyWords) {
        b1WordsSet.add(w.swedish_word);
        if (learnedSwedishWords.has(w.swedish_word)) {
          learnedB1WordsSet.add(w.swedish_word);
        }
      }
    }

    // Frequency list - A1 (1-1500), A2 (1501-3000), B1 (3001-5000)
    const frequencyRanges = [
      [1, 1500],    // A1
      [1501, 3000], // A2
      [3001, 5000], // B1
    ];
    for (const [min, max] of frequencyRanges) {
      const freqWords = await db.words.where('frequency_rank').between(min, max, true, true).toArray();
      for (const w of freqWords) {
        b1WordsSet.add(w.swedish_word);
        if (learnedSwedishWords.has(w.swedish_word)) {
          learnedB1WordsSet.add(w.swedish_word);
        }
      }
    }

    // Sidor list - A1 (1-600), A2 (601-1200), B1 (1201-1800)
    const sidorRanges = [
      [1, 600],     // A1
      [601, 1200],  // A2
      [1201, 1800], // B1
    ];
    for (const [min, max] of sidorRanges) {
      const sidorWords = await db.words.where('sidor_rank').between(min, max, true, true).toArray();
      for (const w of sidorWords) {
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
    const todaysProgress = await db.progress
      .filter(p => !!p.is_learned && !!p.learned_date && new Date(p.learned_date).getTime() >= localStartOfToday)
      .toArray();

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
          kelly_level: w.kelly_level || null,
          kelly_source_id: w.kelly_source_id || null,
          frequency_rank: w.frequency_rank || null,
          sidor_source_id: null,
          sidor_rank: w.sidor_rank || null,
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
      kelly_level?: string;
      frequency_rank?: number;
      sidor_rank?: number;
      sidor_source_id?: number;
    }) => {
      // 1. Try to INSERT
      const cleanWord = data.swedish_word.toLowerCase().trim();
      const { data: inserted, error } = await supabase.from("words").insert({
        swedish_word: cleanWord,
        kelly_level: data.kelly_level || null,
        frequency_rank: data.frequency_rank || null,
        sidor_rank: data.sidor_rank || null,
        sidor_source_id: data.sidor_source_id || null,
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
        kelly_level: data.kelly_level || undefined,
        frequency_rank: data.frequency_rank || undefined,
        sidor_rank: data.sidor_rank || undefined,
        kelly_source_id: undefined,
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
      queryClient.invalidateQueries({ queryKey: ["nextFrequencyId"] });
      queryClient.invalidateQueries({ queryKey: ["nextSidorId"] });
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
