import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WordCard } from "@/components/study/WordCard";
import { useWords, useLevelStats } from "@/hooks/useWords";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Loader2, BookOpen } from "lucide-react";
import { generateFTWordContent } from "@/services/geminiApi";
import { useApiKeys } from "@/hooks/useApiKeys";
import { db } from "@/services/db";
import { toast } from "sonner";

export default function FTList() {
    const [newWord, setNewWord] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRandomMode, setIsRandomMode] = useState(false);
    const [showLearned, setShowLearned] = useState(false);

    const { apiKeys } = useApiKeys();
    const words = useWords({ listType: "ft" });
    const levelStats = useLevelStats("ft");

    const isLoading = words === undefined;

    const displayWords = useMemo(() => {
        if (!words) return [];
        if (showLearned) return words;
        return words.filter((w) => !w.progress?.is_learned);
    }, [words, showLearned]);

    const totalCount = levelStats?.["Total"]?.total || 0;
    const learnedCount = levelStats?.["Total"]?.learned || 0;

    const handleAddWord = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newWord.trim()) return;
        if (!apiKeys.geminiApiKey) {
            toast.error("Please add a Gemini API Key in Settings to use the FT List.");
            return;
        }

        const wordToGenerate = newWord.trim().toLowerCase();

        // Check if word already exists
        const existing = await db.words.get(wordToGenerate);
        if (existing) {
            if (existing.is_ft) {
                toast.info(`"${wordToGenerate}" is already in your FT List.`);
                return;
            }
            // If it exists in another list, maybe we should still mark it as FT or just navigate?
            // For now, let's allow "promoting" it to FT list if it's not already there.
        }

        setIsGenerating(true);
        try {
            const result = await generateFTWordContent(wordToGenerate, apiKeys.geminiApiKey);

            if ('error' in result) {
                toast.error(`Generation failed: ${result.error}`);
                return;
            }

            await db.words.put({
                swedish_word: wordToGenerate,
                word_data: {
                    word_type: result.partOfSpeech || 'noun',
                    gender: result.gender,
                    meanings: result.meanings || [],
                    examples: result.examples || [],
                    synonyms: result.synonyms || [],
                    antonyms: result.antonyms || [],
                    inflectionExplanation: result.inflectionExplanation,
                    populated_at: new Date().toISOString()
                },
                is_ft: 1,
                last_synced_at: new Date().toISOString()
            });

            toast.success(`Successfully added "${wordToGenerate}" to FT List!`);
            setNewWord("");
            // Navigate to the newly added word (usually ends up at the end or reshuffled)
            // Since it's a live query, words will update automatically.
        } catch (error) {
            console.error(error);
            toast.error("An unexpected error occurred during generation.");
        } finally {
            setIsGenerating(false);
        }
    };

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
                {/* Header & Input */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 rounded-xl">
                            <Sparkles className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">FT List</h1>
                            <p className="text-sm text-muted-foreground">
                                Your personal collection of custom-learned words
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
                                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
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

                    <form onSubmit={handleAddWord} className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                placeholder="Enter a new Swedish word..."
                                value={newWord}
                                onChange={(e) => setNewWord(e.target.value)}
                                disabled={isGenerating}
                                className="pr-10 h-12 rounded-xl text-lg"
                            />
                            {isGenerating && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                        <Button
                            type="submit"
                            disabled={isGenerating || !newWord.trim()}
                            className="h-12 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md gap-2"
                        >
                            {isGenerating ? "Generating..." : (
                                <>
                                    <Plus className="h-5 w-5" />
                                    Add Word
                                </>
                            )}
                        </Button>
                    </form>
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
                        totalCount={totalCount}
                        learnedCount={learnedCount}
                        isRandomMode={isRandomMode}
                        onToggleRandom={() => setIsRandomMode(!isRandomMode)}
                        listType="ft"
                    />
                ) : (
                    <div className="word-card text-center py-16 bg-card/30 border-dashed border-2">
                        <div className="p-4 bg-purple-100 rounded-2xl w-fit mx-auto mb-4">
                            <Sparkles className="h-12 w-12 text-purple-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground">
                            Your FT List is empty
                        </h3>
                        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                            Add words you encounter in Swedish text that aren't in the standard lists.
                            We'll use AI to build a beautiful card for you.
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
