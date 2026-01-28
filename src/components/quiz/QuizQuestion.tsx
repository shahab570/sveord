
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuizQuestion as IQuizQuestion } from '@/utils/quizUtils';
import { CheckCircle2, XCircle, BookOpen } from 'lucide-react';

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
    return (
        <Card className="w-full max-w-2xl mx-auto shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="text-center pb-2 space-y-4">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider block">
                    {question.type === 'synonym' ? 'Find the Synonym' : 'Find the Antonym'}
                </span>

                <div>
                    <CardTitle className="text-4xl font-bold text-primary mb-2">
                        {question.targetWord}
                    </CardTitle>

                    {/* REVEAL: Show meaning after answer */}
                    {showFeedback && question.targetMeaning && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-500 bg-muted/50 p-3 rounded-lg mx-auto max-w-md mt-4">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                                <BookOpen className="w-4 h-4" />
                                <span className="text-xs uppercase font-bold tracking-wide">Definition</span>
                            </div>
                            <p className="text-lg italic text-foreground">{question.targetMeaning}</p>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="grid gap-4 pt-4">
                {question.options.map((optionObj, index) => {
                    const optionText = optionObj.word;
                    let variant: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link" = "outline";
                    let icon = null;

                    if (showFeedback) {
                        if (optionText === question.correctAnswer) {
                            variant = "default"; // Green-ish usually, or primary
                            icon = <CheckCircle2 className="w-5 h-5 ml-2 text-green-200" />;
                        } else if (optionText === selectedAnswer) {
                            variant = "destructive";
                            icon = <XCircle className="w-5 h-5 ml-2" />;
                        }
                    } else if (selectedAnswer === optionText) {
                        variant = "default";
                    }

                    const isGreen = showFeedback && optionText === question.correctAnswer;

                    return (
                        <div key={index} className="flex flex-col">
                            <Button
                                variant={variant}
                                className={cn(
                                    "h-auto py-4 text-lg justify-between px-6 transition-all min-h-[3.5rem]",
                                    isGreen && "bg-green-600 hover:bg-green-700 text-white border-green-600",
                                    !showFeedback && "hover:border-primary/50 hover:bg-accent/50"
                                )}
                                onClick={() => !showFeedback && onAnswer(optionText)}
                                disabled={showFeedback}
                            >
                                <div className="flex flex-col items-start gap-1 text-left">
                                    <span className="capitalize font-medium">{optionText}</span>
                                    {/* OPTION MEANING (If available and feedback shown) */}
                                    {showFeedback && optionObj.meaning && (
                                        <span className="text-xs font-normal opacity-90 italic">
                                            {optionObj.meaning}
                                        </span>
                                    )}
                                </div>
                                {icon}
                            </Button>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};
