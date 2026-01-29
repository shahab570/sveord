import { useState } from "react";
import { WordWithProgress, useUserProgress } from "@/hooks/useWords";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Pencil,
  X,
  Shuffle,
  BookOpen,
  Languages,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { usePopulation } from "@/contexts/PopulationContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/services/db";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { cn } from "@/lib/utils";

interface WordCardProps {
  word: WordWithProgress;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
  learnedCount?: number;
  isRandomMode: boolean;
  onToggleRandom: () => void;
  showRandomButton?: boolean;
  listType?: "kelly" | "frequency" | "sidor";
}

export function WordCard({
  word,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  currentIndex,
  totalCount,
  learnedCount = 0,
  isRandomMode,
  onToggleRandom,
  showRandomButton = true,
  listType = "frequency",
}: WordCardProps) {
  const { upsertProgress } = useUserProgress();
  const { regenerateFieldWithInstruction, enhanceUserNote } = usePopulation();
  const [isEditingSpelling, setIsEditingSpelling] = useState(false);
  const [showBaseStory, setShowBaseStory] = useState(true);
  const [customSpelling, setCustomSpelling] = useState(
    word.progress?.custom_spelling || ""
  );
  const [meaning, setMeaning] = useState(word.progress?.user_meaning || "");
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [customInstrExplanation, setCustomInstrExplanation] = useState("");
  const [showExplanationInput, setShowExplanationInput] = useState(false);
  const [customInstrMeaning, setCustomInstrMeaning] = useState("");
  const [showMeaningInput, setShowMeaningInput] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  // Live query to ensure deep reactivity when word_data changes (AI generation)
  const liveWord = useLiveQuery(() => db.words.get(word.swedish_word), [word.swedish_word]);
  const wordData = liveWord?.word_data || word.word_data;

  const handleRegenerate = async (field: 'explanation' | 'meanings', instruction: string) => {
    setIsRegenerating(field);
    try {
      await regenerateFieldWithInstruction(word.id, field, instruction, word.swedish_word);
      if (field === 'explanation') {
        setShowExplanationInput(false);
        setCustomInstrExplanation("");
        setShowBaseStory(true);
      } else {
        setShowMeaningInput(false);
        setCustomInstrMeaning("");
      }
    } finally {
      setIsRegenerating(null);
    }
  };

  const handleSaveMeaning = async () => {
    try {
      await upsertProgress.mutateAsync({
        word_id: word.id,
        swedish_word: word.swedish_word,
        user_meaning: meaning,
      });
      toast.success("Notes saved!");
      setIsEditingNote(false);
    } catch (error) {
      toast.error("Failed to save notes");
    }
  };

  const handleSaveSpelling = async () => {
    try {
      await upsertProgress.mutateAsync({
        word_id: word.id,
        swedish_word: word.swedish_word,
        custom_spelling: customSpelling,
      });
      toast.success("Spelling updated!");
      setIsEditingSpelling(false);
    } catch (error) {
      toast.error("Failed to update spelling");
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
    <div className="w-full animate-in fade-in zoom-in duration-300">
      <div className="bg-card rounded-[2rem] border-2 border-primary/10 shadow-xl overflow-hidden">
        {/* Header Section */}
        <div className="p-8 pb-4 text-center space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">
              {listType} List #{word.frequency_rank || word.id}
            </span>
            <div className="flex gap-2">
              {word.kelly_level && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                    `level-badge-${word.kelly_level.toLowerCase()}`
                  )}
                >
                  {word.kelly_level}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 group">
            {isEditingSpelling ? (
              <div className="flex items-center gap-2">
                <Input
                  value={customSpelling}
                  onChange={(e) => setCustomSpelling(e.target.value)}
                  className="text-3xl font-bold text-center h-12 w-48 bg-secondary/20 border-primary/20"
                  autoFocus
                />
                <button
                  onClick={handleSaveSpelling}
                  className="p-2 bg-primary text-primary-foreground rounded-full"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsEditingSpelling(false)}
                  className="p-2 bg-secondary text-secondary-foreground rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative group/title">
                <h2 className="text-5xl md:text-6xl font-black text-foreground tracking-tighter">
                  {customSpelling || word.swedish_word}
                </h2>
                <button
                  onClick={() => setIsEditingSpelling(true)}
                  className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            {wordData?.word_type && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full mt-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wide">
                  {wordData.word_type}{wordData.gender ? ` (${wordData.gender})` : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 pt-4 space-y-6">
          {/* BASE WORD STORY BOX - Top Priority */}
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
                      placeholder="Custom instruction (e.g., simpler words)..."
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-primary/60" />
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Definitions
                </h3>
              </div>
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
              <div className="mb-4 space-y-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in">
                <Input
                  value={customInstrMeaning}
                  onChange={(e) => setCustomInstrMeaning(e.target.value)}
                  placeholder="Custom instruction for meanings..."
                  className="text-xs h-8 bg-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleRegenerate('meanings', customInstrMeaning)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleRegenerate('meanings', customInstrMeaning)} disabled={isRegenerating === 'meanings'} className="h-7 text-[10px] bg-blue-600">
                    Apply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowMeaningInput(false)} className="h-7 text-[10px] text-blue-600">Cancel</Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {wordData?.meanings.map((meaning, idx) => (
                <div
                  key={idx}
                  className="px-4 py-2 bg-secondary/30 rounded-xl border border-border/50 text-foreground font-medium shadow-sm"
                >
                  {meaning.english}
                </div>
              ))}
            </div>
          </div>

          {wordData?.examples && wordData.examples.length > 0 && (
            <div className="space-y-3 bg-secondary/10 p-4 rounded-2xl border border-border/50">
              {wordData.examples.slice(0, 2).map((example, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="text-sm font-semibold text-foreground leading-relaxed italic">
                    "{example.swedish}"
                  </p>
                  <p className="text-xs text-muted-foreground">
                    "{example.english}"
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Personal Notes Section */}
          <div className="space-y-2 border-t border-border/50 pt-4">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center justify-between w-full py-1 group"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Personal Notes
                </h3>
              </div>
              {showNotes ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {showNotes && (
              <div className="mt-2 pb-6 animate-in fade-in slide-in-from-top-2">
                {isEditingNote ? (
                  <div className="space-y-4">
                    <RichTextEditor
                      value={meaning}
                      onChange={setMeaning}
                    />
                    <div className="flex justify-between items-center bg-secondary/5 p-2 rounded-xl">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEnhanceNotes}
                        className="text-[10px] font-black h-8 hover:bg-white"
                      >
                        ✨ AI FIX
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setIsEditingNote(false)}
                          className="h-8 text-[10px] font-bold"
                        >
                          EXIT
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setIsEditingNote(false);
                            handleSaveMeaning();
                          }}
                          className="h-8 text-[10px] font-bold shadow-lg shadow-primary/20"
                        >
                          SAVE NOTE
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingNote(true)}
                    className="p-4 bg-white/50 rounded-2xl border-2 border-dashed border-border hover:border-primary/30 transition-all cursor-pointer group/note"
                  >
                    {meaning ? (
                      <div
                        className="prose prose-sm max-w-none text-slate-600 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: meaning }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 text-muted-foreground/40 group-hover/note:text-primary/40">
                        <Pencil className="h-6 w-6 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Click to add mnemonics or notes
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Section */}
        <div className="grid grid-cols-2">
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="flex items-center justify-center gap-2 p-6 border-t border-r border-border hover:bg-secondary/30 disabled:opacity-30 transition-colors uppercase text-[10px] font-black tracking-widest"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="flex items-center justify-center gap-2 p-6 border-t border-border hover:bg-secondary/30 disabled:opacity-30 transition-colors uppercase text-[10px] font-black tracking-widest text-primary"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 px-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <span>PROGRESS {learnedCount}/{totalCount}</span>
          <div className="w-24 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${(learnedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {showRandomButton && (
            <button
              onClick={onToggleRandom}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors",
                isRandomMode
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              <Shuffle className="h-3 w-3" />
              {isRandomMode ? "SHUFFLE ON" : "SHUFFLE OFF"}
            </button>
          )}
          <span>CARD {currentIndex + 1} OF {totalCount}</span>
        </div>
      </div>
    </div>
  );
}
