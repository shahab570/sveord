
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuizQuestion as IQuizQuestion } from '@/utils/quizUtils';
import { CheckCircle2, XCircle } from 'lucide-react';

interface QuizQuestionProps {
    question: IQuizQuestion;
    onAnswer: (answer: string) => void;
    selectedAnswer: string | null;
    showFeedback: boolean;
}

export const QuizQuestion: React.FC<QuizQuestionProps> = ({
    question,
    onAnswer,
    selectedAnswer,
    showFeedback,
}) => {
    const isCorrect = selectedAnswer === question.correctAnswer;

    return (
        <Card className="w-full max-w-2xl mx-auto shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="text-center pb-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                    {question.type === 'synonym' ? 'Find the Synonym' : 'Find the Antonym'}
                </span>
                <CardTitle className="text-4xl font-bold text-primary mb-4">
                    {question.targetWord}
                </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
                {question.options.map((option, index) => {
                    let variant: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link" = "outline";
                    let icon = null;

                    if (showFeedback) {
                        if (option === question.correctAnswer) {
                            variant = "default"; // Green-ish usually, or primary
                            icon = <CheckCircle2 className="w-5 h-5 ml-2 text-green-200" />;
                        } else if (option === selectedAnswer) {
                            variant = "destructive";
                            icon = <XCircle className="w-5 h-5 ml-2" />;
                        }
                    } else if (selectedAnswer === option) {
                        variant = "default";
                    }

                    // Special styling for correct answer to make it green
                    const isGreen = showFeedback && option === question.correctAnswer;

                    return (
                        <Button
                            key={index}
                            variant={variant}
                            className={cn(
                                "h-14 text-lg justify-between px-6 transition-all",
                                isGreen && "bg-green-600 hover:bg-green-700 text-white border-green-600",
                                !showFeedback && "hover:border-primary/50 hover:bg-accent/50"
                            )}
                            onClick={() => !showFeedback && onAnswer(option)}
                            disabled={showFeedback}
                        >
                            <span className="capitalize">{option}</span>
                            {icon}
                        </Button>
                    );
                })}
            </CardContent>
        </Card>
    );
};
