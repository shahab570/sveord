import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Eye, Check, FastForward, RotateCcw,
    Sparkles, RefreshCw, BookOpen,
    ChevronUp, ChevronDown, Pencil
} from "lucide-react";
import { usePopulation } from "@/contexts/PopulationContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/services/db";
import { useUserProgress, WordWithProgress } from "@/hooks/useWords";
import { toast } from "sonner";

interface FlashcardProps {
    word: WordWithProgress;
    onRate: (difficulty: "easy" | "good" | "hard") => void;
}

export function Flashcard({ word, onRate }: FlashcardProps) {
    const [showAnswer, setShowAnswer] = useState(false);
    const { regenerateFieldWithInstruction, enhanceUserNote } = usePopulation();
    const { upsertProgress } = useUserProgress();

    // States for custom AI instructions
    const [showNotes, setShowNotes] = useState(false);
    const [showBaseStory, setShowBaseStory] = useState(true);
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [meaning, setMeaning] = useState(word.progress?.user_meaning || "");
    const [customInstrExplanation, setCustomInstrExplanation] = useState("");
    const [showExplanationInput, setShowExplanationInput] = useState(false);
    const [customInstrMeaning, setCustomInstrMeaning] = useState("");
    const [showMeaningInput, setShowMeaningInput] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Live query to ensure deep reactivity when word_data changes (AI generation)
    const liveWord = useLiveQuery(() => db.words.get(word.swedish_word), [word.swedish_word]);
    const wordData = liveWord?.word_data || word.word_data;
    const displayWord = word.progress?.custom_spelling || word.swedish_word;

    const handleRate = (difficulty: "easy" | "good" | "hard") => {
        setShowAnswer(false);
        onRate(difficulty);
    };

    const handleRegenerate = async (field: 'explanation' | 'meanings', instruction: string) => {
        setIsRegenerating(field);
        try {
            await regenerateFieldWithInstruction(word.id, field, instruction, word.swedish_word);
            if (field === 'explanation') {
                setShowExplanationInput(false);
                setCustomInstrExplanation("");
                setShowBaseStory(true); // Ensure it's visible after generating
            } else {
                setShowMeaningInput(false);
                setCustomInstrMeaning("");
            }
        } finally {
            setIsRegenerating(null);
        }
    };

    const handleSaveMeaning = async () => {
        setIsSaving(true);
        try {
            await upsertProgress.mutateAsync({
                word_id: word.id,
                swedish_word: word.swedish_word,
                user_meaning: meaning,
            });
            toast.success("Notes saved!");
        } catch (error) {
            toast.error("Failed to save notes");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnhanceNotes = async () => {
        try {
            if (!meaning) return;
            toast.info("Fine-tuning notes...");
            const enhanced = await enhanceUserNote(meaning);
            if (enhanced) {
                setMeaning(enhanced);
                toast.success("Notes refined!");
            }
        } catch (e: any) { }
    };

    return (
        <div className="w-full max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
            <Card className="min-h-[450px] flex flex-col relative overflow-hidden bg-gradient-to-br from-card to-secondary/30 border-2 border-primary/10 shadow-xl rounded-3xl">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
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

                    {/* BASE WORD STORY BOX - Top Priority (Visibile even before answer) */}
                    <div className="w-full">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Base Word Story</span>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleRegenerate('explanation', '')}
                                    className="p-1 px-2 bg-purple-50 border border-purple-100 rounded-lg text-purple-600 hover:bg-purple-100 flex items-center gap-1.5 transition-colors"
                                    title="Immediate regeneration"
                                >
                                    <RefreshCw className={`h-3 w-3 ${isRegenerating === 'explanation' ? 'animate-spin' : ''}`} />
                                    <span className="text-[10px] font-bold">REGENERATE</span>
                                </button>
                                <button
                                    onClick={() => setShowExplanationInput(!showExplanationInput)}
                                    className="p-1 px-2 bg-purple-600 border border-purple-700 rounded-lg text-white hover:bg-purple-700 flex items-center gap-1.5 transition-all shadow-sm"
                                    title="Regenerate with custom instructions"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    <span className="text-[10px] font-bold tracking-tighter">R-AI</span>
                                </button>
                                <button
                                    onClick={() => setShowBaseStory(!showBaseStory)}
                                    className="p-1 text-purple-400 hover:text-purple-600"
                                >
                                    {showBaseStory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {showBaseStory && (
                            <div className="w-full p-4 bg-purple-50/80 border border-purple-100 rounded-2xl relative group overflow-hidden text-left animate-in fade-in slide-in-from-top-1">
                                {showExplanationInput ? (
                                    <div className="space-y-2">
                                        <Input
                                            value={customInstrExplanation}
                                            onChange={(e) => setCustomInstrExplanation(e.target.value)}
                                            placeholder="Custom instruction..."
                                            className="text-xs h-8 bg-white border-purple-200"
                                            onKeyDown={(e) => e.key === 'Enter' && handleRegenerate('explanation', customInstrExplanation)}
                                        />
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => handleRegenerate('explanation', customInstrExplanation)} disabled={isRegenerating === 'explanation'} className="h-7 text-[10px] bg-purple-600">
                                                Go
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setShowExplanationInput(false)} className="h-7 text-[10px] text-purple-600">Cancel</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[15px] font-semibold text-purple-900 leading-snug min-h-[1.2rem]">
                                        {wordData?.inflectionExplanation ? wordData.inflectionExplanation.replace(/\*\*/g, '') : <span className="text-purple-300 font-normal italic">Click generate to see the story...</span>}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Back Side (Answers) */}
                    <div className={`w-full space-y-6 transition-all duration-500 overflow-hidden ${showAnswer ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none absolute"}`}>
                        <div className="h-px w-full bg-border" />

                        <div className="space-y-4 text-left p-2">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest">Meanings</h3>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleRegenerate('meanings', '')}
                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 transition-colors"
                                        title="Immediate regeneration"
                                    >
                                        <RefreshCw className={`h-3 w-3 ${isRegenerating === 'meanings' ? 'animate-spin' : ''}`} />
                                        <span className="text-[10px] font-bold">REGENERATE</span>
                                    </button>
                                    <button
                                        onClick={() => setShowMeaningInput(!showMeaningInput)}
                                        className="p-1 px-2 bg-blue-600 border border-blue-700 rounded-lg text-white hover:bg-blue-700 flex items-center gap-1.5 transition-all shadow-sm h-[26px]"
                                        title="Regenerate with custom instructions"
                                    >
                                        <Sparkles className="h-3 w-3" />
                                        <span className="text-[10px] font-bold tracking-tighter">R-AI</span>
                                    </button>
                                </div>
                            </div>

                            {showMeaningInput && (
                                <div className="mb-4 space-y-2 animate-in fade-in">
                                    <Input
                                        value={customInstrMeaning}
                                        onChange={(e) => setCustomInstrMeaning(e.target.value)}
                                        placeholder="Custom instruction for meanings..."
                                        className="text-xs h-8"
                                        onKeyDown={(e) => e.key === 'Enter' && handleRegenerate('meanings', customInstrMeaning)}
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => handleRegenerate('meanings', customInstrMeaning)} disabled={isRegenerating === 'meanings'} className="h-7 text-[10px]">
                                            Regenerate
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setShowMeaningInput(false)} className="h-7 text-[10px]">Cancel</Button>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                {wordData?.meanings.map((m, i) => (
                                    <span key={i} className="px-4 py-2 bg-background border border-border rounded-xl text-lg shadow-sm font-medium">
                                        {m.english}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {wordData?.examples?.[0] && (
                            <div className="space-y-2 bg-secondary/50 p-4 rounded-2xl italic text-left">
                                <p className="text-foreground font-medium">"{wordData.examples[0].swedish}"</p>
                                <p className="text-muted-foreground text-sm">"{wordData.examples[0].english}"</p>
                            </div>
                        )}

                        {/* Collapsible Personal Notes for Flashcard */}
                        <div className="w-full border-t border-border/50 pt-2 text-left">
                            <button
                                onClick={() => setShowNotes(!showNotes)}
                                className="flex items-center justify-between w-full py-2 group"
                            >
                                <div className="flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Personal Notes</span>
                                </div>
                                {showNotes ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </button>

                            {showNotes && (
                                <div className="mt-2 pb-4 animate-in fade-in slide-in-from-top-1">
                                    {isEditingNote ? (
                                        <div className="space-y-3 bg-secondary/5 p-4 rounded-2xl border border-secondary/20">
                                            <Textarea
                                                value={meaning}
                                                onChange={(e) => setMeaning(e.target.value)}
                                                className="min-h-[100px] text-sm leading-relaxed border-transparent focus:border-primary/20 bg-transparent resize-none"
                                                placeholder="..."
                                                autoFocus
                                            />
                                            <div className="flex justify-between items-center">
                                                <Button size="sm" variant="ghost" onClick={handleEnhanceNotes} className="text-[10px] font-black h-7">
                                                    ✨ AI FIX
                                                </Button>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="secondary" onClick={() => setIsEditingNote(false)} className="h-7 text-[10px]">EXIT</Button>
                                                    <Button size="sm" onClick={() => { setIsEditingNote(false); handleSaveMeaning(); }} className="h-7 text-[10px]">SAVE</Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => setIsEditingNote(true)}
                                            className="p-3 bg-white/50 rounded-xl border border-dashed border-border hover:border-primary/30 transition-all cursor-pointer min-h-[50px]"
                                        >
                                            {meaning ? (
                                                <p className="text-xs text-slate-600 whitespace-pre-wrap">{meaning}</p>
                                            ) : (
                                                <div className="flex items-center justify-center text-[10px] text-muted-foreground uppercase font-bold py-1">
                                                    Click to add note
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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
                    className="h-20 flex flex-col gap-1 border-destructive/30 hover:bg-destructive/10 text-destructive rounded-2xl"
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
