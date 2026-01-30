
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuizQuestion as IQuizQuestion } from '@/utils/quizUtils';
import { CheckCircle2, XCircle, BookOpen, Info, RefreshCw } from 'lucide-react';

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
                    {question.type === 'synonym' ? 'Find the Synonym' :
                        question.type === 'antonym' ? 'Find the Antonym' :
                            question.type === 'context' ? 'Context Mastery' :
                                question.type === 'translation' ? 'Translate to Swedish' :
                                    question.type === 'recall' ? 'Produce the Swedish Word' :
                                        'Select the Correct Meaning'}
                </span>

                <div>
                    {question.type === 'context' && question.sentence ? (
                        <div className="text-2xl md:text-3xl font-medium leading-relaxed mb-6 px-4">
                            {renderSentenceWithBlank(question.sentence, question.correctAnswer || "", selectedAnswer, showFeedback)}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="flex items-center justify-center gap-2">
                                <CardTitle className="text-4xl font-bold text-primary mb-2 cursor-pointer hover:underline decoration-primary/30 underline-offset-4 decoration-2"
                                    onClick={() => onWordClick(question.targetWord || "")}>
                                    {question.targetWord}
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary mb-2"
                                    onClick={(e) => { e.stopPropagation(); onWordClick(question.targetWord || ""); }}
                                >
                                    <Info className="w-5 h-5" />
                                </Button>
                            </div>
                            {question.type === 'recall' && (
                                <p className="text-muted-foreground text-sm font-medium uppercase tracking-tight -mt-1">
                                    English Prompt
                                </p>
                            )}
                        </div>
                    )}

                    {/* REVEAL: Show meaning after answer - Hide if it's the meaning quiz and identical to answer */}
                    {showFeedback && question.targetMeaning && question.type !== 'meaning' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-500 bg-muted/50 p-3 rounded-lg mx-auto max-w-md mt-4">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                                <BookOpen className="w-4 h-4" />
                                <span className="text-xs uppercase font-bold tracking-wide">
                                    {question.type === 'recall' || question.type === 'translation' ? 'Correct Swedish' : 'Definition'}
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{question.targetMeaning}</p>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="grid gap-4 pt-4">
                {question.type === 'recall' ? (
                    <div className="flex flex-col items-center py-6">
                        {!showFeedback ? (
                            <Button
                                size="lg"
                                variant="outline"
                                className="h-20 w-full max-w-sm text-xl font-bold border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all shadow-md gap-3"
                                onClick={() => onAnswer(question.correctAnswer || "")}
                            >
                                <RefreshCw className="w-6 h-6 animate-[spin_3s_linear_infinite]" />
                                Show Swedish Answer
                            </Button>
                        ) : (
                            <div className="text-center space-y-2 animate-in fade-in zoom-in-95 duration-500">
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl inline-block mb-4">
                                    <span className="text-4xl font-black text-green-600 dark:text-green-400 capitalize">
                                        {question.correctAnswer}
                                    </span>
                                </div>
                                <p className="text-muted-foreground font-medium">Did you recall it correctly?</p>
                            </div>
                        )}
                    </div>
                ) : (
                    question.options?.map((optionObj, index) => {
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
                                        onClick={() => !showFeedback && onAnswer(optionText)}
                                    >
                                        <div className="flex flex-col items-start gap-1 text-left w-full">
                                            <span className="capitalize font-medium">{optionText}</span>
                                            {showFeedback && optionObj.meaning && (
                                                <span className="text-xs font-normal opacity-90 italic">
                                                    {optionObj.meaning}
                                                </span>
                                            )}
                                        </div>
                                    </Button>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                                        {icon}
                                        {question.type !== 'meaning' && (
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
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
};

function renderSentenceWithBlank(sentence: string, correctAnswer: string, selectedAnswer: string | null, showFeedback: boolean) {
    const parts = sentence.split('[[blank]]');
    const isCorrect = selectedAnswer === correctAnswer;

    return (
        <span>
            {parts[0]}
            <span className={cn(
                "inline-block min-w-[120px] px-2 border-b-2 mx-1 text-center transition-all",
                !selectedAnswer && "border-primary/30 text-transparent",
                selectedAnswer && !showFeedback && "border-primary text-primary",
                showFeedback && isCorrect && "border-green-500 text-green-600 bg-green-50 rounded-t-md",
                showFeedback && !isCorrect && "border-destructive text-destructive bg-destructive/5 rounded-t-md"
            )}>
                {selectedAnswer || "__________"}
                {showFeedback && !isCorrect && (
                    <span className="block text-[10px] text-green-600 font-bold uppercase mt-1 leading-none">
                        Correct: {correctAnswer}
                    </span>
                )}
            </span>
            {parts[1]}
        </span>
    );
}
