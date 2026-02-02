import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WordCard } from "@/components/study/WordCard";
import { useWords } from "@/hooks/useWords";
import { Sparkles, BookOpen, Bookmark } from "lucide-react";

export default function ReserveList() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRandomMode, setIsRandomMode] = useState(false);
    const [showLearned, setShowLearned] = useState(false);

    const words = useWords({ listType: "reserve" });

    const isLoading = words === undefined;

    const displayWords = useMemo(() => {
        if (!words) return [];
        if (showLearned) return words;
        return words.filter((w) => !w.progress?.is_learned);
    }, [words, showLearned]);

    const learnedCount = useMemo(() => {
        if (!words) return 0;
        return words.filter(w => w.progress?.is_learned).length;
    }, [words]);

    const handleNext = () => {
        if (isRandomMode && displayWords.length > 1) {
            const randomIndex = Math.floor(Math.random() * displayWords.length);
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

    // Auto-adjust index if it goes out of bounds when toggling
    useMemo(() => {
        if (currentIndex >= displayWords.length && displayWords.length > 0) {
            setCurrentIndex(displayWords.length - 1);
        }
    }, [displayWords.length]);

    const currentWord = displayWords[currentIndex];

    return (
        <AppLayout>
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-100 rounded-xl">
                            <Bookmark className="h-6 w-6 text-amber-600 fill-current" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Reserve List</h1>
                            <p className="text-sm text-muted-foreground">
                                Words you saved to study later
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-lg border border-border/50">
                            <input
                                type="checkbox"
                                id="showLearned"
                                checked={showLearned}
                                onChange={(e) => setShowLearned(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <label htmlFor="showLearned" className="text-sm font-medium text-muted-foreground cursor-pointer">
                                Show learned words
                            </label>
                        </div>

                        {displayWords.length > 0 && (
                            <div className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                                {currentIndex + 1} / {displayWords.length}
                            </div>
                        )}
                    </div>
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
                        key={currentWord.swedish_word}
                        word={currentWord}
                        onPrevious={handlePrevious}
                        onNext={handleNext}
                        hasPrevious={currentIndex > 0}
                        hasNext={currentIndex < displayWords.length - 1}
                        currentIndex={currentIndex}
                        totalCount={displayWords.length}
                        learnedCount={learnedCount}
                        isRandomMode={isRandomMode}
                        onToggleRandom={() => setIsRandomMode(!isRandomMode)}
                        listType="ft" // Reusing style
                        onDelete={() => {
                            if (currentIndex >= displayWords.length - 1 && currentIndex > 0) {
                                setCurrentIndex(currentIndex - 1);
                            }
                        }}
                    />
                ) : (
                    <div className="word-card text-center py-16 bg-card/30 border-dashed border-2">
                        <div className="p-4 bg-amber-100 rounded-2xl w-fit mx-auto mb-4">
                            <Bookmark className="h-12 w-12 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground">
                            Your Reserve List is empty
                        </h3>
                        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                            Add words you want to study later by clicking the "Study Later" button on any word card.
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
