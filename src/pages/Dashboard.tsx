import { AppLayout } from "@/components/layout/AppLayout";
import { useStats, useDetailedStats, FREQUENCY_LEVELS, SIDOR_LEVELS, useTodaysLearnedWords, useLearningPrediction } from "@/hooks/useWords";
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

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: detailedStats, isLoading: detailedLoading } = useDetailedStats();
  const { data: todaysWords, isLoading: todaysLoading } = useTodaysLearnedWords();
  const { data: prediction, isLoading: predictionLoading } = useLearningPrediction();

  const totalLearned = stats?.learnedWords || 0;
  const totalWords = stats?.totalWords || 0;
  const progressPercent = totalWords > 0 ? (totalLearned / totalWords) * 100 : 0;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0ms" }}>
          <h1 className="text-3xl font-bold text-foreground">
            Välkommen tillbaka! 👋
          </h1>
          <p className="text-muted-foreground">
            Continue your Swedish vocabulary journey
          </p>
        </div>

        {/* Today's Progress Highlight */}
        <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
          {detailedLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : (
            <div className="word-card gold-highlight">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent/30 rounded-xl">
                    <Flame className="h-6 w-6 text-accent-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Today's Progress
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="h-4 w-4" />
                        Kelly: {detailedStats?.kellyToday || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash className="h-4 w-4" />
                        Frequency: {detailedStats?.frequencyToday || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <BookMarked className="h-4 w-4" />
                        Sidor: {detailedStats?.sidorToday || 0}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-4xl font-bold text-foreground">
                  {detailedStats?.learnedToday || 0}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Learning Prediction Card */}
        <div className="animate-fade-in" style={{ animationDelay: "75ms" }}>
          {predictionLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : prediction && prediction.avgWordsPerDay > 0 ? (
            <div className="word-card border-l-4 border-l-primary">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Learning Prediction
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      At {prediction.avgWordsPerDay} words/day, you'll finish all {prediction.remainingWords} remaining words
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-primary">
                    {prediction.estimatedCompletionDate ? new Date(prediction.estimatedCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "—"}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    ~{prediction.daysRemaining} days remaining
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Overall Progress Card */}
        <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          {statsLoading ? (
            <Skeleton className="h-28 w-full rounded-2xl" />
          ) : (
            <div className="word-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Overall Progress
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {totalLearned} of {totalWords} words learned
                    </p>
                  </div>
                </div>
                <span className="text-3xl font-bold text-primary">
                  {progressPercent.toFixed(1)}%
                </span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
          )}
        </div>

        {/* Kelly Level Progress */}
        <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
          {statsLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : stats && (
            <div className="word-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Kelly List Progress by CEFR Level
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => {
                  const levelStats = stats.kellyStats[level];
                  const percent = levelStats.total > 0 ? (levelStats.learned / levelStats.total) * 100 : 0;
                  return (
                    <div key={level} className="p-4 bg-secondary/50 rounded-xl border border-border">
                      <div className="text-center">
                        <span className={`level-badge-${level.toLowerCase()}`}>{level}</span>
                        <p className="text-2xl font-bold mt-3 text-foreground">{levelStats.learned}</p>
                        <p className="text-xs text-muted-foreground">of {levelStats.total} ({percent.toFixed(1)}%)</p>
                        <Progress value={percent} className="h-1.5 mt-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Frequency Level Progress */}
        <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
          {statsLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : stats && stats.frequencyStats && (
            <div className="word-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Hash className="h-5 w-5 text-primary" />
                Frequency List Progress
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {FREQUENCY_LEVELS.map((freqLevel) => {
                  const levelStats = stats.frequencyStats[freqLevel.label] || { total: 0, learned: 0 };
                  const percent = levelStats.total > 0 ? (levelStats.learned / levelStats.total) * 100 : 0;
                  return (
                    <div key={freqLevel.label} className="p-4 bg-secondary/50 rounded-xl border border-border">
                      <div className="text-center">
                        <span className={`level-badge-${freqLevel.label.toLowerCase()}`}>{freqLevel.label}</span>
                        <p className="text-2xl font-bold mt-3 text-foreground">{levelStats.learned}</p>
                        <p className="text-xs text-muted-foreground">of {levelStats.total} ({percent.toFixed(1)}%)</p>
                        <Progress value={percent} className="h-1.5 mt-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidor Level Progress */}
        <div className="animate-fade-in" style={{ animationDelay: "225ms" }}>
          {statsLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : stats && stats.sidorStats && (
            <div className="word-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <BookMarked className="h-5 w-5 text-primary" />
                Sidor List Progress
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {SIDOR_LEVELS.map((sidorLevel) => {
                  const levelStats = stats.sidorStats[sidorLevel.label] || { total: 0, learned: 0 };
                  const percent = levelStats.total > 0 ? (levelStats.learned / levelStats.total) * 100 : 0;
                  return (
                    <div key={sidorLevel.label} className="p-4 bg-secondary/50 rounded-xl border border-border">
                      <div className="text-center">
                        <span className={`level-badge-${sidorLevel.label.toLowerCase()}`}>{sidorLevel.label}</span>
                        <p className="text-2xl font-bold mt-3 text-foreground">{levelStats.learned}</p>
                        <p className="text-xs text-muted-foreground">of {levelStats.total} ({percent.toFixed(1)}%)</p>
                        <Progress value={percent} className="h-1.5 mt-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                  <div key={word.id} className="p-4 border border-border rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
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
