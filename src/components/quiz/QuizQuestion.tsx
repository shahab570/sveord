
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuizQuestion as IQuizQuestion } from '@/utils/quizUtils';
import { CheckCircle2, XCircle, BookOpen, Info } from 'lucide-react';

interface QuizQuestionProps {
    question: IQuizQuestion;
    onAnswer: (answer: string) => void;
    onWordClick: (word: string) => void;
    selectedAnswer: string | null;
    showFeedback: boolean;
}

export const QuizQuestion: React.FC<QuizQuestionProps> = ({
    question,
    onAnswer,
    onWordClick,
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
                    <div className="flex items-center justify-center gap-2">
                        <CardTitle className="text-4xl font-bold text-primary mb-2 cursor-pointer hover:underline decoration-primary/30 underline-offset-4 decoration-2"
                            onClick={() => onWordClick(question.targetWord)}>
                            {question.targetWord}
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary mb-2"
                            onClick={(e) => { e.stopPropagation(); onWordClick(question.targetWord); }}
                        >
                            <Info className="w-5 h-5" />
                        </Button>
                    </div>

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
                            <div className="relative group">
                                <Button
                                    variant={variant}
                                    className={cn(
                                        "w-full h-auto py-4 text-lg justify-between px-6 transition-all min-h-[3.5rem]",
                                        isGreen && "bg-green-600 hover:bg-green-700 text-white border-green-600",
                                        !showFeedback && "hover:border-primary/50 hover:bg-accent/50"
                                    )}
                                    // Only trigger answer if NOT showing feedback. 
                                    // If showing feedback, clicking button does nothing (except maybe highlight, but we want to allow clicking info)
                                    onClick={() => !showFeedback && onAnswer(optionText)}
                                >
                                    <div className="flex flex-col items-start gap-1 text-left w-full">
                                        <span className="capitalize font-medium">{optionText}</span>
                                        {/* OPTION MEANING (If available and feedback shown) */}
                                        {showFeedback && optionObj.meaning && (
                                            <span className="text-xs font-normal opacity-90 italic">
                                                {optionObj.meaning}
                                            </span>
                                        )}
                                    </div>
                                </Button>
                                {/* Floating Info Button inside the option - Stop Propagation to prevent answering when clicking info */}
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                                    {icon}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            "h-8 w-8 ml-2 hover:bg-background/20 rounded-full",
                                            isGreen ? "text-white hover:text-white" : "text-muted-foreground hover:text-primary"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onWordClick(optionText);
                                        }}
                                    >
                                        <Info className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};
