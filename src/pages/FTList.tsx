import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WordCard } from "@/components/study/WordCard";
import { useWords, useLevelStats } from "@/hooks/useWords";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Loader2, BookOpen } from "lucide-react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { toast } from "sonner";
import { useCaptureWord } from "@/hooks/useCaptureWord";
import { db } from "@/services/db";
import { History, RotateCcw, Search } from "lucide-react";

export default function FTList() {
    const [newWord, setNewWord] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRandomMode, setIsRandomMode] = useState(false);
    const [showLearned, setShowLearned] = useState(false);
    const [showRecovery, setShowRecovery] = useState(false);
    const [discoveredWords, setDiscoveredWords] = useState<string[]>([]);
    const [isScanning, setIsScanning] = useState(false);

    const { apiKeys } = useApiKeys();
    const { captureWord, isCapturing } = useCaptureWord();
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

        const result = await captureWord(newWord);
        if (result) {
            toast.success(`Successfully added "${result.swedish_word}" to FT List!`);
            setNewWord("");
            // If it was in our discovered list, remove it
            setDiscoveredWords(prev => prev.filter(w => w !== result.swedish_word));
        }
    };

    const handleScanRecovery = async () => {
        setIsScanning(true);
        setShowRecovery(true);
        try {
            // 1. Get all words from audio_cache
            const allCached = await db.audio_cache.toArray();
            const words = allCached.map(c => c.word);

            // 2. Filter out words that already exist in the words table
            const existingWords = await db.words.where('swedish_word').anyOf(words).toArray();
            const existingSet = new Set(existingWords.map(w => w.swedish_word.toLowerCase()));

            const lostWords = words.filter(w => !existingSet.has(w.toLowerCase()));

            // 3. Unique and Sort
            const uniqueLost = Array.from(new Set(lostWords)).sort();
            setDiscoveredWords(uniqueLost);

            if (uniqueLost.length === 0) {
                toast.info("No lost words found in audio cache.");
            } else {
                toast.success(`Found ${uniqueLost.length} potential lost words!`);
            }
        } catch (error) {
            console.error("Recovery scan failed:", error);
            toast.error("Failed to scan for lost words");
        } finally {
            setIsScanning(false);
        }
    };

    const handleRecoverWord = async (word: string) => {
        const result = await captureWord(word);
        if (result) {
            toast.success(`Recovered "${word}"!`);
            setDiscoveredWords(prev => prev.filter(w => w !== word));
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
                                disabled={isCapturing}
                                className="pr-10 h-12 rounded-xl text-lg"
                            />
                            {isCapturing && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                        <Button
                            type="submit"
                            disabled={isCapturing || !newWord.trim()}
                            className="h-12 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md gap-2"
                        >
                            {isCapturing ? "Generating..." : (
                                <>
                                    <Plus className="h-5 w-5" />
                                    Add Word
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Recovery Mode Toggle */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleScanRecovery}
                            disabled={isScanning}
                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-2"
                        >
                            {isScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            Scan for lost words
                        </button>
                    </div>
                </div>

                {/* Recovery Section */}
                {showRecovery && discoveredWords.length > 0 && (
                    <div className="bg-purple-50/50 border border-purple-100 rounded-[1.5rem] p-6 space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <History className="h-4 w-4 text-purple-600" />
                                <h2 className="text-sm font-black text-purple-900 uppercase tracking-widest">Discovered Lost Words</h2>
                            </div>
                            <button onClick={() => setShowRecovery(false)} className="text-xs font-bold text-purple-400 hover:text-purple-600">Dismiss</button>
                        </div>
                        <p className="text-xs text-purple-700/70">
                            We found these words in your local audio cache. They were likely part of your list before.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {discoveredWords.map(word => (
                                <button
                                    key={word}
                                    onClick={() => handleRecoverWord(word)}
                                    disabled={isCapturing}
                                    className="px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-sm font-bold text-purple-900 hover:bg-purple-100 hover:border-purple-300 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                                >
                                    {word}
                                    <Plus className="h-3 w-3 text-purple-400" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
                        onDelete={() => {
                            if (currentIndex >= displayWords.length - 1 && currentIndex > 0) {
                                setCurrentIndex(currentIndex - 1);
                            }
                        }}
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
