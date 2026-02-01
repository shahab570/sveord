import { useState } from "react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { generatePatternArticle, PatternArticleResult, generateMorePatternWords } from "@/services/geminiApi";
import { useWords, WordWithProgress } from "@/hooks/useWords";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, BookOpen, Puzzle, Lightbulb, Sparkles, BrainCircuit, ExternalLink, Plus } from "lucide-react";
import { db } from "@/services/db";
import { useCaptureWord } from "@/hooks/useCaptureWord";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { WordCard } from "../study/WordCard";

interface PatternSessionProps {
    onExit: () => void;
    initialData?: PatternArticleResult | null;
}

export function PatternSession({ onExit, initialData }: PatternSessionProps) {
    const { apiKeys, loading: keysLoading } = useApiKeys();
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [article, setArticle] = useState<PatternArticleResult | null>(initialData || null);
    const [error, setError] = useState<string | null>(null);
    const words = useWords({ learnedOnly: true });

    // Interactive Word Card State
    const { captureWord, isCapturing } = useCaptureWord();
    const [selectedWord, setSelectedWord] = useState<WordWithProgress | null>(null);
    const [isWordModalOpen, setIsWordModalOpen] = useState(false);

    // Helper to save/update the pattern session
    const savePatternSession = async (data: PatternArticleResult) => {
        try {
            // Check if exists by pattern name to update instead of duplicate (simplified logic)
            // In a real app we might want unique IDs, but pattern name is a decent unique key for this user context
            const existing = await db.patterns.where('pattern').equals(data.pattern).first();

            if (existing && existing.id) {
                await db.patterns.update(existing.id, {
                    content: data,
                    created_at: new Date().toISOString() // Bump timestamp on update
                });
            } else {
                await db.patterns.add({
                    title: data.title,
                    pattern: data.pattern,
                    content: data,
                    created_at: new Date().toISOString()
                });
            }
        } catch (e) {
            console.error("Failed to auto-save pattern session:", e);
        }
    };

    const handleGenerate = async () => {
        if (keysLoading) return;

        if (!apiKeys.geminiApiKey) {
            setError("Please add your Gemini API Key in Settings first.");
            return;
        }

        setLoading(true);
        setError(null);
        setArticle(null);

        try {
            const userWordList = words ? words.map(w => w.swedish_word) : [];
            const result = await generatePatternArticle("Auto", apiKeys.geminiApiKey, userWordList);

            if ('error' in result) {
                setError(result.details || result.error);
            } else {
                setArticle(result);
                // Auto-save the new session
                savePatternSession(result);
            }
        } catch (err: any) {
            setError(err.message || "Failed to generate article");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = async () => {
        if (!article || !apiKeys.geminiApiKey) return;

        setLoadingMore(true);
        try {
            const existingWords = article.words.map(w => w.word);
            const moreWords = await generateMorePatternWords(article.pattern, existingWords, apiKeys.geminiApiKey);

            if ('error' in moreWords) {
                toast.error("Could not find more words (or API error).");
            } else if (Array.isArray(moreWords) && moreWords.length > 0) {
                const updatedArticle = {
                    ...article,
                    words: [...article.words, ...moreWords]
                };
                setArticle(updatedArticle);
                // Save the updated list!
                savePatternSession(updatedArticle);

                setTimeout(() => {
                    const el = document.getElementById("word-grid-bottom");
                    el?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            } else {
                toast.info("No more common authentic words found for this pattern.");
            }
        } catch (error) {
            toast.error("Failed to load more words.");
        } finally {
            setLoadingMore(false);
        }
    };

    const handleWordClick = async (wordStr: string) => {
        const cleanWord = wordStr.toLowerCase().trim();
        let wordObj = await db.words.get(cleanWord);

        // If not found locally, capture it on the fly (adds to FT list)
        if (!wordObj) {
            toast.loading(`Defining "${cleanWord}"...`, { id: "capture-toast" });
            const captured = await captureWord(cleanWord);
            toast.dismiss("capture-toast");

            if (captured) {
                wordObj = captured;
                toast.success(`Added "${cleanWord}" to your Library.`);
            } else {
                toast.error(`Could not define "${cleanWord}".`);
                return;
            }
        }

        // Convert to WordWithProgress structure for WordCard
        // If captureWord returned result, it's already in correct shape. 
        // If from DB, we might need to cast or mock progress if missing.
        const fullWord: WordWithProgress = {
            ...wordObj,
            id: wordObj.id || 0,
            swedish_word: wordObj.swedish_word,
            created_at: "", // stub
            word_data: wordObj.word_data || null,
            // progress might be fetched by WordCard internal hooks, but we pass basic structure
            progress: undefined
        } as WordWithProgress;

        setSelectedWord(fullWord);
        setIsWordModalOpen(true);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header / Navigation */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onExit} className="hover:bg-muted/50 -ml-4">
                    ← Back to Menu
                </Button>
            </div>

            {/* Discovery / Landing Section */}
            {!article && (
                <div className="text-center space-y-8 py-10">
                    <div className="space-y-4">
                        <div className="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center text-amber-600 mb-6 shadow-sm border border-amber-200/50">
                            <BrainCircuit className="w-10 h-10" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Pattern Discovery</h1>
                        <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
                            Let our AI analyze your vocabulary and Swedish links to uncover hidden patterns.
                            <br />
                            <span className="text-primary font-medium">Learn 1 rule to unlock 100 words.</span>
                        </p>
                    </div>

                    <div className="max-w-md mx-auto py-8">
                        <Button
                            size="lg"
                            onClick={handleGenerate}
                            disabled={loading || keysLoading}
                            className="h-16 px-12 text-lg rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-xl shadow-orange-500/20 w-full transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
                        >
                            {loading || keysLoading ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin mr-3" />
                                    {keysLoading ? "Connecting..." : "Analyzing..."}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-6 h-6 mr-3" />
                                    Find a Pattern for Me
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-4 uppercase tracking-wider font-medium">
                            Based on SAOL & Your Progress
                        </p>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && !article && (
                <div className="text-center py-20 space-y-6 animate-pulse">
                    <div className="bg-muted/30 w-full h-64 rounded-xl"></div>
                    <p className="text-muted-foreground">Consulting the Swedish linguistic database...</p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-center">
                    <p className="font-semibold">Generation Error</p>
                    <p className="text-sm opacity-80">{error}</p>
                    <Button variant="link" onClick={() => setError(null)} className="mt-2 text-destructive">Try Again</Button>
                </div>
            )}

            {/* Article Content */}
            {article && (
                <div className="space-y-8 animate-in zoom-in-95 duration-500">
                    {/* Header */}
                    <div className="space-y-4 border-b border-border pb-8 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider text-[10px] mb-2">
                            <Puzzle className="w-3 h-3" />
                            <span>Pattern Decoded</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">{article.title}</h1>
                        <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">{article.intro}</p>
                    </div>

                    {/* The Pattern Card */}
                    <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20 p-8 rounded-3xl relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                            <Lightbulb className="w-64 h-64" />
                        </div>
                        <div className="relative z-10 text-center space-y-2">
                            <h2 className="text-sm font-bold text-primary uppercase tracking-widest">The Secret Pattern</h2>
                            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 py-4">
                                <span className="text-6xl md:text-7xl font-black text-foreground">{article.pattern}</span>
                                <span className="hidden md:block text-4xl text-muted-foreground/30">→</span>
                                <span className="text-2xl md:text-3xl text-muted-foreground font-light italic">"{article.patternMeaning}"</span>
                            </div>
                            <div className="max-w-xl mx-auto mt-6 p-4 bg-background/50 backdrop-blur rounded-xl border border-primary/10 text-foreground/80 text-sm md:text-base">
                                {article.construction}
                            </div>
                        </div>
                    </Card>

                    {/* Word List "Cards" */}
                    <div className="space-y-6">
                        <h3 className="text-2xl font-bold flex items-center gap-3 px-2">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <span>Examples in Action</span>
                        </h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            {article.words.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleWordClick(item.word)}
                                    className="text-left bg-card hover:bg-muted/50 border border-border hover:border-primary/30 shadow-sm hover:shadow-md transition-all p-6 rounded-2xl group flex flex-col justify-between h-full relative overflow-hidden"
                                >
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ExternalLink className="w-4 h-4 text-primary/50" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                                                {item.word}
                                            </h4>
                                            <span className="text-[10px] font-mono uppercase tracking-wider bg-muted text-muted-foreground px-2 py-1 rounded-md border border-border">
                                                {item.breakdown}
                                            </span>
                                        </div>
                                        <p className="text-muted-foreground font-medium mb-4">{item.meaning}</p>
                                    </div>
                                    {item.example && (
                                        <div className="text-sm bg-muted/40 p-4 rounded-xl italic text-foreground/80 border-l-4 border-primary/20 w-full">
                                            "{item.example}"
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div id="word-grid-bottom" />

                        {/* Load More Button */}
                        <div className="flex justify-center pt-4">
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="rounded-xl border-dashed border-2 hover:border-primary/50 gap-2"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Digging deeper...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Load More Examples
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Outro */}
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-3xl border border-amber-100 dark:border-amber-900/30 text-center max-w-2xl mx-auto">
                        <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-4" />
                        <p className="text-amber-900 dark:text-amber-100 text-lg font-medium italic">"{article.outro}"</p>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-center gap-4 pt-8 pb-12">
                        <Button variant="outline" size="lg" onClick={() => setArticle(null)} className="h-14 px-8 rounded-xl border-2">
                            Find Another Pattern
                        </Button>
                    </div>
                </div>
            )}

            {/* Word Card Modal */}
            <Dialog open={isWordModalOpen} onOpenChange={setIsWordModalOpen}>
                <DialogContent className="max-w-4xl w-[90vw] p-0 bg-transparent border-none shadow-none md:scale-95">
                    <DialogTitle className="sr-only">Word Card</DialogTitle>
                    {selectedWord && (
                        <WordCard
                            word={selectedWord}
                            onPrevious={() => { }} // No navigation in modal
                            onNext={() => { }}
                            hasPrevious={false}
                            hasNext={false}
                            currentIndex={0}
                            totalCount={1}
                            isRandomMode={false}
                            onToggleRandom={() => { }}
                            showRandomButton={false}
                            listType="ft"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
```
