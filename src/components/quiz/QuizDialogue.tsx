import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuizQuestion, QuizBlank } from '@/utils/quizUtils';
import { CheckCircle2, XCircle, MessageSquare } from 'lucide-react';

interface QuizDialogueProps {
    question: QuizQuestion;
    onAnswer: (blankIndex: number, answer: string) => void;
    userAnswers: Record<number, string>;
    showFeedback: boolean;
}

export const QuizDialogue: React.FC<QuizDialogueProps> = ({
    question,
    onAnswer,
    userAnswers,
    showFeedback,
}) => {
    const [visibleTranslations, setVisibleTranslations] = useState<Record<number, boolean>>({});

    if (!question.dialogue || !question.blanks) return null;

    const toggleTranslation = (idx: number) => {
        setVisibleTranslations(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const shuffledBlanks = useMemo(() => {
        if (!question.blanks) return {};
        const map: Record<number, string[]> = {};
        question.blanks.forEach(blank => {
            map[blank.index] = shuffle([...blank.options, blank.answer]);
        });
        return map;
    }, [question.id]);

    return (
        <Card className="w-full max-w-2xl mx-auto shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="text-center pb-2">
                <div className="flex items-center justify-center gap-2 text-primary mb-2">
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-sm font-medium uppercase tracking-wider">Dialogue Mastery</span>
                </div>
                <CardTitle className="text-2xl font-bold">Complete the Conversation</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
                <div className="space-y-4 bg-muted/30 p-6 rounded-2xl border border-border">
                    {question.dialogue.map((turn, i) => (
                        <div key={i} className={cn(
                            "flex flex-col gap-1",
                            turn.speaker === "A" ? "items-start" : "items-end text-right"
                        )}>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                                Speaker {turn.speaker}
                            </span>
                            <div className={cn(
                                "max-w-[85%] p-3 rounded-2xl text-sm md:text-base shadow-sm relative group/msg",
                                turn.speaker === "A"
                                    ? "bg-background border border-border rounded-tl-none"
                                    : "bg-primary text-primary-foreground rounded-tr-none"
                            )}>
                                {renderTextWithBlanks(turn.text, question.blanks!, onAnswer, userAnswers, showFeedback, turn.speaker === "B", shuffledBlanks)}

                                {turn.translation && (
                                    <div
                                        onClick={() => toggleTranslation(i)}
                                        className={cn(
                                            "mt-2 pt-2 border-t border-current/10 text-xs italic cursor-pointer transition-all select-none",
                                            visibleTranslations[i]
                                                ? "opacity-60"
                                                : "opacity-20 blur-[2px] hover:opacity-40 hover:blur-none"
                                        )}
                                        title="Click to reveal translation"
                                    >
                                        {visibleTranslations[i] ? turn.translation : "Click to see translation"}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

function renderTextWithBlanks(
    text: string,
    blanks: QuizBlank[],
    onAnswer: (idx: number, val: string) => void,
    userAnswers: Record<number, string>,
    showFeedback: boolean,
    isPrimary: boolean,
    shuffledBlanks: Record<number, string[]>
) {
    const parts = text.split(/(\[\[\d+\]\])/g);

    return parts.map((part, i) => {
        const match = part.match(/\[\[(\d+)\]\]/);
        if (match) {
            const blankIdx = parseInt(match[1]);
            const blank = blanks.find(b => b.index === blankIdx);
            if (!blank) return part;

            const selected = userAnswers[blankIdx];
            const isCorrect = (selected || "").trim().toLowerCase() === (blank.answer || "").trim().toLowerCase();

            return (
                <span key={i} className="inline-flex flex-col gap-1 mx-1 align-middle">
                    <select
                        className={cn(
                            "h-8 px-2 rounded-md text-sm font-medium border-2 appearance-none cursor-pointer",
                            !selected && "border-dashed border-muted-foreground/30 bg-muted/20 text-muted-foreground",
                            selected && !showFeedback && (isPrimary ? "bg-primary-foreground text-primary border-primary-foreground" : "bg-primary text-primary-foreground border-primary"),
                            showFeedback && isCorrect && "bg-green-500 text-white border-green-500",
                            showFeedback && !isCorrect && selected && "bg-destructive text-destructive-foreground border-destructive",
                            showFeedback && !isCorrect && !selected && "border-orange-500 border-dashed"
                        )}
                        disabled={showFeedback}
                        value={selected || ""}
                        onChange={(e) => onAnswer(blankIdx, e.target.value)}
                    >
                        <option value="" disabled>?</option>
                        {(shuffledBlanks[blankIdx] || []).map((opt, oi) => (
                            <option key={oi} value={opt}>{opt}</option>
                        ))}
                    </select>
                </span>
            );
        }
        return <span key={i}>{part}</span>;
    });
}

// Local shuffle for display
function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
