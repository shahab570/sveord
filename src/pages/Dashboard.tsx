import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useUnifiedStats } from "@/hooks/useUnifiedStats";
import { useTodaysLearnedWords } from "@/hooks/useWords";
import { useTodaysReservedWords } from "@/hooks/useTodaysReserved";
import { useAuth } from "@/contexts/AuthContext";
import {
  BookOpen,
  Flame,
  TrendingUp,
  Target,
  Award,
  Book,
  Moon,
  Bookmark,
  CheckCircle,
  Clock,
  Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { WordCard } from "@/components/study/WordCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { db } from "@/services/db";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { useEffect } from "react";



export default function Dashboard() {
  const { user, profile } = useAuth();
  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Shahab';

  const stats = useUnifiedStats();
  const todaysLearned = useTodaysLearnedWords();
  const todaysReserved = useTodaysReservedWords();

  const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null);
  const [showReservedToday, setShowReservedToday] = useState(false); // Toggle for Today's section

  // Determine which list is active for the "Today's Review" section
  const activeTodaysList = showReservedToday ? todaysReserved : todaysLearned;
  const activeTodaysLoading = showReservedToday ? (todaysReserved === undefined) : (todaysLearned === undefined);

  // For the dialog navigation
  const selectedWord = activeTodaysList?.find(w => w.swedish_word === selectedWordKey);
  const selectedIndex = activeTodaysList?.findIndex(w => w.swedish_word === selectedWordKey) ?? -1;

  if (!stats.hasData && !activeTodaysLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <h2 className="text-2xl font-bold">Welcome directly to your Unified Dashboard!</h2>
          <p className="text-muted-foreground">Start by searching and adding words to see your stats here.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">

        {/* 1. Hero / Welcome / Velocity */}
        {/* Main Grid */}
        <div className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            {/* Welcome Card & Velocity */}
            <div className="md:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-secondary/20 border border-border p-6 shadow-sm">
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-bold">Hej, <span className="text-primary">{displayName}</span>!</h1>
                    <p className="text-sm text-muted-foreground">Here is your daily learning velocity.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm p-2 rounded-lg border border-border/50">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <span className="font-bold">{stats.velocity.learnedToday}</span>
                    <span className="text-xs text-muted-foreground uppercase">Streak</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="p-3 bg-background/60 rounded-xl border border-border/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-xs font-semibold uppercase text-muted-foreground">Learned Today</span>
                    </div>
                    <span className="text-2xl font-bold text-foreground">+{stats.velocity.learnedToday}</span>
                  </div>
                  <div
                    className="p-3 bg-background/60 rounded-xl border border-border/50 backdrop-blur-sm cursor-pointer hover:bg-background/80 transition-colors"
                    onClick={() => {
                      setShowReservedToday(true);
                      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Bookmark className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-semibold uppercase text-muted-foreground">To Study Queue</span>
                    </div>
                    <span className="text-2xl font-bold text-foreground">+{stats.velocity.reservedToday}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Proficiency Overview (Mastered vs To Study) */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-center gap-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" /> Proficiency Overview
              </h3>

              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-bold text-green-600">{stats.proficiency.mastered}</span>
                    <span className="text-xs font-medium uppercase text-muted-foreground mb-1">{stats.proficiency.completionPercent}% Mastered</span>
                  </div>
                  <Progress value={stats.proficiency.completionPercent} className="h-2 bg-green-100" indicatorClassName="bg-green-500" />
                </div>
                <div className="h-10 w-[1px] bg-border"></div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-bold text-amber-500">{stats.proficiency.toStudy}</span>
                    <span className="text-xs font-medium uppercase text-muted-foreground mb-1">
                      {stats.proficiency.totalUnique > 0 ? Math.round((stats.proficiency.toStudy / stats.proficiency.totalUnique) * 100) : 0}% Queue
                    </span>
                  </div>
                  {/* Display queue percentage relative to total words for context, or just full bar? Let's use relative to total for visual consistency with mastered */}
                  <Progress value={stats.proficiency.totalUnique > 0 ? (stats.proficiency.toStudy / stats.proficiency.totalUnique) * 100 : 0} className="h-2 bg-amber-100" indicatorClassName="bg-amber-500" />
                </div>
              </div>

              <div className="text-xs text-center text-muted-foreground mt-2">
                {stats.proficiency.totalUnique} Total Unique Words
              </div>
            </div>
          </div>

          {/* 2. CEFR Proficiency (The "Main Event") */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> CEFR Mastery Levels
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(stats.cefrProgress).map(([level, data]) => (
                level !== "Unknown" && (
                  <div key={level} className="flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-background/50 hover:bg-secondary/30 transition-colors">
                    <div className="flex justify-between items-end">
                      <span className="text-2xl font-black text-foreground tracking-tight">
                        {level}
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {data.percent}%
                      </span>
                    </div>

                    <Progress value={data.percent} className="h-2.5 bg-secondary" indicatorClassName="bg-primary" />

                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      <span>{data.learned} Learned</span>
                      <span className="opacity-70">of {data.total}</span>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* 3. Today's Review Section (Consolidated) */}
          <div className="animate-fade-in mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Moon className="h-5 w-5 text-primary" />
                Today's Activity
              </h2>

              {/* Toggle Buttons */}
              <div className="flex gap-2 bg-secondary/30 p-1 rounded-lg">
                <button
                  onClick={() => setShowReservedToday(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!showReservedToday ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Learned ({stats.velocity.learnedToday})
                </button>
                <button
                  onClick={() => setShowReservedToday(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${showReservedToday ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Added to Queue ({stats.velocity.reservedToday})
                </button>
              </div>
            </div>

            {activeTodaysLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : activeTodaysList && activeTodaysList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeTodaysList.map((word) => (
                  <div
                    key={word.swedish_word}
                    className={`p-4 border rounded-xl transition-all cursor-pointer group hover:shadow-md ${showReservedToday
                      ? 'bg-amber-500/5 border-amber-500/10 hover:border-amber-500/30'
                      : 'bg-green-500/5 border-green-500/10 hover:border-green-500/30'
                      }`}
                    onClick={() => setSelectedWordKey(word.swedish_word)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                        {word.swedish_word}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${showReservedToday
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-green-100 text-green-700 border-green-200'
                        }`}>
                        {showReservedToday ? 'To Study' : 'Learned'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {(word.progress?.user_meaning || word.word_data?.meanings?.[0]?.english) ?? "No translation"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed border-border rounded-xl bg-secondary/5">
                <p className="text-muted-foreground text-sm">No words {showReservedToday ? 'added to study queue' : 'learned'} today yet.</p>
              </div>
            )}
          </div>

          {/* Dialog for Word Details */}
          <Dialog open={!!selectedWord} onOpenChange={(open) => !open && setSelectedWordKey(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogTitle className="sr-only">Word Details</DialogTitle>
              {selectedWord && (
                <WordCard
                  word={selectedWord}
                  onPrevious={() => {
                    const prevIndex = selectedIndex - 1;
                    if (prevIndex >= 0 && activeTodaysList) {
                      setSelectedWordKey(activeTodaysList[prevIndex].swedish_word);
                    }
                  }}
                  onNext={() => {
                    const nextIndex = selectedIndex + 1;
                    if (activeTodaysList && nextIndex < activeTodaysList.length) {
                      setSelectedWordKey(activeTodaysList[nextIndex].swedish_word);
                    }
                  }}
                  hasPrevious={selectedIndex > 0}
                  hasNext={activeTodaysList ? selectedIndex < activeTodaysList.length - 1 : false}
                  currentIndex={selectedIndex}
                  totalCount={activeTodaysList?.length || 0}
                  learnedCount={0}
                  isRandomMode={false}
                  onToggleRandom={() => { }}
                  showRandomButton={false}
                />
              )}
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </AppLayout>
  );
}
