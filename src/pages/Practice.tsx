import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Flashcard } from "@/components/practice/Flashcard";
import { useWords, useUserProgress, WordWithProgress } from "@/hooks/useWords";
import { db } from "@/services/db";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, CheckCircle, Flame, BrainCircuit, Repeat2, Sparkles, History, GraduationCap, Clock, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuizSession } from "@/components/quiz/QuizSession";
import { generateQuiz, QuestionType, generateAIQuiz } from "@/utils/quizUtils";
import { useApiKeys } from "@/hooks/useApiKeys";
import { cn } from "@/lib/utils";

export default function Practice() {
    const [mode, setMode] = useState<'menu' | 'srs' | 'quiz'>('menu');
    const [quizType, setQuizType] = useState<QuestionType | null>(null);
    const [activeQuizId, setActiveQuizId] = useState<number | null>(null);
    const [generatingType, setGeneratingType] = useState<QuestionType | null>(null);

    // SRS State
    const [currentIndex, setCurrentIndex] = useState(0);
    const { upsertProgress } = useUserProgress();
    const words = useWords({ learnedOnly: true }); // Only fetch learned words for quiz generation
    const { apiKeys, loading: keysLoading } = useApiKeys();

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

    // Practiced quizzes for archive
    const practicedQuizzes = useLiveQuery(() =>
        db.quizzes.where('isPracticed').equals(1).reverse().sortBy('practicedAt')
    );

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

    const startQuiz = async (type: QuestionType) => {
        if (!words || words.length === 0) {
            alert("Learn some words first to start a quiz!");
            return;
        }

        setGeneratingType(type);
        try {
            const apiKey = apiKeys.geminiApiKey;

            let id: number | null = null;
            if (apiKey) {
                // All quizzes are now batched via Gemini for maximum quality and minimal API usage
                id = await generateAIQuiz(words, type, apiKey);
            } else {
                // Fallback to algorithmic for synonym/antonym/meaning if no key
                if (type === 'context' || type === 'dialogue') {
                    if (keysLoading) {
                        alert("Still loading your API keys. Please wait a moment and try again.");
                    } else {
                        alert("A Gemini API Key is required for Context and Dialogue mastery modes. Please add one in Settings.");
                    }
                    setGeneratingType(null);
                    return;
                }
                id = await generateQuiz(words, type);
            }

            if (id) {
                setActiveQuizId(id);
                setQuizType(type);
                setMode('quiz');
            } else {
                alert("Could not generate quiz. You might have hit mastery limits for these words!");
            }
        } catch (error) {
            console.error("Failed to generate quiz:", error);
            alert("Error generating quiz. Please check your internet connection.");
        } finally {
            setGeneratingType(null);
        }
    };

    const playSavedQuiz = (id: number, type: string) => {
        setActiveQuizId(id);
        setQuizType(type as QuestionType);
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
                            <p className="text-muted-foreground">Master your vocabulary through strategic challenges</p>
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
                    <div className="space-y-12">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pt-8">
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

                            {/* 2. AI Context Quiz */}
                            <Card className="p-6 flex flex-col justify-between border-2 border-orange-500/20 bg-card/50 backdrop-blur shadow-lg hover:border-orange-500/40 transition-all">
                                <div className="space-y-4">
                                    <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-xl w-fit">
                                        <BrainCircuit className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground mb-2">Context Mastery</h2>
                                        <p className="text-muted-foreground text-sm">Fill-in-the-blanks using real-world context generated by AI.</p>
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    className="w-full mt-6 bg-orange-600 hover:bg-orange-700"
                                    onClick={() => startQuiz('context')}
                                    disabled={!!generatingType || (keysLoading && !apiKeys.geminiApiKey)}
                                >
                                    {generatingType === 'context' ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : 'Start Context Quiz'}
                                </Button>
                            </Card>

                            {/* 3. AI Dialogue Quiz */}
                            <Card className="p-6 flex flex-col justify-between border-2 border-indigo-500/20 bg-card/50 backdrop-blur shadow-lg hover:border-indigo-500/40 transition-all">
                                <div className="space-y-4">
                                    <div className="p-4 bg-indigo-100 dark:bg-indigo-900/20 rounded-xl w-fit">
                                        <GraduationCap className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground mb-2">Dialogue Master</h2>
                                        <p className="text-muted-foreground text-sm">Interactive conversation practice with multiple blanks.</p>
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700"
                                    onClick={() => startQuiz('dialogue')}
                                    disabled={!!generatingType || (keysLoading && !apiKeys.geminiApiKey)}
                                >
                                    {generatingType === 'dialogue' ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : 'Start Dialogue'}
                                </Button>
                            </Card>

                            {/* 4. Meaning Quiz */}
                            <Card className="p-6 flex flex-col justify-between border-2 border-emerald-500/20 bg-card/50 backdrop-blur shadow-lg hover:border-emerald-500/40 transition-all">
                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-100 dark:bg-emerald-900/20 rounded-xl w-fit">
                                        <BookOpen className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground mb-2">Word Meaning Mastery</h2>
                                        <p className="text-muted-foreground text-sm">Guess English meanings of Swedish words you've learned.</p>
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => startQuiz('meaning')}
                                    disabled={!!generatingType}
                                >
                                    {generatingType === 'meaning' ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : 'Start Mastery'}
                                </Button>
                            </Card>

                            {/* 5. Synonym Quiz */}
                            <Card className="p-6 flex flex-col justify-between border border-border hover:shadow-lg transition-all">
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-xl w-fit">
                                        <Repeat2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground mb-2">Synonyms</h2>
                                        <p className="text-muted-foreground text-sm">Find words with similar meanings (AI Powered).</p>
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="w-full mt-6 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:border-blue-800"
                                    onClick={() => startQuiz('synonym')}
                                    disabled={!!generatingType}
                                >
                                    {generatingType === 'synonym' ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : 'Start Challenge'}
                                </Button>
                            </Card>

                            {/* 6. Antonym Quiz */}
                            <Card className="p-6 flex flex-col justify-between border border-border hover:shadow-lg transition-all">
                                <div className="space-y-4">
                                    <div className="p-4 bg-purple-100 dark:bg-purple-900/20 rounded-xl w-fit">
                                        <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground mb-2">Antonyms</h2>
                                        <p className="text-muted-foreground text-sm">Find words with opposite meanings (AI Powered).</p>
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="w-full mt-6 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 dark:border-purple-800"
                                    onClick={() => startQuiz('antonym')}
                                    disabled={!!generatingType}
                                >
                                    {generatingType === 'antonym' ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : 'Start Challenge'}
                                </Button>
                            </Card>

                            {/* 7. Translation MCQ */}
                            <Card className="p-6 flex flex-col justify-between border-2 border-violet-500/20 bg-card/50 backdrop-blur shadow-lg hover:border-violet-500/40 transition-all">
                                <div className="space-y-4">
                                    <div className="p-4 bg-violet-100 dark:bg-violet-900/20 rounded-xl w-fit">
                                        <GraduationCap className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground mb-2">Swedish MCQ</h2>
                                        <p className="text-muted-foreground text-sm">Guess the Swedish word for an English meaning (MCQ).</p>
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    className="w-full mt-6 bg-violet-600 hover:bg-violet-700"
                                    onClick={() => startQuiz('translation')}
                                    disabled={!!generatingType}
                                >
                                    {generatingType === 'translation' ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : 'Start Production'}
                                </Button>
                            </Card>

                            {/* 8. Recall Practice */}
                            <Card className="p-6 flex flex-col justify-between border-2 border-pink-500/20 bg-card/50 backdrop-blur shadow-lg hover:border-pink-500/40 transition-all">
                                <div className="space-y-4">
                                    <div className="p-4 bg-pink-100 dark:bg-pink-900/20 rounded-xl w-fit">
                                        <BrainCircuit className="h-8 w-8 text-pink-600 dark:text-pink-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground mb-2">Recall Master</h2>
                                        <p className="text-muted-foreground text-sm">Active recall: See English, produce the Swedish word.</p>
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    className="w-full mt-6 bg-pink-600 hover:bg-pink-700"
                                    onClick={() => startQuiz('recall')}
                                    disabled={!!generatingType}
                                >
                                    {generatingType === 'recall' ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : 'Start Recall'}
                                </Button>
                            </Card>
                        </div>

                        {/* REVIEW ARCHIVE */}
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
                                <div className="flex items-center gap-3">
                                    <History className="h-6 w-6 text-muted-foreground" />
                                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Review Archive</h2>
                                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{practicedQuizzes?.length || 0} Saved</span>
                                </div>
                                {practicedQuizzes && practicedQuizzes.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={async () => {
                                            if (confirm("This will permanently delete ALL saved quizzes and reset your word mastery counts. Are you sure?")) {
                                                await db.clearAllQuizzes();
                                            }
                                        }}
                                    >
                                        Reset Quiz Progress
                                    </Button>
                                )}
                            </div>

                            {practicedQuizzes && practicedQuizzes.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {practicedQuizzes.slice(0, 10).map((q) => (
                                        <div
                                            key={q.id}
                                            className="group relative bg-card/40 border border-border hover:border-primary/30 rounded-2xl p-5 transition-all cursor-pointer flex items-center justify-between"
                                            onClick={() => playSavedQuiz(q.id!, q.type)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    q.type === 'meaning' ? "bg-emerald-100 text-emerald-600" :
                                                        q.type === 'synonym' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                                                )}>
                                                    {q.type === 'meaning' ? <BookOpen className="h-5 w-5" /> :
                                                        q.type === 'synonym' ? <Repeat2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-foreground capitalize">{q.type} Review</h3>
                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                                                        <Clock className="h-3 w-3" />
                                                        {q.practicedAt ? new Date(q.practicedAt).toLocaleDateString() : 'Unknown'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm("Delete this quiz permanently?")) {
                                                            db.quizzes.delete(q.id!);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Replay
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {practicedQuizzes.length > 10 && (
                                        <p className="text-center text-muted-foreground text-xs col-span-full pt-2">
                                            Showing last 10 practicing sessions
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl">
                                    <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-muted-foreground font-medium">No practiced quizzes yet.</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Complete your first quiz to save it here.</p>
                                </div>
                            )}
                        </div>
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
                        quizId={activeQuizId}
                        onExit={() => {
                            setMode('menu');
                            setActiveQuizId(null);
                        }}
                    />
                )}
            </div>
        </AppLayout >
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
