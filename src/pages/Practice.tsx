import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Flashcard } from "@/components/practice/Flashcard";
import { useWords, useUserProgress, WordWithProgress } from "@/hooks/useWords";
import { db } from "@/services/db";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, CheckCircle, Flame, BrainCircuit, Repeat2, Sparkles, History, GraduationCap, Clock, Trash2, Loader2, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuizSession } from "@/components/quiz/QuizSession";
import { PatternSession } from "@/components/practice/PatternSession";
import { generateQuiz, QuestionType, generateAIQuiz, MAX_QUIZ_TARGET_LIMIT } from "@/utils/quizUtils";
import { useApiKeys } from "@/hooks/useApiKeys";
import { cn } from "@/lib/utils";

export default function Practice() {
    const [mode, setMode] = useState<'menu' | 'srs' | 'quiz' | 'pattern'>('menu');
    // Pattern & Quiz State
    const savedPatterns = useLiveQuery(() => db.patterns.orderBy('created_at').reverse().toArray());
    const [activePattern, setActivePattern] = useState<any | null>(null);
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
            .where('srs_next_review')
            .belowOrEqual(now)
            .and(p => p.is_learned === 1)
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

    const poolStats = useLiveQuery(async () => {
        if (!words) return null;
        const swedishWords = words.map(w => w.swedish_word);
        const usages = await db.wordUsage.where('wordSwedish').anyOf(swedishWords).toArray();
        const usageMap = new Map(usages.map(u => [u.wordSwedish, u]));

        const usable = words.filter(w => (usageMap.get(w.swedish_word)?.targetCount || 0) < MAX_QUIZ_TARGET_LIMIT).length;
        const mastered = words.length - usable;

        return { usable, mastered, total: words.length };
    }, [words]);

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
                setGeneratingType(null);
                alert("No more words available for this quiz type! All your learned words have reached the Mastery limit (10 practices). Learn more words to generate new quizzes.");
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

    const openSavedPattern = (pattern: any) => {
        setActivePattern(pattern.content);
        setMode('pattern');
    };

    const progressPercent = sessionWords ? ((currentIndex / sessionWords.length) * 100) : 0;

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in px-4">
                {/* Header */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Practice Arena</h1>
                            <p className="text-muted-foreground mt-1">Strengthen your memory through active recall</p>
                        </div>

                        {mode === 'srs' && sessionWords && (
                            <div className="flex items-center gap-4 bg-card border border-border px-6 py-2 rounded-2xl shadow-sm">
                                <span className="text-sm font-semibold text-primary">{currentIndex + 1} / {sessionWords.length}</span>
                                <Progress value={progressPercent} className="w-32 h-2" />
                            </div>
                        )}

                        {mode === 'menu' && poolStats && (
                            <div className="bg-card border border-border rounded-xl px-4 py-2 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-right-2">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none mb-1">Mastery Pool</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-bold text-primary">{poolStats.usable}</span>
                                            <span className="text-xs text-muted-foreground ml-1">Usable</span>
                                        </div>
                                        <div className="h-4 w-[1px] bg-border mx-1" />
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-bold text-green-600">{poolStats.mastered}</span>
                                            <span className="text-xs text-muted-foreground ml-1">Goal met</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
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

                            {/* 9. Similarity Quiz */}
                            <Card className="p-6 flex flex-col justify-between border-2 border-cyan-500/20 bg-card/50 backdrop-blur shadow-lg hover:border-cyan-500/40 transition-all">
                                <div className="space-y-4">
                                    <div className="p-4 bg-cyan-100 dark:bg-cyan-900/20 rounded-xl w-fit">
                                        <Sparkles className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground mb-2">Similarity Mastery</h2>
                                        <p className="text-muted-foreground text-sm">Master similar-looking Swedish words (e.g. en vs än) to avoid confusion.</p>
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    className="w-full mt-6 bg-cyan-600 hover:bg-cyan-700"
                                    onClick={() => startQuiz('similarity')}
                                    disabled={!!generatingType}
                                >
                                    {generatingType === 'similarity' ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : 'Start Challenge'}
                                </Button>
                            </Card>

                            {/* 10. Pattern Explorer (NEW) */}
                            <Card className="p-6 flex flex-col justify-between border-2 border-amber-500/20 bg-card/50 backdrop-blur shadow-lg hover:border-amber-500/40 transition-all col-span-full lg:col-span-2">
                                <div className="flex items-start gap-4">
                                    <div className="p-4 bg-amber-100 dark:bg-amber-900/20 rounded-xl w-fit shrink-0">
                                        <div className="h-8 w-8 text-amber-600 dark:text-amber-400">
                                            <Puzzle className="h-8 w-8" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-bold text-foreground">Pattern Explorer</h2>
                                        <p className="text-muted-foreground">Unlock thousands of words by learning their building blocks. Understand suffixes like <span className="font-mono text-primary font-bold">-het</span>, <span className="font-mono text-primary font-bold">-plats</span>, and <span className="font-mono text-primary font-bold">-fri</span> through AI-generated micro-lessons.</p>
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    className="w-full mt-6 bg-amber-600 hover:bg-amber-700"
                                    onClick={() => {
                                        setActivePattern(null); // Reset to new discovery
                                        setMode('pattern');
                                    }}
                                >
                                    Start Exploring
                                </Button>
                            </Card>
                        </div>

                        {/* REVIEW ARCHIVE */}
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
                                <div className="flex items-center gap-3">
                                    <History className="h-6 w-6 text-muted-foreground" />
                                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Review Archive</h2>
                                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                                        {(practicedQuizzes?.length || 0) + (savedPatterns?.length || 0)} Items
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={async () => {
                                        if (confirm("This will permanently delete ALL saved quizzes and patterns. Are you sure?")) {
                                            await db.clearAllQuizzes();
                                            // clearAllQuizzes in db.ts now clears patterns too if updated correctly,
                                            // otherwise we might need explicit pattern clear here if not unified.
                                            // Assuming db.ts update handled it.
                                        }
                                    }}
                                >
                                    Clear History
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Saved Patterns */}
                                {savedPatterns?.map((p) => (
                                    <div
                                        key={`pat-${p.id}`}
                                        className="group relative bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 hover:border-amber-500/30 rounded-2xl p-5 transition-all cursor-pointer flex items-center justify-between"
                                        onClick={() => openSavedPattern(p)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
                                                <Puzzle className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-foreground">{p.title}</h3>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                                                    <BrainCircuit className="h-3 w-3" />
                                                    Pattern: {p.pattern}
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
                                                    if (confirm("Delete this pattern?")) {
                                                        db.patterns.delete(p.id!);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Review
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                {/* Practiced Quizzes */}
                                {practicedQuizzes?.slice(0, 10).map((q) => (
                                    <div
                                        key={`quiz-${q.id}`}
                                        className="group relative bg-card/40 border border-border hover:border-primary/30 rounded-2xl p-5 transition-all cursor-pointer flex items-center justify-between"
                                        onClick={() => playSavedQuiz(q.id!, q.type)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                q.type === 'meaning' ? "bg-emerald-100 text-emerald-600" :
                                                    q.type === 'synonym' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                                            )}>
                                                {q.type === 'meaning' ? <BookOpen className="h-5 w-5" /> :
                                                    q.type === 'synonym' ? <Repeat2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-foreground capitalize">{q.type} Quiz</h3>
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
                            </div>

                            {(!practicedQuizzes?.length && !savedPatterns?.length) && (
                                <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl">
                                    <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-muted-foreground font-medium">No activity history yet.</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Complete quizzes or discover patterns to save them here.</p>
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

                {/* Pattern Explorer Mode */}
                {mode === 'pattern' && (
                    <PatternSession
                        onExit={() => setMode('menu')}
                        initialData={activePattern}
                    />
                )}

                {/* Quiz Mode */}
                {mode === 'quiz' && quizType && activeQuizId && (
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
