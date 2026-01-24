import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Play, Pause, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PopulationStatus {
  completed: number;
  total: number;
  remaining: number;
}

export function PopulateMeaningsSection() {
  const [status, setStatus] = useState<PopulationStatus | null>(null);
  const [isPopulating, setIsPopulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastBatchInfo, setLastBatchInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pauseRef = useRef(false);

  // Fetch initial status
  useEffect(() => {
    fetchStatus();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("populate-meanings", {
        body: { action: "status" },
      });

      if (error) throw error;
      setStatus(data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch status:", err);
      setError(err.message || "Failed to fetch status");
    }
  };

  const runBatch = async (): Promise<boolean> => {
    if (pauseRef.current) return false;

    try {
      const { data, error } = await supabase.functions.invoke("populate-meanings", {
        body: { action: "populate", batchSize: 30 },
      });

      if (error) {
        if (error.message?.includes("429") || error.message?.includes("Rate limit")) {
          toast.error("Rate limit reached. Pausing for 30 seconds...");
          await new Promise((resolve) => setTimeout(resolve, 30000));
          return true; // Continue after waiting
        }
        if (error.message?.includes("402") || error.message?.includes("Payment")) {
          toast.error("Payment required. Please add credits to continue.");
          return false;
        }
        throw error;
      }

      if (data.processed === 0 && data.message?.includes("already populated")) {
        return false; // All done
      }

      setStatus(data.status);
      setLastBatchInfo(`Processed ${data.processed} words`);

      if (data.errors && data.errors.length > 0) {
        console.warn("Batch errors:", data.errors);
      }

      // Check if we're done
      if (data.status.remaining === 0) {
        return false;
      }

      return true; // Continue
    } catch (err: any) {
      console.error("Batch error:", err);
      setError(err.message || "Failed to process batch");
      return false;
    }
  };

  const startPopulation = async () => {
    setIsPopulating(true);
    setIsPaused(false);
    pauseRef.current = false;
    setError(null);
    toast.success("Starting meaning population...");

    const runNextBatch = async () => {
      if (pauseRef.current) {
        setIsPopulating(false);
        return;
      }

      const shouldContinue = await runBatch();

      if (shouldContinue && !pauseRef.current) {
        // Wait 2 seconds between batches to respect rate limits
        setTimeout(runNextBatch, 2000);
      } else if (!pauseRef.current) {
        setIsPopulating(false);
        if (status?.remaining === 0 || !shouldContinue) {
          toast.success("🎉 All words have been populated with meanings!");
        }
      }
    };

    runNextBatch();
  };

  const pausePopulation = () => {
    pauseRef.current = true;
    setIsPaused(true);
    setIsPopulating(false);
    toast.info("Population paused");
  };

  const resumePopulation = () => {
    setIsPaused(false);
    startPopulation();
  };

  const progressPercent = status
    ? status.total > 0
      ? Math.round((status.completed / status.total) * 100)
      : 0
    : 0;

  const isComplete = status && status.remaining === 0;

  return (
    <section className="word-card space-y-4 border-l-4 border-l-amber-500">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-semibold text-foreground">
          AI Word Meanings
        </h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Automatically populate Swedish word meanings, examples, synonyms, and antonyms using AI.
      </p>

      {/* Status display */}
      {status && (
        <div className="space-y-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
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
      {isComplete && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm text-success flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          All words have been populated with meanings!
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {!isPopulating && !isComplete && (
          <Button
            onClick={isPaused ? resumePopulation : startPopulation}
            className="gap-2 bg-amber-600 hover:bg-amber-700"
          >
            <Play className="h-4 w-4" />
            {isPaused ? "Resume" : "Start Population"}
          </Button>
        )}

        {isPopulating && (
          <Button
            onClick={pausePopulation}
            variant="outline"
            className="gap-2 border-amber-300 hover:bg-amber-50"
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        )}

        <Button
          onClick={fetchStatus}
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isPopulating}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Status
        </Button>
      </div>

      {/* Info note */}
      <p className="text-xs text-muted-foreground mt-2">
        ⚡ Processing ~30 words every 2 seconds. Estimated time: ~{Math.ceil((status?.remaining || 0) / 30 * 2 / 60)} minutes for remaining words.
      </p>
    </section>
  );
}
