import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useStats, useDetailedStats, FREQUENCY_LEVELS, SIDOR_LEVELS, useTodaysLearnedWords, useLearningPrediction, useB1GoalProgress } from "@/hooks/useWords";
import { useAuth } from "@/contexts/AuthContext";
import {
  BookOpen,
  Flame,
  TrendingUp,
  Calendar,
  Target,
  Award,
  Hash,
  GraduationCap,
  Moon,
  BookMarked,
  Clock,
  Flag,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Search,
  Library,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { WordCard } from "@/components/study/WordCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const stats = useStats();
  const statsLoading = stats === undefined;

  // Use profile name if available, otherwise fallback to metadata or default
  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Shahab';

  const detailedStats = useDetailedStats();
  const detailedLoading = detailedStats === undefined;

  const todaysWords = useTodaysLearnedWords();
  const todaysLoading = todaysWords === undefined;
  const { data: prediction, isLoading: predictionLoading } = useLearningPrediction();
  const b1Goal = useB1GoalProgress();
  const b1GoalLoading = b1Goal === undefined;
  const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null);

  const selectedWord = todaysWords?.find(w => w.swedish_word === selectedWordKey);
  const selectedIndex = todaysWords?.findIndex(w => w.swedish_word === selectedWordKey) ?? -1;

  const totalLearned = stats?.learnedWords || 0;
  const totalWords = stats?.totalWords || 0;
  const progressPercent = totalWords > 0 ? (totalLearned / totalWords) * 100 : 0;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        {/* Combined Compact Header & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fade-in">

          {/* Welcome & Daily Snapshot (Span 8) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Hero Banner (Super Compact) */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 to-background border border-border p-5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4 z-10">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Flame className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">
                    Hej, <span className="text-primary">{displayName}</span>!
                  </h1>
                  <p className="text-xs text-muted-foreground">Keep up the streak!</p>
                </div>
              </div>

              {/* Daily Mini-Stats */}
              <div className="flex gap-3 z-10">
                <div className="flex flex-col items-end">
                  <span className="text-lg font-bold text-orange-500 leading-none">{detailedStats?.learnedToday || 0}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Learned</span>
                </div>
                <div className="w-px bg-border h-8 mx-1"></div>
                <div className="flex flex-col items-start">
                  <span className="text-lg font-bold text-amber-500 leading-none">{detailedStats?.reservedToday || 0}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Reserved</span>
                </div>
              </div>

              {/* Decor */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl translate-x-10 -translate-y-10" />
            </div>

            {/* Main Chart Card */}
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm h-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" /> Daily Activity
                </h2>
                <div className="flex gap-3 text-[10px] font-medium">
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Learned</span>
                  <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Reserved</span>
                </div>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detailedStats?.dailyCounts || []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => val.split('-')[2]} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", padding: "8px" }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <Line type="monotone" dataKey="learned" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="reserved" stroke="#f59e0b" strokeWidth={2} strokeDasharray="3 3" dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column: Lists & Goals (Span 4) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Combined Lists Progress Card */}
            <div className="group bg-card rounded-2xl border border-border p-4 shadow-sm hover:shadow-md transition-all">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Library className="h-4 w-4 text-muted-foreground" /> Lists Overview
              </h2>
              <div className="space-y-3">
                {/* Kelly */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-emerald-600 flex items-center gap-1"><GraduationCap className="h-3 w-3" />Kelly</span>
                    <span className="text-muted-foreground">{(stats?.kellyStats as any)?.total?.learned || 0}/{(stats?.kellyStats as any)?.total?.total || 0}</span>
                  </div>
                  <Progress value={((stats?.kellyStats as any)?.total?.total || 0) > 0 ? (((stats?.kellyStats as any)?.total?.learned || 0) / ((stats?.kellyStats as any)?.total?.total || 1)) * 100 : 0} className="h-1.5 bg-emerald-500/10" indicatorClassName="bg-emerald-500" />
                </div>
                {/* Frequency */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-blue-600 flex items-center gap-1"><Hash className="h-3 w-3" />Frequency</span>
                    <span className="text-muted-foreground">{(stats?.frequencyStats as any)?.total?.learned || 0}/{(stats?.frequencyStats as any)?.total?.total || 0}</span>
                  </div>
                  <Progress value={((stats?.frequencyStats as any)?.total?.total || 0) > 0 ? (((stats?.frequencyStats as any)?.total?.learned || 0) / ((stats?.frequencyStats as any)?.total?.total || 1)) * 100 : 0} className="h-1.5 bg-blue-500/10" indicatorClassName="bg-blue-500" />
                </div>
                {/* Sidor */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-purple-600 flex items-center gap-1"><BookMarked className="h-3 w-3" />Sidor</span>
                    <span className="text-muted-foreground">{(stats?.sidorStats as any)?.total?.learned || 0}/{(stats?.sidorStats as any)?.total?.total || 0}</span>
                  </div>
                  <Progress value={((stats?.sidorStats as any)?.total?.total || 0) > 0 ? (((stats?.sidorStats as any)?.total?.learned || 0) / ((stats?.sidorStats as any)?.total?.total || 1)) * 100 : 0} className="h-1.5 bg-purple-500/10" indicatorClassName="bg-purple-500" />
                </div>
                {/* FT List (Only if active) */}
                {stats?.ftStats.total! > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-indigo-600 flex items-center gap-1"><Sparkles className="h-3 w-3" />FT List</span>
                      <span className="text-muted-foreground">{stats?.ftStats.learned}/{stats?.ftStats.total}</span>
                    </div>
                    <Progress value={(stats?.ftStats.learned! / stats?.ftStats.total!) * 100} className="h-1.5 bg-indigo-500/10" indicatorClassName="bg-indigo-500" />
                  </div>
                )}
              </div>
            </div>

            {/* B1 Goal Mini-Card */}
            {b1Goal && (
              <div className={`rounded-2xl border p-4 shadow-sm relative overflow-hidden ${b1Goal.isOnTrack ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide opacity-80">B1 Goal</h3>
                    <p className="text-lg font-bold">{b1Goal.progressPercent.toFixed(1)}% <span className="text-[10px] font-normal opacity-70">Complete</span></p>
                  </div>
                  {b1Goal.isOnTrack ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                </div>
                <div className="text-[10px] text-muted-foreground flex justify-between">
                  <span>Deadline: Apr 1</span>
                  <span>{b1Goal.remainingB1Words} words left</span>
                </div>
              </div>
            )}

            {/* Total Progress & Study Later Mini-Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-3 flex flex-col justify-center items-center text-center shadow-sm">
                <span className="text-sm font-medium text-foreground">{progressPercent.toFixed(1)}%</span>
                <span className="text-[10px] text-muted-foreground">Total Learned</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 flex flex-col justify-center items-center text-center shadow-sm">
                <span className="text-sm font-medium text-amber-500">{stats?.reserveStats.total || 0}</span>
                <span className="text-[10px] text-muted-foreground">Study Later</span>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Review Section */}
        <div className="animate-fade-in" style={{ animationDelay: "250ms" }}>
          {todaysLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : todaysWords && todaysWords.length > 0 && (
            <div className="word-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Moon className="h-5 w-5 text-primary" />
                Today's Review ({todaysWords.length} words)
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Review the words you learned today before going to sleep.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {todaysWords.map((word) => (
                  <div
                    key={word.swedish_word}
                    className="p-4 border border-border rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedWordKey(word.swedish_word)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-semibold text-foreground">
                        {word.progress?.custom_spelling || word.swedish_word}
                      </span>
                      <div className="flex gap-1">
                        {word.kelly_level && (
                          <span className={`text-xs px-2 py-0.5 rounded level-badge-${word.kelly_level.toLowerCase()}`}>
                            {word.kelly_level}
                          </span>
                        )}
                        {word.frequency_rank && (
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            #{word.frequency_rank}
                          </span>
                        )}
                        {word.sidor_rank && (
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            S#{word.sidor_rank}
                          </span>
                        )}
                      </div>
                    </div>
                    {word.progress?.user_meaning && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {word.progress.user_meaning}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Dialog open={!!selectedWord} onOpenChange={(open) => !open && setSelectedWordKey(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogTitle className="sr-only">Word Details</DialogTitle>
              {selectedWord && (
                <WordCard
                  word={selectedWord}
                  onPrevious={() => {
                    const prevIndex = selectedIndex - 1;
                    if (prevIndex >= 0 && todaysWords) {
                      setSelectedWordKey(todaysWords[prevIndex].swedish_word);
                    }
                  }}
                  onNext={() => {
                    const nextIndex = selectedIndex + 1;
                    if (todaysWords && nextIndex < todaysWords.length) {
                      setSelectedWordKey(todaysWords[nextIndex].swedish_word);
                    }
                  }}
                  hasPrevious={selectedIndex > 0}
                  hasNext={todaysWords ? selectedIndex < todaysWords.length - 1 : false}
                  currentIndex={selectedIndex}
                  totalCount={todaysWords?.length || 0}
                  learnedCount={todaysWords?.length || 0}
                  isRandomMode={false}
                  onToggleRandom={() => { }}
                  showRandomButton={false}
                />
              )}
            </DialogContent>
          </Dialog>

        </div>

        {/* Stats Summary Cards */}
        <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
          {detailedLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (<Skeleton key={i} className="h-24 w-full rounded-2xl" />))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card gold-highlight">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-accent/30 rounded-lg"><Flame className="h-5 w-5 text-accent-foreground" /></div>
                    <span className="text-3xl font-bold text-foreground">{detailedStats?.learnedToday || 0}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Learned Today</p>
                </div>
                <div className="stat-card">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-primary/10 rounded-lg"><Calendar className="h-5 w-5 text-primary" /></div>
                    <span className="text-3xl font-bold text-foreground">{detailedStats?.learnedThisWeek || 0}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">This Week</p>
                </div>
                <div className="stat-card">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-success/10 rounded-lg"><Target className="h-5 w-5 text-success" /></div>
                    <span className="text-3xl font-bold text-foreground">{detailedStats?.learnedThisMonth || 0}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">This Month</p>
                </div>
                <div className="stat-card">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-primary/10 rounded-lg"><Award className="h-5 w-5 text-primary" /></div>
                    <span className="text-3xl font-bold text-foreground">{detailedStats?.allTime || 0}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">All Time</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="stat-card">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Avg. Words/Day</span>
                  </div>
                  <span className="text-2xl font-bold text-primary">{detailedStats?.avgPerDay || 0}</span>
                </div>
                <div className="stat-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-4 w-4 text-accent-foreground" />
                    <span className="text-sm font-medium text-foreground">Best Day</span>
                  </div>
                  <span className="text-2xl font-bold text-accent-foreground">{detailedStats?.maxDaily || 0} words</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Daily Progress Chart */}
        <div className="animate-fade-in" style={{ animationDelay: "350ms" }}>
          {detailedLoading ? (
            <Skeleton className="h-80 w-full rounded-2xl" />
          ) : detailedStats?.dailyCounts && detailedStats.dailyCounts.length > 0 && (
            <div className="word-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Daily Progress (Last 30 Days)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detailedStats?.dailyCounts || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => { const date = new Date(value); return `${date.getMonth() + 1}/${date.getDate()}`; }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} labelFormatter={(value) => { const date = new Date(value); return date.toLocaleDateString(); }} />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }} activeDot={{ r: 6, fill: "hsl(var(--accent))" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {totalWords === 0 && !statsLoading && (
          <div className="text-center py-12 animate-fade-in">
            <div className="p-4 bg-primary/10 rounded-2xl w-fit mx-auto mb-4">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">No words yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Import your word lists from the Settings page to get started with your vocabulary training.
            </p>
            <Link to="/settings" className="inline-flex items-center gap-2 mt-4 text-primary font-medium hover:underline">
              Go to Settings
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
