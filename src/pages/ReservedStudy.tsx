import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWords } from "@/hooks/useWords";
import { useUserProgress } from "@/hooks/useWords";
import { WordCard } from "@/components/study/WordCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function ReservedStudy() {
  const reservedWords = useWords({ listType: "reserve" });
  const { upsertProgress } = useUserProgress();

  // Handle undefined data from useLiveQuery
  const reservedWordsList = reservedWords || [];
  const isLoading = !reservedWords;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredReservedWords = reservedWordsList.filter(word =>
    word.swedish_word.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    setCurrentIndex(0);
  }, [searchTerm]);

  const currentWord = filteredReservedWords[currentIndex];
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < filteredReservedWords.length - 1;

  const goToPrevious = () => {
    if (hasPrevious) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleMarkAsLearned = async (wordId: number, swedishWord: string) => {
    try {
      await upsertProgress.mutateAsync({
        word_id: wordId,
        swedish_word: swedishWord,
        is_learned: true,
        is_reserve: false,
      });

      toast.success("Word marked as learned and removed from reserved list!");

      // If this was the last word, go to previous
      if (currentIndex >= filteredReservedWords.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
    } catch (error) {
      console.error("Error marking word as learned:", error);
      toast.error("Failed to mark word as learned");
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!reservedWordsList.length) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4">
          <div className="text-center py-16">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Queue is Empty</h2>
            <p className="text-muted-foreground">
              You don't have any words in your Study Later Queue. Add words from the dictionary to see them here.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Progress indicator and navigation */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Word {currentIndex + 1} of {filteredReservedWords.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={!hasPrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={!hasNext}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: filteredReservedWords.length ? `${((currentIndex + 1) / filteredReservedWords.length) * 100}%` : "0%" }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search queue..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchTerm("")}
            disabled={!searchTerm}
          >
            Clear
          </Button>
        </div>

        {/* Current word card */}
        {currentWord && (
          <WordCard
            word={currentWord}
            onPrevious={goToPrevious}
            onNext={goToNext}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            currentIndex={currentIndex}
            totalCount={filteredReservedWords.length}
          />
        )}
      </div>
    </AppLayout>
  );
}
