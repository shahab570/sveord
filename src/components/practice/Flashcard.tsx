import { useState } from "react";
import { WordWithProgress } from "@/hooks/useWords";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Check, FastForward, RotateCcw } from "lucide-react";

interface FlashcardProps {
    word: WordWithProgress;
    onRate: (difficulty: "easy" | "good" | "hard") => void;
}

export function Flashcard({ word, onRate }: FlashcardProps) {
    const [showAnswer, setShowAnswer] = useState(false);

    const wordData = word.word_data;
    const displayWord = word.progress?.custom_spelling || word.swedish_word;

    const handleRate = (difficulty: "easy" | "good" | "hard") => {
        setShowAnswer(false);
        onRate(difficulty);
    };

    return (
        <div className="w-full max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
            <Card className="min-h-[400px] flex flex-col justify-center relative overflow-hidden bg-gradient-to-br from-card to-secondary/30 border-2 border-primary/10 shadow-xl rounded-3xl">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-8">
                    {/* Front Side */}
                    <div className="space-y-4">
                        <span className="text-sm font-medium text-primary/60 uppercase tracking-widest">
                            {word.kelly_level ? `Level ${word.kelly_level}` : "Vocabulary"}
                        </span>
                        <h2 className="text-5xl md:text-6xl font-bold text-foreground tracking-tight">
                            {displayWord}
                        </h2>
                        {wordData?.word_type && (
                            <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                                {wordData.word_type} {wordData.gender ? `(${wordData.gender})` : ""}
                            </span>
                        )}
                    </div>

                    {/* Back Side (Answers) */}
                    <div className={`w-full space-y-6 transition-all duration-500 ${showAnswer ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none absolute"}`}>
                        <div className="h-px w-full bg-border" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-foreground">Meanings</h3>
                            <div className="flex flex-wrap justify-center gap-2">
                                {wordData?.meanings.map((m, i) => (
                                    <span key={i} className="px-4 py-2 bg-background border border-border rounded-xl text-lg shadow-sm">
                                        {m.english}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {wordData?.examples?.[0] && (
                            <div className="space-y-2 bg-secondary/50 p-4 rounded-2xl italic">
                                <p className="text-foreground">"{wordData.examples[0].swedish}"</p>
                                <p className="text-muted-foreground text-sm">{wordData.examples[0].english}</p>
                            </div>
                        )}
                    </div>

                    {/* Show Answer Trigger */}
                    {!showAnswer && (
                        <Button
                            size="lg"
                            onClick={() => setShowAnswer(true)}
                            className="mt-8 rounded-full px-8 py-6 text-lg h-auto shadow-lg hover:shadow-primary/20 transition-all flex gap-3"
                        >
                            <Eye className="h-6 w-6" />
                            Show Answer
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Difficulty Buttons */}
            <div className={`grid grid-cols-3 gap-4 transition-all duration-300 ${showAnswer ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}>
                <Button
                    variant="outline"
                    onClick={() => handleRate("hard")}
                    className="h-20 flex flex-col gap-1 border-destructive/30 hover:bg-destructive/10 text-destructive-foreground rounded-2xl"
                >
                    <RotateCcw className="h-5 w-5 text-destructive" />
                    <span className="font-bold">Hard</span>
                    <span className="text-[10px] opacity-60">1 day</span>
                </Button>
                <Button
                    variant="outline"
                    onClick={() => handleRate("good")}
                    className="h-20 flex flex-col gap-1 border-primary/30 hover:bg-primary/10 text-primary rounded-2xl"
                >
                    <Check className="h-5 w-5 text-primary" />
                    <span className="font-bold">Good</span>
                    <span className="text-[10px] opacity-60">Next phase</span>
                </Button>
                <Button
                    variant="outline"
                    onClick={() => handleRate("easy")}
                    className="h-20 flex flex-col gap-1 border-success/30 hover:bg-success/10 text-success rounded-2xl"
                >
                    <FastForward className="h-5 w-5 text-success" />
                    <span className="font-bold">Easy</span>
                    <span className="text-[10px] opacity-60">Mastered</span>
                </Button>
            </div>
        </div>
    );
}
