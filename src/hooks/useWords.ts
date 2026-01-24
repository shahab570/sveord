import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  is_learned: boolean;
  learned_date: string | null;
  user_meaning: string | null;
  custom_spelling: string | null;
  created_at: string;
  updated_at: string;
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

  return useQuery({
    queryKey: ["words", filters, user?.id],
    queryFn: async () => {
      let query = supabase.from("words").select("*");

      if (filters?.kellyLevel) {
        query = query.eq("kelly_level", filters.kellyLevel);
      }

      if (filters?.frequencyRange) {
        query = query
          .gte("frequency_rank", filters.frequencyRange[0])
          .lte("frequency_rank", filters.frequencyRange[1]);
      }

      if (filters?.sidorRange) {
        query = query
          .gte("sidor_rank", filters.sidorRange[0])
          .lte("sidor_rank", filters.sidorRange[1]);
      }

      // Multi-word phrase search: use OR to match any token
      if (filters?.search) {
        const searchTokens = filters.search.toLowerCase().trim().split(/\s+/).filter(t => t.length >= 2);
        if (searchTokens.length > 0) {
          const orConditions = searchTokens.map(token => `swedish_word.ilike.%${token}%`).join(',');
          query = query.or(orConditions);
        } else {
          query = query.ilike("swedish_word", `%${filters.search}%`);
        }
      }

      // Filter by list type exclusively
      if (filters?.listType === "kelly") {
        query = query.not("kelly_level", "is", null);
      } else if (filters?.listType === "frequency") {
        query = query.not("frequency_rank", "is", null);
      } else if (filters?.listType === "sidor") {
        query = query.not("sidor_rank", "is", null);
      }

      // Order by source ID/rank for respective list types
      if (filters?.kellyLevel || filters?.listType === "kelly") {
        query = query
          .order("kelly_source_id", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true });
      } else if (filters?.frequencyRange || filters?.listType === "frequency") {
        query = query
          .order("frequency_rank", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true });
      } else if (filters?.sidorRange || filters?.listType === "sidor") {
        query = query
          .order("sidor_rank", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true });
      } else {
        query = query.order("id", { ascending: true });
      }

      const { data: words, error } = await query;
      if (error) throw error;

      // Fetch user progress for these words
      if (user && words && words.length > 0) {
        const wordIds = words.map((w) => w.id);
        const { data: progress } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", user.id)
          .in("word_id", wordIds);

        const progressMap = new Map(
          progress?.map((p) => [p.word_id, p]) || []
        );

        let result: WordWithProgress[] = words.map((word) => ({
          ...word,
          word_data: word.word_data as unknown as WordData | null,
          progress: progressMap.get(word.id),
        }));

        if (filters?.learnedOnly) {
          result = result.filter((w) => w.progress?.is_learned);
        }

        return result;
      }

      return words.map((word) => ({
        ...word,
        word_data: word.word_data as unknown as WordData | null,
      })) as WordWithProgress[];
    },
    enabled: !!user,
  });
}

