
import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Flashcard } from "@/components/practice/Flashcard";
import { useWords, useUserProgress, WordWithProgress } from "@/hooks/useWords";
import { db } from "@/services/db";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, CheckCircle, Flame, BrainCircuit, Repeat2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuizSession } from "@/components/quiz/QuizSession";
import { QuestionType } from "@/utils/quizUtils";

export default function Practice() {
    const [mode, setMode] = useState<'menu' | 'srs' | 'quiz'>('menu');
    const [quizType, setQuizType] = useState<QuestionType | null>(null);

    // SRS State
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
            setMode('menu'); // Return to menu instead of just resetting sessionStarted
            setCurrentIndex(0);
        }
    };

    const startSRS = () => {
        setMode('srs');
        setCurrentIndex(0);
    };

    const startQuiz = (type: QuestionType) => {
        setQuizType(type);
        setMode('quiz');
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
                            <h1 className="text-3xl font-bold text-foreground tracking-tight">Practice Arena</h1>
                            <p className="text-muted-foreground">Master your vocabulary through different challenges</p>
                        </div>
                    </div>

                    {mode === 'srs' && sessionWords && (
                        <div className="flex items-center gap-4 bg-card border border-border px-6 py-2 rounded-2xl shadow-sm">
                            <span className="text-sm font-semibold text-primary">{currentIndex + 1} / {sessionWords.length}</span>
                            <Progress value={progressPercent} className="w-32 h-2" />
                        </div>
                    )}
                </div>

                {mode === 'menu' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
                        {/* 1. SRS Card */}
                        <Card className="p-6 flex flex-col justify-between border-2 border-primary/20 bg-card/50 backdrop-blur shadow-lg hover:border-primary/40 transition-all">
                            <div className="space-y-4">
                                <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-xl w-fit">
                                    <Flame className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground mb-2">Review Due</h2>
                                    <p className="text-muted-foreground text-sm">Spaced repetition reviews to keep words fresh.</p>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-primary">{dueWords?.length || 0}</span>
                                    <span className="text-sm text-muted-foreground">words pending</span>
                                </div>
                            </div>
                            <Button
                                size="lg"
                                className="w-full mt-6"
                                disabled={!dueWords || dueWords.length === 0}
                                onClick={startSRS}
                            >
                                Start Review
                            </Button>
                        </Card>

                        {/* 2. Synonym Quiz */}
                        <Card className="p-6 flex flex-col justify-between border border-border hover:shadow-lg transition-all">
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-xl w-fit">
                                    <Repeat2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground mb-2">Synonyms</h2>
                                    <p className="text-muted-foreground text-sm">Find words with similar meanings.</p>
                                </div>
                            </div>
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full mt-6 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:border-blue-800"
                                onClick={() => startQuiz('synonym')}
                            >
                                Start Challenge
                            </Button>
                        </Card>

                        {/* 3. Antonym Quiz */}
                        <Card className="p-6 flex flex-col justify-between border border-border hover:shadow-lg transition-all">
                            <div className="space-y-4">
                                <div className="p-4 bg-purple-100 dark:bg-purple-900/20 rounded-xl w-fit">
                                    <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground mb-2">Antonyms</h2>
                                    <p className="text-muted-foreground text-sm">Find words with opposite meanings.</p>
                                </div>
                            </div>
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full mt-6 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 dark:border-purple-800"
                                onClick={() => startQuiz('antonym')}
                            >
                                Start Challenge
                            </Button>
                        </Card>
                    </div>
                )}

                {/* SRS Mode */}
                {mode === 'srs' && (
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
                                <Button
                                    size="lg"
                                    onClick={() => setMode('menu')}
                                    className="rounded-2xl px-12"
                                >
                                    Back to Menu
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Quiz Mode */}
                {mode === 'quiz' && quizType && (
                    <QuizSession
                        type={quizType}
                        onExit={() => setMode('menu')}
                    />
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
