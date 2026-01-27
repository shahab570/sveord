import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WordCard } from "@/components/study/WordCard";
import { useWords, useLevelStats } from "@/hooks/useWords";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GraduationCap, BookOpen } from "lucide-react";

const KELLY_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function KellyList() {
  const [selectedLevel, setSelectedLevel] = useState<string>("A1");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRandomMode, setIsRandomMode] = useState(false);

  const words = useWords({
    kellyLevel: selectedLevel,
    listType: "kelly",
  });
  const isLoading = words === undefined;

  const levelStats = useLevelStats("kelly");

  // Filter out learned words - they should not be shown
  const unlearnedWords = useMemo(() => {
    if (!words) return [];
    return words.filter((w) => !w.progress?.is_learned);
  }, [words]);

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

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <GraduationCap className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Kelly List</h1>
              <p className="text-sm text-muted-foreground">
                Study by CEFR proficiency level
              </p>
            </div>
          </div>

          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KELLY_LEVELS.map((level) => {
                const stats = levelStats?.[level];
                return (
                  <SelectItem key={level} value={level}>
                    <div className="flex items-center gap-2">
                      <span>Level {level}</span>
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
            listType="kelly"
          />
        ) : (
          <div className="word-card text-center py-12">
            <div className="p-4 bg-success/10 rounded-2xl w-fit mx-auto mb-4">
              <GraduationCap className="h-12 w-12 text-success" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">
              {words?.length === 0
                ? "No words at this level"
                : "All words learned!"}
            </h3>
            <p className="text-muted-foreground mt-2">
              {words?.length === 0
                ? "Import words from Settings to get started"
                : "Great job! Try another level or review learned words."}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