// Hook to get level stats for a specific list type
export function useLevelStats(listType: "kelly" | "frequency" | "sidor") {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["levelStats", listType, user?.id],
    queryFn: async () => {
      if (listType === "kelly") {
        const stats: Record<string, { total: number; learned: number }> = {};
        
        for (const level of CEFR_LEVELS) {
          const { count: total } = await supabase
            .from("words")
            .select("id", { count: "exact", head: true })
            .eq("kelly_level", level);

          const { count: learnedCount } = await supabase
            .from("user_progress")
            .select("word_id, words!inner(kelly_level)", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .eq("is_learned", true)
            .eq("words.kelly_level", level);

          stats[level] = { total: total || 0, learned: learnedCount || 0 };
        }
        return stats;
      } else if (listType === "frequency") {
        const stats: Record<string, { total: number; learned: number }> = {};
        
        for (const freqLevel of FREQUENCY_LEVELS) {
          const { count: total } = await supabase
            .from("words")
            .select("id", { count: "exact", head: true })
            .gte("frequency_rank", freqLevel.range[0])
            .lte("frequency_rank", freqLevel.range[1]);

          const { count: learnedCount } = await supabase
            .from("user_progress")
            .select("word_id, words!inner(frequency_rank)", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .eq("is_learned", true)
            .gte("words.frequency_rank", freqLevel.range[0])
            .lte("words.frequency_rank", freqLevel.range[1]);

          stats[freqLevel.label] = { total: total || 0, learned: learnedCount || 0 };
        }
        return stats;
      } else {
        // Sidor list
        const stats: Record<string, { total: number; learned: number }> = {};
        
        for (const sidorLevel of SIDOR_LEVELS) {
          const { count: total } = await supabase
            .from("words")
            .select("id", { count: "exact", head: true })
            .gte("sidor_rank", sidorLevel.range[0])
            .lte("sidor_rank", sidorLevel.range[1]);

          const { count: learnedCount } = await supabase
            .from("user_progress")
            .select("word_id, words!inner(sidor_rank)", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .eq("is_learned", true)
            .gte("words.sidor_rank", sidorLevel.range[0])
            .lte("words.sidor_rank", sidorLevel.range[1]);

          stats[sidorLevel.label] = { total: total || 0, learned: learnedCount || 0 };
        }
        return stats;
      }
    },
    enabled: !!user,
  });
}

export function useUserProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const upsertProgress = useMutation({
    mutationFn: async (data: {
      word_id: number;
      is_learned?: boolean;
      user_meaning?: string;
      custom_spelling?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: wordData } = await supabase
        .from("words")
        .select("swedish_word")
        .eq("id", data.word_id)
        .single();

      if (!wordData) throw new Error("Word not found");

      const { data: allMatchingWords } = await supabase
        .from("words")
        .select("id")
        .eq("swedish_word", wordData.swedish_word);

      const wordIds = allMatchingWords?.map(w => w.id) || [data.word_id];

      for (const wordId of wordIds) {
        const { data: existing } = await supabase
          .from("user_progress")
          .select("id")
          .eq("user_id", user.id)
          .eq("word_id", wordId)
          .maybeSingle();

        const updateData = {
          ...data,
          word_id: wordId,
          user_id: user.id,
          learned_date: data.is_learned ? new Date().toISOString() : null,
        };

        if (existing) {
          const { error } = await supabase
            .from("user_progress")
            .update(updateData)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("user_progress").insert(updateData);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["words"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["detailedStats"] });
      queryClient.invalidateQueries({ queryKey: ["levelStats"] });
      queryClient.invalidateQueries({ queryKey: ["todaysLearnedWords"] });
      queryClient.invalidateQueries({ queryKey: ["learningPrediction"] });
    },
  });

  const resetProgress = useMutation({
    mutationFn: async (filter: { 
      kellyLevel?: string; 
      frequencyRange?: [number, number];
      sidorRange?: [number, number];
      all?: boolean;
      listType?: "kelly" | "frequency" | "sidor";
    }) => {
      if (!user) throw new Error("Not authenticated");

      if (filter.all) {
        const { error } = await supabase
          .from("user_progress")
          .delete()
          .eq("user_id", user.id);
        if (error) throw error;
        return;
      }

      let query = supabase.from("words").select("id");
      
      if (filter.kellyLevel && filter.listType === "kelly") {
        query = query.eq("kelly_level", filter.kellyLevel);
      }
      
      if (filter.frequencyRange && filter.listType === "frequency") {
        query = query
          .gte("frequency_rank", filter.frequencyRange[0])
          .lte("frequency_rank", filter.frequencyRange[1]);
      }

      if (filter.sidorRange && filter.listType === "sidor") {
        query = query
          .gte("sidor_rank", filter.sidorRange[0])
          .lte("sidor_rank", filter.sidorRange[1]);
      }

      // Legacy support for old API
      if (filter.kellyLevel && !filter.listType) {
        query = query.eq("kelly_level", filter.kellyLevel);
      }
      if (filter.frequencyRange && !filter.listType) {
        query = query
          .gte("frequency_rank", filter.frequencyRange[0])
          .lte("frequency_rank", filter.frequencyRange[1]);
      }

      const { data: words } = await query;
      if (words && words.length > 0) {
        const wordIds = words.map((w) => w.id);
        const { error } = await supabase
          .from("user_progress")
          .delete()
          .eq("user_id", user.id)
          .in("word_id", wordIds);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["words"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["detailedStats"] });
      queryClient.invalidateQueries({ queryKey: ["levelStats"] });
      queryClient.invalidateQueries({ queryKey: ["learningPrediction"] });
    },
  });

  return { upsertProgress, resetProgress };
}

export function useStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["stats", user?.id],
    queryFn: async () => {
      const { count: totalWords } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true });

      const { count: learned } = await supabase
        .from("user_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_learned", true);

      // Kelly level counts
      const kellyStats: Record<string, { total: number; learned: number }> = {};
      for (const level of CEFR_LEVELS) {
        const { count: total } = await supabase
          .from("words")
          .select("id", { count: "exact", head: true })
          .eq("kelly_level", level);

        const { count: learnedCount } = await supabase
          .from("user_progress")
          .select("word_id, words!inner(kelly_level)", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("is_learned", true)
          .eq("words.kelly_level", level);

        kellyStats[level] = { total: total || 0, learned: learnedCount || 0 };
      }

      // Frequency level counts
      const frequencyStats: Record<string, { total: number; learned: number }> = {};
      for (const freqLevel of FREQUENCY_LEVELS) {
        const { count: total } = await supabase
          .from("words")
          .select("id", { count: "exact", head: true })
          .gte("frequency_rank", freqLevel.range[0])
          .lte("frequency_rank", freqLevel.range[1]);

        const { count: learnedCount } = await supabase
          .from("user_progress")
          .select("word_id, words!inner(frequency_rank)", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("is_learned", true)
          .gte("words.frequency_rank", freqLevel.range[0])
          .lte("words.frequency_rank", freqLevel.range[1]);

        frequencyStats[freqLevel.label] = { total: total || 0, learned: learnedCount || 0 };
      }

      // Sidor level counts
      const sidorStats: Record<string, { total: number; learned: number }> = {};
      for (const sidorLevel of SIDOR_LEVELS) {
        const { count: total } = await supabase
          .from("words")
          .select("id", { count: "exact", head: true })
          .gte("sidor_rank", sidorLevel.range[0])
          .lte("sidor_rank", sidorLevel.range[1]);

        const { count: learnedCount } = await supabase
          .from("user_progress")
          .select("word_id, words!inner(sidor_rank)", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("is_learned", true)
          .gte("words.sidor_rank", sidorLevel.range[0])
          .lte("words.sidor_rank", sidorLevel.range[1]);

        sidorStats[sidorLevel.label] = { total: total || 0, learned: learnedCount || 0 };
      }

      return {
        totalWords: totalWords || 0,
        learnedWords: learned || 0,
        kellyStats,
        frequencyStats,
        sidorStats,
      };
    },
    enabled: !!user,
  });
}

