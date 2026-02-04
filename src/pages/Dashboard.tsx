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

function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    import('@/utils/exportUtils').then(async (mod) => {
      try {
        const count = await mod.exportUnifiedList();
        alert(`Success! Exported ${count} unique words.`);
      } catch (e) {
        alert("Export failed. See console.");
        console.error(e);
      } finally {
        setIsExporting(false);
      }
    });
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`absolute top-4 right-4 z-20 p-2 rounded-full border border-border/50 text-muted-foreground transition-all ${isExporting ? 'bg-background/80 cursor-not-allowed opacity-50' : 'bg-background/50 hover:bg-background/80'}`}
      title="Export Unified List"
    >
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[10px] font-medium uppercase tracking-wider">
          {isExporting ? 'Exporting...' : 'Export List'}
        </span>
      </div>
    </button>
  );
}

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
  const [expandedList, setExpandedList] = useState<"kelly" | "frequency" | "sidor" | "ft" | null>(null);

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

              {/* Daily Stats List (Text-based) */}
              <div className="flex flex-col gap-1 z-10 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-orange-500">{detailedStats?.learnedToday || 0}</span>
                  <span className="text-muted-foreground uppercase tracking-tight">Learned Today</span>
                  <span className="text-[10px] opacity-70">
                    ({[
                      detailedStats?.kellyToday ? `${detailedStats.kellyToday} Kelly` : null,
                      detailedStats?.frequencyToday ? `${detailedStats.frequencyToday} Freq` : null,
                      detailedStats?.sidorToday ? `${detailedStats.sidorToday} Sidor` : null,
                      detailedStats?.ftToday ? `${detailedStats.ftToday} FT` : null
                    ].filter(Boolean).join(", ")})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-500">{detailedStats?.reservedToday || 0}</span>
                  <span className="text-muted-foreground uppercase tracking-tight">Study Later Today</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{(detailedStats?.learnedToday || 0) + (detailedStats?.reservedToday || 0)}</span>
                  <span className="text-muted-foreground uppercase tracking-tight">Encountered Today</span>
                </div>
              </div>

              {/* Decor */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl translate-x-10 -translate-y-10" />

              <ExportButton />
            </div>
          </div>

          {/* Daily Activity Graph (3 Lines) */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm h-[280px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" /> Activity (Last 30 Days)
              </h2>
              <div className="flex gap-3 text-[9px] font-medium">
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Kelly</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Study Later</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Encountered</span>
              </div>
            </div>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={detailedStats?.dailyCounts || []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => val.split('-')[2]} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "10px", padding: "6px" }}
                    labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <Line name="Kelly" type="monotone" dataKey="kelly" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line name="Study Later" type="monotone" dataKey="reserved" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line name="Encountered" type="monotone" dataKey="encountered" stroke="#6366f1" strokeWidth={2} strokeDasharray="3 3" dot={false} activeDot={{ r: 4 }} />
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
              <div className="space-y-1 cursor-pointer group/item" onClick={() => setExpandedList(expandedList === "kelly" ? null : "kelly")}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-emerald-600 flex items-center gap-1"><GraduationCap className="h-3 w-3" />Kelly</span>
                  <span className="text-muted-foreground">{(stats?.kellyStats as any)?.total?.learned || 0}/{(stats?.kellyStats as any)?.total?.total || 0}</span>
                </div>
                <Progress value={((stats?.kellyStats as any)?.total?.total || 0) > 0 ? (((stats?.kellyStats as any)?.total?.learned || 0) / ((stats?.kellyStats as any)?.total?.total || 1)) * 100 : 0} className="h-1.5 bg-emerald-500/10" indicatorClassName="bg-emerald-500" />

                {expandedList === "kelly" && (
                  <div className="grid grid-cols-3 gap-1 mt-2 p-2 bg-emerald-500/5 rounded-lg text-[10px] animate-in fade-in slide-in-from-top-1">
                    {["A1", "A2", "B1", "B2", "C1", "C2"].map(level => (
                      <div key={level} className="flex flex-col">
                        <span className="font-bold opacity-70">{level}</span>
                        <span className="text-muted-foreground">{(stats?.kellyStats as any)[level]?.learned || 0}/{(stats?.kellyStats as any)[level]?.total || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Frequency */}
              <div className="space-y-1 cursor-pointer group/item" onClick={() => setExpandedList(expandedList === "frequency" ? null : "frequency")}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-blue-600 flex items-center gap-1"><Hash className="h-3 w-3" />Frequency</span>
                  <span className="text-muted-foreground">{(stats?.frequencyStats as any)?.total?.learned || 0}/{(stats?.frequencyStats as any)?.total?.total || 0}</span>
                </div>
                <Progress value={((stats?.frequencyStats as any)?.total?.total || 0) > 0 ? (((stats?.frequencyStats as any)?.total?.learned || 0) / ((stats?.frequencyStats as any)?.total?.total || 1)) * 100 : 0} className="h-1.5 bg-blue-500/10" indicatorClassName="bg-blue-500" />

                {expandedList === "frequency" && (
                  <div className="grid grid-cols-3 gap-1 mt-2 p-2 bg-blue-500/5 rounded-lg text-[10px] animate-in fade-in slide-in-from-top-1">
                    {FREQUENCY_LEVELS.map(l => (
                      <div key={l.label} className="flex flex-col">
                        <span className="font-bold opacity-70">{l.label}</span>
                        <span className="text-muted-foreground">{(stats?.frequencyStats as any)[l.label]?.learned || 0}/{(stats?.frequencyStats as any)[l.label]?.total || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Sidor */}
              <div className="space-y-1 cursor-pointer group/item" onClick={() => setExpandedList(expandedList === "sidor" ? null : "sidor")}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-purple-600 flex items-center gap-1"><BookMarked className="h-3 w-3" />Sidor</span>
                  <span className="text-muted-foreground">{(stats?.sidorStats as any)?.total?.learned || 0}/{(stats?.sidorStats as any)?.total?.total || 0}</span>
                </div>
                <Progress value={((stats?.sidorStats as any)?.total?.total || 0) > 0 ? (((stats?.sidorStats as any)?.total?.learned || 0) / ((stats?.sidorStats as any)?.total?.total || 1)) * 100 : 0} className="h-1.5 bg-purple-500/10" indicatorClassName="bg-purple-500" />

                {expandedList === "sidor" && (
                  <div className="grid grid-cols-3 gap-1 mt-2 p-2 bg-purple-500/5 rounded-lg text-[10px] animate-in fade-in slide-in-from-top-1">
                    {SIDOR_LEVELS.map(l => (
                      <div key={l.label} className="flex flex-col">
                        <span className="font-bold opacity-70">{l.label}</span>
                        <span className="text-muted-foreground">{(stats?.sidorStats as any)[l.label]?.learned || 0}/{(stats?.sidorStats as any)[l.label]?.total || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
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

          {/* B1 Goal Card (Enhanced) */}
          {b1Goal && (
            <div className={`rounded-2xl border p-4 shadow-sm relative overflow-hidden ${b1Goal.isOnTrack ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide opacity-80">B1 Target</h3>
                  <p className="text-xl font-bold">{b1Goal.progressPercent.toFixed(1)}% <span className="text-[10px] font-normal opacity-70">Complete</span></p>
                </div>
                {b1Goal.isOnTrack ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Days Left:</span>
                  <span className="font-bold text-foreground">{b1Goal.daysUntilDeadline}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1"><BookOpen className="h-3 w-3" /> Words Left:</span>
                  <span className="font-bold text-red-500">{b1Goal.remainingB1Words}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Target Pace:</span>
                  <span className="font-bold text-foreground">{b1Goal.requiredWordsPerDay} <span className="text-[9px] font-normal opacity-70">w/day</span></span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Current Pace:</span>
                  <span className="font-bold text-primary">{b1Goal.currentPace} <span className="text-[9px] font-normal opacity-70">w/day</span></span>
                </div>
              </div>
              <div className="absolute top-0 right-0 p-2 opacity-5">
                <Target className="h-16 w-16" />
              </div>
            </div>
          )}

          {/* Total Progress & Study Later Mini-Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 flex flex-col justify-center items-center text-center shadow-sm">
              <span className="text-sm font-medium text-foreground">{progressPercent.toFixed(1)}%</span>
              <span className="text-[9px] text-muted-foreground opacity-80">({totalLearned} / {totalWords})</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Total Learned</span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 flex flex-col justify-center items-center text-center shadow-sm">
              <span className="text-sm font-medium text-amber-500">{stats?.reserveStats.total || 0}</span>
              <span className="text-[10px] text-muted-foreground">Study Later</span>
            </div>
          </div>
        </div>
      </div>

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

      {/* Today's Review Section (Moved to Bottom) */ }
  <div className="animate-fade-in mt-8" style={{ animationDelay: "450ms" }}>
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
  </div>
    </AppLayout >
  );
}
