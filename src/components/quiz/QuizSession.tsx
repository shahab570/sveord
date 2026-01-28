
import React, { useState, useEffect } from 'react';
import { useWords } from '@/hooks/useWords';
import { generateQuiz, QuizQuestion as IQuizQuestion, QuestionType } from '@/utils/quizUtils';
import { QuizQuestion } from './QuizQuestion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuizSessionProps {
    type: QuestionType;
    onExit: () => void;
}

export const QuizSession: React.FC<QuizSessionProps> = ({ type, onExit }) => {
    // useWords returns the array directly (from useLiveQuery), undefined while loading
    const words = useWords();
    const wordsLoading = words === undefined;
    const error = null; // Basic error handling separately if needed

    const [questions, setQuestions] = useState<IQuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);

    const navigate = useNavigate();

    useEffect(() => {
        if (words && words.length > 0) {
            // Re-map words to match the expected format for generateQuiz if necessary
            // The generateQuiz expects: { id: number; swedish_word: string; word_data: any }
            // words from useWords are probably matching the Supabase 'words' table row type.

            const quizQuestions = generateQuiz(words, type, 10);
            if (quizQuestions.length === 0) {
                setGenerationError("Not enough words with " + type + "s data found. Try adding more words or generating AI meanings.");
            } else {
                setQuestions(quizQuestions);
            }
        }
    }, [words, type]);

    const handleAnswer = (answer: string) => {
        setSelectedAnswer(answer);
        setShowFeedback(true);

        if (answer === questions[currentIndex].correctAnswer) {
            setScore(s => s + 1);
        }

        // Auto-advance after delay
        setTimeout(() => {
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(c => c + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            } else {
                setIsFinished(true);
            }
        }, 1500); // 1.5s delay to see feedback
    };

    const handleRestart = () => {
        // Regenerate quiz
        if (words) {
            const quizQuestions = generateQuiz(words, type, 10);
            setQuestions(quizQuestions);
            setCurrentIndex(0);
            setScore(0);
            setSelectedAnswer(null);
            setShowFeedback(false);
            setIsFinished(false);
        }
    };

    if (wordsLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || generationError) {
        return (
            <Card className="max-w-md mx-auto mt-8 text-center">
                <CardContent className="pt-6">
                    <p className="text-destructive mb-4">{error?.message || generationError}</p>
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
        return null; // Should be handled by generationError state/effect usually
    }

    const currentQuestion = questions[currentIndex];
    const progress = ((currentIndex) / questions.length) * 100;

    return (
        <div className="max-w-3xl mx-auto space-y-6 py-8">
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>Score: {score}</span>
            </div>

            <Progress value={progress} className="h-2" />

            <QuizQuestion
                question={currentQuestion}
                onAnswer={handleAnswer}
                selectedAnswer={selectedAnswer}
                showFeedback={showFeedback}
            />

            <div className="flex justify-center mt-8">
                <Button variant="ghost" onClick={onExit} className="text-muted-foreground">
                    Quit Quiz
                </Button>
            </div>
        </div>
    );
};
