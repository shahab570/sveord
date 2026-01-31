import React, { useState, useEffect } from 'react';
import { useWords, WordWithProgress } from '@/hooks/useWords';
import { generateQuiz, QuizQuestion as IQuizQuestion, QuestionType, markQuizPracticed, sanitizeQuestions } from '@/utils/quizUtils';
import { QuizQuestion } from './QuizQuestion';
import { QuizDialogue } from './QuizDialogue';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Trophy, ArrowRight, X, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WordCard } from "@/components/study/WordCard";
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCaptureWord } from '@/hooks/useCaptureWord';
import { getQuizExplanation, getActiveConfig } from '@/services/geminiApi';
import { Sparkles } from 'lucide-react';
import { useApiKeys } from '@/hooks/useApiKeys';

interface QuizSessionProps {
    type: QuestionType;
    onExit: () => void;
    quizId?: number | null; // Optional: load existing quiz
}

export const QuizSession: React.FC<QuizSessionProps> = ({ type, onExit, quizId: initialQuizId }) => {
    const { user } = useAuth();
    const words = useWords({ learnedOnly: true });
    const { apiKeys, saveGeminiApiKey } = useApiKeys();
    const wordsLoading = words === undefined;

    const [activeQuizId, setActiveQuizId] = useState<number | null>(initialQuizId || null);
    const [questions, setQuestions] = useState<IQuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Persisted session answers and explanations
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [multiDialogueAnswers, setMultiDialogueAnswers] = useState<Record<number, Record<number, string>>>({});
    const [explanations, setExplanations] = useState<Record<number, string>>({});
    const [revealedDialogueIndex, setRevealedDialogueIndex] = useState<number | null>(null);
    const [isExplaining, setIsExplaining] = useState(false);

    // Modal State
    const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null);
    const [capturedWord, setCapturedWord] = useState<WordWithProgress | null>(null);
    const { captureWord, isCapturing: isCapturingWord } = useCaptureWord();

    // Find selected word from ALL words (since quiz might involve words not in the current learned list filter if revisiting old quizzes)
    const allWords = useLiveQuery(() => db.words.toArray());
    const matchedWord = allWords?.find(w => w.swedish_word === selectedWordKey?.toLowerCase()) as WordWithProgress | undefined;

    // Effect to handle capturing word if match is not found
    useEffect(() => {
        const handleCapture = async () => {
            if (selectedWordKey && !matchedWord && !isCapturingWord) {
                console.log(`Word "${selectedWordKey}" not found, attempts to capture...`);
                const result = await captureWord(selectedWordKey);
                if (result) {
                    setCapturedWord(result);
                }
            } else if (matchedWord) {
                setCapturedWord(matchedWord);
            }
        };
        handleCapture();
    }, [selectedWordKey, matchedWord, isCapturingWord, captureWord]);

    useEffect(() => {
        const loadQuiz = async () => {
            if (activeQuizId) {
                const savedQuiz = await db.quizzes.get(activeQuizId);
                if (savedQuiz) {
                    setQuestions(sanitizeQuestions(savedQuiz.questions));
                    if (savedQuiz.explanations) {
                        setExplanations(savedQuiz.explanations);
                    }
                    return;
                }
            }

            if (words && words.length > 0 && questions.length === 0 && !isGenerating) {
                setIsGenerating(true);
                try {
                    // Fallback to algorithmic generation if no questions pre-loaded
                    const newQuizId = await generateQuiz(words, type, 10);
                    if (!newQuizId) {
                        setGenerationError("Not enough usable words found that haven't hit the review limit. Try learning more words!");
                    } else {
                        const savedQuiz = await db.quizzes.get(newQuizId);
                        if (savedQuiz) {
                            setQuestions(sanitizeQuestions(savedQuiz.questions));
                            setActiveQuizId(newQuizId);
                        }
                    }
                } finally {
                    setIsGenerating(false);
                }
            }
        };

        loadQuiz();
    }, [words, type, activeQuizId]);

    const currentQuestion = questions[currentIndex] as IQuizQuestion | undefined;
    const selectedAnswer = userAnswers[currentIndex] || null;
    const isCurrentDialogueRevealed = revealedDialogueIndex === currentIndex;
    const showFeedback = currentQuestion?.type === 'dialogue'
        ? isCurrentDialogueRevealed
        : !!selectedAnswer;

    const allBlanksFilled = currentQuestion?.type === 'dialogue' &&
        !!(multiDialogueAnswers[currentIndex] && Object.keys(multiDialogueAnswers[currentIndex]).length === currentQuestion.blanks?.length);

    const compareAnswers = (a?: string | null, b?: string | null) => {
        if (!a || !b) return false;
        return a.trim().toLowerCase() === b.trim().toLowerCase();
    };

    const handleAnswer = (answer: string) => {
        if (userAnswers[currentIndex]) return; // Already answered

        setUserAnswers(prev => ({ ...prev, [currentIndex]: answer }));

        if (compareAnswers(answer, questions[currentIndex].correctAnswer)) {
            setScore(s => s + 1);
        }
    };

    const handleDialogueAnswer = (blankIndex: number, answer: string) => {
        if (showFeedback) return;

        setMultiDialogueAnswers(prev => {
            const currentAnswers = prev[currentIndex] || {};
            const newAnswers = { ...currentAnswers, [blankIndex]: answer };

            // Check if all blanks filled
            const currentQ = questions[currentIndex];
            if (currentQ.blanks?.every(b => !!newAnswers[b.index])) {
                // Calculate score contribution
                const correctCount = currentQ.blanks.filter(b => compareAnswers(newAnswers[b.index], b.answer)).length;
                if (correctCount === currentQ.blanks.length) {
                    setScore(s => s + 1);
                }
            }

            return { ...prev, [currentIndex]: newAnswers };
        });
    };

    const handleNext = async () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(c => c + 1);
            setRevealedDialogueIndex(null);
        } else {
            setIsFinished(true);
            if (activeQuizId) {
                await markQuizPracticed(activeQuizId);
            }
        }
    };

    const handlePrevious = () => {
        setCurrentIndex(c => Math.max(0, c - 1));
    };

    const handleRestart = async () => {
        setQuestions([]);
        setCurrentIndex(0);
        setScore(0);
        setUserAnswers({});
        setMultiDialogueAnswers({});
        setRevealedDialogueIndex(null);
        setIsFinished(false);
        setActiveQuizId(null); // Force generate new one
    };

    const handleGetExplanation = async () => {
        if (explanations[currentIndex] || isExplaining) return;

        setIsExplaining(true);
        try {
            console.log('Fetching AI explanation for:', questions[currentIndex].targetWord);
            const apiKey = apiKeys.geminiApiKey;
            if (!apiKey) {
                setExplanations(prev => ({ ...prev, [currentIndex]: "Please add a Gemini API key in Settings to use AI explanations." }));
                return;
            }
            const explanation = await getQuizExplanation(questions[currentIndex], userAnswers[currentIndex] || null, apiKey);
            const newExplanations = { ...explanations, [currentIndex]: explanation || "ERROR" };
            setExplanations(newExplanations);

            // Persist to indexedDB
            if (activeQuizId) {
                await db.quizzes.update(activeQuizId, { explanations: newExplanations });
            }

            // Persist discovered working model back to Supabase settings so it works "first shot" next time
            const workingConfig = getActiveConfig();
            if (workingConfig.model !== apiKeys.geminiModel || workingConfig.version !== apiKeys.geminiApiVersion) {
                console.log(`[QuizSession] Persistence: Auto-syncing working model ${workingConfig.model} to settings...`);
                try {
                    await saveGeminiApiKey(apiKey, workingConfig.model, workingConfig.version);
                } catch (saveErr) {
                    console.error('[QuizSession] Failed to auto-persist discovered model:', saveErr);
                }
            }
        } catch (e) {
            console.error('Explanation error:', e);
            setExplanations(prev => ({ ...prev, [currentIndex]: "ERROR" }));
        } finally {
            setIsExplaining(false);
        }
    };

    const handleWordClick = (word: string) => {
        setSelectedWordKey(word);
    };

    if (wordsLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (generationError) {
        return (
            <Card className="max-w-md mx-auto mt-8 text-center">
                <CardContent className="pt-6">
                    <p className="text-destructive mb-4">{generationError}</p>
                    <Button onClick={onExit}>Return to Practice</Button>
                </CardContent>
            </Card>
        );
    }

    if (isFinished) {
        const percentage = Math.round((score / questions.length) * 100);
        return (
            <Card className="max-w-md mx-auto mt-8 text-center animate-in zoom-in-95 duration-500">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <div className="p-4 rounded-full bg-yellow-100 text-yellow-600">
                            <Trophy className="w-12 h-12" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl">Quiz Complete!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <p className="text-muted-foreground">Your Score</p>
                        <p className="text-5xl font-bold text-primary">{score} / {questions.length}</p>
                        <p className="text-sm font-medium text-muted-foreground">{percentage}% Correct</p>
                    </div>

                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={onExit}>Back to Menu</Button>
                        <Button onClick={handleRestart} className="gap-2">
                            <RefreshCw className="w-4 h-4" /> Try Again
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (questions.length === 0) {
        return null;
    }

    const progress = ((currentIndex + (showFeedback ? 1 : 0)) / questions.length) * 100;

    return (
        <div className="max-w-3xl mx-auto space-y-6 py-8 relative">
            {/* Header controls: Delete and Exit */}
            <div className="absolute top-0 right-0 flex items-center gap-2">
                {activeQuizId && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                            if (confirm("Delete this quiz permanently from your library?")) {
                                await db.quizzes.delete(activeQuizId);
                                onExit();
                            }
                        }}
                        className="gap-1 text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onExit} className="gap-1 text-muted-foreground">
                    <X className="w-4 h-4" /> Exit
                </Button>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>Score: {score}</span>
            </div>

            <Progress value={progress} className="h-2 transition-all duration-500" />

            {currentQuestion.type === 'dialogue' ? (
                <QuizDialogue
                    question={currentQuestion}
                    onAnswer={handleDialogueAnswer}
                    userAnswers={multiDialogueAnswers[currentIndex] || {}}
                    showFeedback={showFeedback}
                />
            ) : (
                <QuizQuestion
                    question={currentQuestion}
                    onAnswer={handleAnswer}
                    onWordClick={handleWordClick}
                    selectedAnswer={selectedAnswer}
                    showFeedback={showFeedback}
                    explanation={explanations[currentIndex]}
                    isExplaining={isExplaining}
                    onGetExplanation={handleGetExplanation}
                />
            )}

            <div className="flex items-center justify-between w-full max-w-2xl mx-auto gap-4">
                <div className="flex-1">
                    {currentIndex > 0 && (
                        <Button
                            variant="ghost"
                            onClick={handlePrevious}
                            className="text-muted-foreground hover:text-primary gap-2"
                        >
                            <ArrowRight className="w-4 h-4 rotate-180" /> Previous
                        </Button>
                    )}
                </div>

                <div className="flex-[2] flex justify-center min-h-[3.5rem]">
                    {currentQuestion.type === 'dialogue' && !showFeedback && (
                        <Button
                            size="lg"
                            disabled={!allBlanksFilled}
                            onClick={() => setRevealedDialogueIndex(currentIndex)}
                            className={cn(
                                "animate-in fade-in slide-in-from-bottom-2 gap-2 text-lg shadow-lg w-full max-w-xs transition-all",
                                allBlanksFilled ? "bg-primary" : "bg-muted text-muted-foreground"
                            )}
                        >
                            {allBlanksFilled ? "Check Answers" : "Fill all blanks"}
                        </Button>
                    )}

                    {showFeedback && (
                        <Button
                            size="lg"
                            onClick={handleNext}
                            className="animate-in fade-in slide-in-from-bottom-2 gap-2 text-lg shadow-lg w-full max-w-xs"
                        >
                            {currentIndex < questions.length - 1 ? (
                                <>Next Question <ArrowRight className="w-5 h-5" /></>
                            ) : (
                                <>Finish Quiz <Trophy className="w-5 h-5" /></>
                            )}
                        </Button>
                    )}
                </div>

                <div className="flex-1" />
            </div>

            {/* Word Detail Modal */}
            <Dialog open={!!selectedWordKey} onOpenChange={(open) => {
                if (!open) {
                    setSelectedWordKey(null);
                    setCapturedWord(null);
                }
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogTitle className="sr-only">Word Details</DialogTitle>
                    {capturedWord ? (
                        <WordCard
                            word={capturedWord}
                            onPrevious={() => { }}
                            onNext={() => { }}
                            hasPrevious={false}
                            hasNext={false}
                            currentIndex={0}
                            totalCount={1}
                            learnedCount={capturedWord.progress?.is_learned ? 1 : 0}
                            isRandomMode={false}
                            onToggleRandom={() => { }}
                            showRandomButton={false}
                        />
                    ) : isCapturingWord ? (
                        <div className="p-12 flex flex-col items-center gap-4 text-center animate-pulse">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-muted-foreground font-medium">Finding base form and generating details...</p>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            Word details not found or failed to generate.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
