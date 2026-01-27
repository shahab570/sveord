import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WordCard } from "@/components/study/WordCard";
import { useWords, useLevelStats, FREQUENCY_LEVELS } from "@/hooks/useWords";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hash, BookOpen } from "lucide-react";

export default function FrequencyList() {
  const [selectedLevel, setSelectedLevel] = useState<string>("A1");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRandomMode, setIsRandomMode] = useState(false);

  const currentFrequencyRange = FREQUENCY_LEVELS.find(
    (r) => r.value === selectedLevel
  )?.range;

  const words = useWords({
    frequencyRange: currentFrequencyRange,
  });
  const isLoading = words === undefined;

  const levelStats = useLevelStats("frequency");

  const sortedWords = useMemo(() => {
    if (!words) return [];
    return [...words].sort(
      (a, b) => (a.frequency_rank || 0) - (b.frequency_rank || 0)
    );
  }, [words]);

  // Filter out learned words - they should not be shown
  const unlearnedWords = useMemo(() => {
    return sortedWords.filter((w) => !w.progress?.is_learned);
  }, [sortedWords]);

  // Use levelStats for accurate counts (not limited by Supabase's 1000-row default)
  const totalInLevel = levelStats?.[selectedLevel]?.total || 0;
  const learnedCount = levelStats?.[selectedLevel]?.learned || 0;

  // Always show only unlearned words (random mode cycles within them)
  const displayWords = unlearnedWords;

  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedLevel, isRandomMode]);

  const handleNext = () => {
    if (!displayWords) return;
    if (isRandomMode && unlearnedWords.length > 1) {
      const randomIndex = Math.floor(Math.random() * unlearnedWords.length);
      setCurrentIndex(randomIndex);
    } else if (currentIndex < displayWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentWord = displayWords?.[currentIndex];
  const currentLevelInfo = FREQUENCY_LEVELS.find((l) => l.value === selectedLevel);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Hash className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Frequency List
              </h1>
              <p className="text-sm text-muted-foreground">
                {currentLevelInfo?.description || "Learn the most common words first"}
              </p>
            </div>
          </div>

          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_LEVELS.map((level) => {
                const stats = levelStats?.[level.label];
                return (
                  <SelectItem key={level.value} value={level.value}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Level {level.label}</span>
                      {stats && (
                        <span className="text-xs text-muted-foreground">
                          ({stats.learned}/{stats.total})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Word Card */}
        {isLoading ? (
          <div className="word-card animate-pulse">
            <div className="h-64 flex items-center justify-center">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
        ) : currentWord ? (
          <WordCard
            key={currentWord.id}
            word={currentWord}
            onPrevious={handlePrevious}
            onNext={handleNext}
            hasPrevious={currentIndex > 0}
            hasNext={currentIndex < (displayWords?.length || 0) - 1}
            currentIndex={currentIndex}
            totalCount={totalInLevel}
            learnedCount={learnedCount}
            isRandomMode={isRandomMode}
            onToggleRandom={() => setIsRandomMode(!isRandomMode)}
            listType="frequency"
          />
        ) : (
          <div className="word-card text-center py-12">
            <div className="p-4 bg-success/10 rounded-2xl w-fit mx-auto mb-4">
              <Hash className="h-12 w-12 text-success" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">
              {sortedWords.length === 0
                ? "No words at this level"
                : "All words learned!"}
            </h3>
            <p className="text-muted-foreground mt-2">
              {sortedWords.length === 0
                ? "Import words from Settings to get started"
                : "Great job! Try another level or review learned words."}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
