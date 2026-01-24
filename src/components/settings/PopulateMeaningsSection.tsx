import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Play, Pause, RefreshCw, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useApiKeys } from '@/hooks/useApiKeys';
import { generateMeaningsBatch } from '@/services/geminiApi';
import { Link } from 'react-router-dom';

interface PopulationStatus {
  completed: number;
  total: number;
  remaining: number;
}

export function PopulateMeaningsSection() {
  const { apiKeys } = useApiKeys();
  const [status, setStatus] = useState<PopulationStatus | null>(null);
  const [isPopulating, setIsPopulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastBatchInfo, setLastBatchInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pauseRef = useRef(false);

  const hasApiKey = !!apiKeys.geminiApiKey;

  useEffect(() => {
    if (hasApiKey) {
      fetchStatus();
    }
  }, [hasApiKey]);

  const fetchStatus = async () => {
    try {
      // Count total words
      const { count: totalCount, error: totalError } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Count words with meanings (word_data is not null and has meanings array)
      const { count: completedCount, error: completedError } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true })
        .not('word_data', 'is', null);

      if (completedError) throw completedError;

      const total = totalCount || 0;
      const completed = completedCount || 0;

      setStatus({
        total,
        completed,
        remaining: total - completed,
      });
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch status:', err);
      setError(err.message || 'Failed to fetch status');
    }
  };

  const runBatch = async (batchSize: number = 10): Promise<boolean> => {
    if (!hasApiKey || !apiKeys.geminiApiKey) {
      setError('No API key configured');
      return false;
    }

    if (pauseRef.current) {
      return false;
    }

    try {
      // Fetch words without meanings
      const { data: words, error: fetchError } = await supabase
        .from('words')
        .select('id, swedish_word')
        .is('word_data', null)
        .limit(batchSize);

      if (fetchError) throw fetchError;

      if (!words || words.length === 0) {
        return false; // No more words to process
      }

      // Generate meanings for the batch
      const swedishWords = words.map(w => w.swedish_word);
      const meanings = await generateMeaningsBatch(
        swedishWords,
        apiKeys.geminiApiKey,
        (completed, total, currentWord) => {
          setLastBatchInfo(`Generating meaning for "${currentWord}" (${completed + 1}/${total})...`);
        }
      );

      // Update database with meanings
      const updates = words.map(word => {
        const meaning = meanings.get(word.swedish_word);
        if (!meaning) return null;

        return {
          id: word.id,
          swedish_word: word.swedish_word,
          word_data: {
            word_type: '',
            meanings: meaning.meanings || [],
            examples: meaning.examples || [],
            synonyms: meaning.synonyms || [],
            antonyms: meaning.antonyms || [],
            populated_at: new Date().toISOString(),
          },
        };
      }).filter(u => u !== null);

      // Batch update
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('words')
          .upsert(updates, { onConflict: 'id' });

        if (updateError) throw updateError;
      }

      setLastBatchInfo(`Processed ${updates.length} words`);

      // Update status
      await fetchStatus();

      return words.length === batchSize; // Continue if we got a full batch
    } catch (err: any) {
      console.error('Batch error:', err);
      setError(err.message || 'Failed to process batch');
      return false;
    }
  };

  const startPopulation = async () => {
    setIsPopulating(true);
    setIsPaused(false);
    pauseRef.current = false;
    setError(null);
    toast.success('Starting word meaning generation...');

    const runNextBatch = async () => {
      if (pauseRef.current) {
        setIsPopulating(false);
        return;
      }

      const shouldContinue = await runBatch(10);

      if (shouldContinue && !pauseRef.current) {
        // Wait 1 second between batches
        setTimeout(runNextBatch, 1000);
      } else if (!pauseRef.current) {
        setIsPopulating(false);
        if (status?.remaining === 0 || !shouldContinue) {
          toast.success('🎉 All words have been populated with meanings!');
          await fetchStatus();
        }
      }
    };

    runNextBatch();
  };

  const pausePopulation = () => {
    pauseRef.current = true;
    setIsPaused(true);
    setIsPopulating(false);
    toast.info('Meaning generation paused');
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

  if (!hasApiKey) {
    return (
      <section className="word-card space-y-4 border-l-4 border-l-amber-500">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-foreground">
            AI-Generated Word Meanings
          </h2>
        </div>

        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
          <p className="text-sm text-muted-foreground">
            To generate detailed word meanings, you need to configure your Gemini API key first.
          </p>
          <p className="text-xs text-muted-foreground">
            ⚡ Get detailed definitions, examples, synonyms, and antonyms - not just simple translations!
          </p>
        </div>
      </section>
    );
  }

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
      {isComplete && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm text-success flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          All words have been populated with AI-generated meanings!
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {!isPopulating && !isComplete && (
          <Button
            onClick={isPaused ? resumePopulation : startPopulation}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
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
        ⚡ Processing ~10 words per batch with 4 seconds between requests (Gemini rate limit).
        Estimated time: ~{Math.ceil((status?.remaining || 0) / 10 * 4 / 60)} minutes for remaining words.
      </p>
      <p className="text-xs text-muted-foreground">
        💡 You can pause and resume anytime. Your progress is saved automatically.
      </p>
    </section>
  );
}