export function useDetailedStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["detailedStats", user?.id],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      const { data: allProgress } = await supabase
        .from("user_progress")
        .select("*, words!inner(kelly_level, frequency_rank, sidor_rank)")
        .eq("user_id", user!.id)
        .eq("is_learned", true);

      const learnedToday = allProgress?.filter((p) => {
        if (!p.learned_date) return false;
        const learnedDate = new Date(p.learned_date);
        return learnedDate >= today;
      }) || [];

      const learnedThisWeek = allProgress?.filter((p) => {
        if (!p.learned_date) return false;
        const learnedDate = new Date(p.learned_date);
        return learnedDate >= weekAgo;
      }) || [];

      const learnedThisMonth = allProgress?.filter((p) => {
        if (!p.learned_date) return false;
        const learnedDate = new Date(p.learned_date);
        return learnedDate >= monthAgo;
      }) || [];

      // Separate counts for each list type
      const kellyToday = learnedToday.filter((p) => (p.words as any)?.kelly_level).length;
      const frequencyToday = learnedToday.filter((p) => (p.words as any)?.frequency_rank).length;
      const sidorToday = learnedToday.filter((p) => (p.words as any)?.sidor_rank).length;

      // Get daily counts for the past 30 days
      const dailyCounts: { date: string; count: number }[] = [];
      let maxDaily = 0;

      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = allProgress?.filter((p) => {
          if (!p.learned_date) return false;
          const learnedDate = new Date(p.learned_date);
          return learnedDate >= date && learnedDate < nextDate;
        }).length || 0;

        if (count > maxDaily) maxDaily = count;

        dailyCounts.push({
          date: date.toISOString().split("T")[0],
          count,
        });
      }

      const totalDays = 30;
      const avgPerDay = (allProgress?.length || 0) > 0 
        ? Math.round((learnedThisMonth.length / Math.min(totalDays, 30)) * 10) / 10
        : 0;

      return {
        learnedToday: learnedToday.length,
        kellyToday,
        frequencyToday,
        sidorToday,
        learnedThisWeek: learnedThisWeek.length,
        learnedThisMonth: learnedThisMonth.length,
        allTime: allProgress?.length || 0,
        avgPerDay,
        maxDaily,
        dailyCounts,
      };
    },
    enabled: !!user,
  });
}

// Learning Prediction Hook - calculates estimated completion date based on last 10 days
export function useLearningPrediction() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["learningPrediction", user?.id],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tenDaysAgo = new Date(today);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      // Get total words remaining (not learned)
      const { count: totalWords } = await supabase
        .from("words")
        .select("id", { count: "exact", head: true });

      const { count: learnedCount } = await supabase
        .from("user_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_learned", true);

      const remainingWords = (totalWords || 0) - (learnedCount || 0);

      // Get words learned in the last 10 days
      const { data: recentProgress } = await supabase
        .from("user_progress")
        .select("learned_date")
        .eq("user_id", user!.id)
        .eq("is_learned", true)
        .gte("learned_date", tenDaysAgo.toISOString());

      const wordsLast10Days = recentProgress?.length || 0;
      const avgWordsPerDay = wordsLast10Days / 10;

      // Calculate estimated completion date
      let estimatedCompletionDate: string | null = null;
      let daysRemaining: number | null = null;

      if (avgWordsPerDay > 0 && remainingWords > 0) {
        daysRemaining = Math.ceil(remainingWords / avgWordsPerDay);
        const completionDate = new Date(today);
        completionDate.setDate(completionDate.getDate() + daysRemaining);
        estimatedCompletionDate = completionDate.toISOString().split("T")[0];
      }

      return {
        totalWords: totalWords || 0,
        learnedCount: learnedCount || 0,
        remainingWords,
        wordsLast10Days,
        avgWordsPerDay: Math.round(avgWordsPerDay * 10) / 10,
        daysRemaining,
        estimatedCompletionDate,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - only update once a day
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
