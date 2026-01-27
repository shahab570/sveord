import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Flashcard } from "@/components/practice/Flashcard";
import { useWords, useUserProgress, WordWithProgress } from "@/hooks/useWords";
import { db } from "@/services/db";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, CheckCircle, Flame, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function Practice() {
    const [sessionStarted, setSessionStarted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const { upsertProgress } = useUserProgress();

    const dueWords = useLiveQuery(async () => {
        const now = new Date().toISOString();
        // Get words that are learned and due for review
        const dueProgress = await db.progress
            .where("is_learned")
            .equals(1)
            .filter((p) => !p.srs_next_review || p.srs_next_review <= now)
            .toArray();

        const results: WordWithProgress[] = [];
        for (const p of dueProgress) {
            const w = await db.words.where("swedish_word").equals(p.word_swedish).first();
            if (w) {
                results.push({
                    ...w,
                    id: w.id || 0,
                    kelly_level: w.kelly_level || null,
                    kelly_source_id: w.kelly_source_id || null,
                    frequency_rank: w.frequency_rank || null,
                    sidor_source_id: null,
                    sidor_rank: w.sidor_rank || null,
                    created_at: "",
                    word_data: w.word_data || null,
                    progress: {
                        id: p.id || "",
                        user_id: "",
                        word_id: w.id || 0,
                        is_learned: p.is_learned,
                        learned_date: p.learned_date || null,
                        user_meaning: p.user_meaning || null,
                        custom_spelling: p.custom_spelling || null,
                        created_at: "",
                        updated_at: "",
                        srs_next_review: p.srs_next_review,
                    }
                });
            }
        }
        return results;
    });

    const allLearnedWords = useLiveQuery(async () => {
        const progress = await db.progress.where("is_learned").equals(1).toArray();
        const results: WordWithProgress[] = [];
        for (const p of progress) {
            const w = await db.words.where("swedish_word").equals(p.word_swedish).first();
            if (w) {
                results.push({
                    ...w,
                    id: w.id || 0,
                    kelly_level: w.kelly_level || null,
                    kelly_source_id: w.kelly_source_id || null,
                    frequency_rank: w.frequency_rank || null,
                    sidor_source_id: null,
                    sidor_rank: w.sidor_rank || null,
                    created_at: "",
                    word_data: w.word_data || null,
                    progress: {
                        id: p.id || "",
                        user_id: "",
                        word_id: w.id || 0,
                        is_learned: p.is_learned,
                        learned_date: p.learned_date || null,
                        user_meaning: p.user_meaning || null,
                        custom_spelling: p.custom_spelling || null,
                        created_at: "",
                        updated_at: "",
                        srs_next_review: p.srs_next_review,
                    }
                });
            }
        }
        return results;
    });

    const sessionWords = useMemo(() => {
        return (dueWords && dueWords.length > 0) ? dueWords : [];
    }, [dueWords]);

    const handleRate = async (difficulty: "easy" | "good" | "hard") => {
        if (!sessionWords) return;
        const currentWord = sessionWords[currentIndex];

        await upsertProgress.mutateAsync({
            word_id: currentWord.id,
            swedish_word: currentWord.swedish_word,
            srs_difficulty: difficulty
        });

        if (currentIndex < sessionWords.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setSessionStarted(false);
            setCurrentIndex(0);
        }
    };

    const progressPercent = sessionWords ? ((currentIndex / sessionWords.length) * 100) : 0;

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in px-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-primary/10 rounded-2xl">
                            <BrainCircuit className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground tracking-tight">SRS Mastery</h1>
                            <p className="text-muted-foreground">Master your learned vocabulary through spaced repetition</p>
                        </div>
                    </div>

                    {sessionStarted && sessionWords && (
                        <div className="flex items-center gap-4 bg-card border border-border px-6 py-2 rounded-2xl shadow-sm">
                            <span className="text-sm font-semibold text-primary">{currentIndex + 1} / {sessionWords.length}</span>
                            <Progress value={progressPercent} className="w-32 h-2" />
                        </div>
                    )}
                </div>

                {!sessionStarted ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                        {/* Due for Review Card */}
                        <Card className="p-8 flex flex-col items-center text-center space-y-6 border-2 border-primary/20 bg-card/50 backdrop-blur shadow-lg rounded-3xl group hover:border-primary/40 transition-all">
                            <div className="p-5 bg-primary/20 rounded-2xl group-hover:scale-110 transition-transform">
                                <Flame className="h-10 w-10 text-primary" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-foreground">Next Review</h2>
                                <p className="text-muted-foreground text-sm">Words scheduled for review based on your learning history.</p>
                            </div>
                            <div className="text-5xl font-black text-primary">
                                {dueWords?.length || 0}
                            </div>
                            <Button
                                size="lg"
                                className="w-full rounded-2xl h-14 text-lg font-bold shadow-md hover:shadow-primary/20"
                                disabled={!dueWords || dueWords.length === 0}
                                onClick={() => setSessionStarted(true)}
                            >
                                Start Review Session
                            </Button>
                        </Card>

                        {/* Total Learned Stats Card */}
                        <Card className="p-8 flex flex-col items-center text-center space-y-6 border border-border bg-secondary/20 rounded-3xl shadow-sm">
                            <div className="p-5 bg-success/20 rounded-2xl">
                                <CheckCircle className="h-10 w-10 text-success" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-foreground">Library Size</h2>
                                <p className="text-muted-foreground text-sm">Total words you have marked as 'Learned'.</p>
                            </div>
                            <div className="text-5xl font-black text-success">
                                {allLearnedWords?.length || 0}
                            </div>
                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full rounded-2xl h-14 text-lg font-bold border-2"
                                onClick={() => {
                                    // Option to practice all learned words could be added here
                                }}
                            >
                                Browse Library
                            </Button>
                        </Card>
                    </div>
                ) : (
                    <div className="py-8">
                        {sessionWords && sessionWords[currentIndex] ? (
                            <Flashcard
                                word={sessionWords[currentIndex]}
                                onRate={handleRate}
                            />
                        ) : (
                            <div className="text-center py-20 space-y-6">
                                <div className="p-6 bg-success/10 rounded-full w-fit mx-auto">
                                    <CheckCircle className="h-16 w-16 text-success" />
                                </div>
                                <h2 className="text-3xl font-bold text-foreground">Session Complete!</h2>
                                <p className="text-muted-foreground text-lg">You've cleared all pending reviews for now. Keep it up!</p>
                                <Button
                                    size="lg"
                                    onClick={() => setSessionStarted(false)}
                                    className="rounded-2xl px-12"
                                >
                                    Return to Dashboard
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

// Sub-component Card replacement to avoid massive imports if possible
function Card({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`bg-card rounded-xl border border-border shadow-sm ${className}`}>
            {children}
        </div>
    );
}
