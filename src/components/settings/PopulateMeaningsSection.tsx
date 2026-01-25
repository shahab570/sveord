import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Play, Pause, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { usePopulation } from '@/contexts/PopulationContext';

export function PopulateMeaningsSection() {
  const {
    status, isPopulating, isPaused, overwrite, setOverwrite,
    rangeStart, setRangeStart, rangeEnd, setRangeEnd,
    lastBatchInfo, error, startPopulation, pausePopulation,
    resumePopulation, fetchStatus
  } = usePopulation();

  const handleRefresh = async () => {
    await fetchStatus();
  };

  const progressPercent = status
    ? status.total > 0
      ? Math.round((status.completed / status.total) * 100)
      : 0
    : 0;

  const isComplete = status && status.remaining === 0;

  return (
    <section className="word-card space-y-4 border-l-4 border-l-purple-500">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-foreground">
          AI-Generated Word Meanings
        </h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Automatically generate detailed Swedish word meanings using Google Gemini AI.
        Get definitions, usage examples, synonyms, and antonyms for each word.
      </p>

      {/* Status display */}
      {status && (
        <div className="space-y-3 p-4 rounded-lg bg-purple-50 border border-purple-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-sm text-muted-foreground">
              {status.completed.toLocaleString()} / {status.total.toLocaleString()} words
            </span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progressPercent}% complete</span>
            <span>{status.remaining.toLocaleString()} remaining</span>
          </div>
        </div>
      )}

      {/* Last batch info */}
      {lastBatchInfo && isPopulating && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {lastBatchInfo}
        </p>
      )}

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Completion message */}
      {isComplete && !overwrite && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm text-success flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          All words have been populated with AI-generated meanings!
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 items-center">
        {!isPopulating && (
          <Button
            onClick={isPaused ? resumePopulation : startPopulation}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
            disabled={isComplete && !overwrite}
          >
            <Play className="h-4 w-4" />
            {isPaused ? 'Resume' : 'Start Generation'}
          </Button>
        )}

        {isPopulating && (
          <Button
            onClick={pausePopulation}
            variant="outline"
            className="gap-2 border-purple-300 hover:bg-purple-50"
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        )}

        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isPopulating}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Status
        </Button>


        <div className="flex items-center gap-2 ml-auto">
          <div className="flex flex-col">
            <label className="text-[10px] text-muted-foreground uppercase font-bold px-1">Start ID</label>
            <input
              type="number"
              value={rangeStart}
              onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
              disabled={isPopulating}
              className="w-20 rounded border-purple-300 text-sm p-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-muted-foreground uppercase font-bold px-1">End ID</label>
            <input
              type="number"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(parseInt(e.target.value) || 15000)}
              disabled={isPopulating}
              className="w-24 rounded border-purple-300 text-sm p-1"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <input
            type="checkbox"
            id="overwrite"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            disabled={isPopulating}
            className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
          />
          <label htmlFor="overwrite" className="text-xs font-medium text-foreground cursor-pointer">
            Overwrite existing (New format: Part of Speech, Gender, 3 Meanings, 2 Examples)
          </label>
        </div>
      </div>

      {/* Info note */}
      <p className="text-xs text-muted-foreground mt-2">
        ⚡ High-speed generation enabled (Paid Tier). Estimated time: ~{Math.ceil((status?.remaining || 0) / 20 / 60)} minutes for remaining words.
      </p>
      <p className="text-xs text-muted-foreground">
        💡 You can pause and resume anytime. Your progress is saved automatically.
      </p>
    </section>
  );
}
