import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Play, Pause, RefreshCw, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useApiKeys } from '@/hooks/useApiKeys';
import { generateWordMeaning } from '@/services/geminiApi';
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
  const [overwrite, setOverwrite] = useState(false);
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

      // Count words with meanings
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

  const handleRefresh = async () => {
    await fetchStatus();
    toast.success('Status updated');
  };

  const runBatch = async (batchSize: number = 50): Promise<boolean> => {
    if (!hasApiKey || !apiKeys.geminiApiKey) {
      setError('No API key configured');
      return false;
    }

    if (pauseRef.current) {
      return false;
    }

    try {
      // Fetch words
      let query = supabase
        .from('words')
        .select('id, swedish_word');

      // If not overwriting, only fetch words without meanings
      if (!overwrite) {
        query = query.is('word_data', null);
      }

      const { data: words, error: fetchError } = await query
        .order('id', { ascending: true })
        .limit(batchSize);

      if (fetchError) throw fetchError;

      if (!words || words.length === 0) {
        return false; // No more words to process
      }

      // Process each word one by one for "Live" updates
      for (let i = 0; i < words.length; i++) {
        if (pauseRef.current) return false;

        const word = words[i];
        setLastBatchInfo(`Generating meaning for "${word.swedish_word}" (${i + 1}/${words.length})...`);

        const result = await generateWordMeaning(word.swedish_word, apiKeys.geminiApiKey);

        if ('meanings' in result) {
          // Update database for THIS word immediately
          const { error: updateError } = await supabase
            .from('words')
            .update({
              word_data: {
                word_type: result.partOfSpeech || '',
                gender: result.gender || '',
                meanings: result.meanings || [],
                examples: result.examples || [],
                synonyms: result.synonyms || [],
                antonyms: result.antonyms || [],
                populated_at: new Date().toISOString(),
              },
            })
            .eq('id', word.id);

          if (updateError) throw updateError;
        }

        // Update the main progress counter in the UI after each word (only if not in overwrite mode)
        if (!overwrite) {
          setStatus(prev => prev ? {
            ...prev,
            completed: prev.completed + 1,
            remaining: prev.remaining - 1
          } : null);
        }
      }

      setLastBatchInfo(`Processed batch of ${words.length} words`);
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

      const shouldContinue = await runBatch(50);

      if (shouldContinue && !pauseRef.current) {
        // Wait 100ms between batches (paid tier)
        setTimeout(runNextBatch, 100);
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
      <div className="flex flex-wrap gap-2 items-center">
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
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isPopulating}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Status
        </Button>

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
