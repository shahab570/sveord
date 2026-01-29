import React, { useState, useEffect } from 'react';
import { useWords, WordWithProgress } from '@/hooks/useWords';
import { generateQuiz, QuizQuestion as IQuizQuestion, QuestionType, markQuizPracticed } from '@/utils/quizUtils';
import { QuizQuestion } from './QuizQuestion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Trophy, ArrowRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WordCard } from "@/components/study/WordCard";
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/services/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface QuizSessionProps {
    type: QuestionType;
    onExit: () => void;
    quizId?: number | null; // Optional: load existing quiz
}

export const QuizSession: React.FC<QuizSessionProps> = ({ type, onExit, quizId: initialQuizId }) => {
    const { user } = useAuth();
    const words = useWords({ learnedOnly: true });
    const wordsLoading = words === undefined;

    const [activeQuizId, setActiveQuizId] = useState<number | null>(initialQuizId || null);
    const [questions, setQuestions] = useState<IQuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Modal State
    const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null);
    // Find selected word from ALL words (since quiz might involve words not in the current learned list filter if revisiting old quizzes)
    const allWords = useLiveQuery(() => db.words.toArray());
    const selectedWord = allWords?.find(w => w.swedish_word === selectedWordKey) as WordWithProgress | undefined;

    useEffect(() => {
        const loadQuiz = async () => {
            if (activeQuizId) {
                const savedQuiz = await db.quizzes.get(activeQuizId);
                if (savedQuiz) {
                    setQuestions(savedQuiz.questions);
                    return;
                }
            }

            if (words && words.length > 0 && questions.length === 0 && !isGenerating) {
                setIsGenerating(true);
                try {
                    const newQuizId = await generateQuiz(words, type, 10);
                    if (!newQuizId) {
                        setGenerationError("Not enough usable words found that haven't hit the review limit. Try learning more words!");
                    } else {
                        const savedQuiz = await db.quizzes.get(newQuizId);
                        if (savedQuiz) {
                            setQuestions(savedQuiz.questions);
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

    const handleAnswer = (answer: string) => {
        setSelectedAnswer(answer);
        setShowFeedback(true);

        if (answer === questions[currentIndex].correctAnswer) {
            setScore(s => s + 1);
        }
    };

    const handleNext = async () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(c => c + 1);
            setSelectedAnswer(null);
            setShowFeedback(false);
        } else {
            setIsFinished(true);
            if (activeQuizId) {
                await markQuizPracticed(activeQuizId);
            }
        }
    };

    const handleRestart = async () => {
        setQuestions([]);
        setCurrentIndex(0);
        setScore(0);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsFinished(false);
        setActiveQuizId(null); // Force generate new one
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

    const currentQuestion = questions[currentIndex];
    const progress = ((currentIndex + (showFeedback ? 1 : 0)) / questions.length) * 100;

    return (
        <div className="max-w-3xl mx-auto space-y-6 py-8 relative">
            {/* Exit button top right */}
            <div className="absolute top-0 right-0">
                <Button variant="ghost" size="sm" onClick={onExit} className="gap-1 text-muted-foreground">
                    <X className="w-4 h-4" /> Exit
                </Button>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>Score: {score}</span>
            </div>

            <Progress value={progress} className="h-2 transition-all duration-500" />

            <QuizQuestion
                question={currentQuestion}
                onAnswer={handleAnswer}
                onWordClick={handleWordClick}
                selectedAnswer={selectedAnswer}
                showFeedback={showFeedback}
            />

            <div className="flex justify-center min-h-[3rem]">
                {showFeedback && (
                    <Button
                        size="lg"
                        onClick={handleNext}
                        className="animate-in fade-in slide-in-from-bottom-2 gap-2 text-lg shadow-lg"
                    >
                        {currentIndex < questions.length - 1 ? (
                            <>Next Question <ArrowRight className="w-5 h-5" /></>
                        ) : (
                            <>Finish Quiz <Trophy className="w-5 h-5" /></>
                        )}
                    </Button>
                )}
            </div>

            {/* Word Detail Modal */}
            <Dialog open={!!selectedWordKey} onOpenChange={(open) => !open && setSelectedWordKey(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogTitle className="sr-only">Word Details</DialogTitle>
                    {selectedWord ? (
                        <WordCard
                            word={selectedWord}
                            onPrevious={() => { }}
                            onNext={() => { }}
                            hasPrevious={false}
                            hasNext={false}
                            currentIndex={0}
                            totalCount={1}
                            learnedCount={0}
                            isRandomMode={false}
                            onToggleRandom={() => { }}
                            showRandomButton={false}
                        />
                    ) : (
                        <div className="p-4 text-center text-muted-foreground">
                            Word details not found.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
