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
} from "lucide-react";
import { toast } from "sonner";
import { usePopulation } from "@/contexts/PopulationContext";
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
  const { regenerateSingleWord, enhanceUserNote } = usePopulation();
  const [isEditingSpelling, setIsEditingSpelling] = useState(false);
  const [customSpelling, setCustomSpelling] = useState(
    word.progress?.custom_spelling || ""
  );
  const [meaning, setMeaning] = useState(word.progress?.user_meaning || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showAIMeanings, setShowAIMeanings] = useState(true);
  // Default to view mode if content exists, otherwise edit mode
  const [isEditingNote, setIsEditingNote] = useState(!word.progress?.user_meaning);

  const displayWord = word.progress?.custom_spelling || word.swedish_word;
  const isLearned = word.progress?.is_learned || false;
  const wordData = word.word_data;

  // Calculate progress percentage
  const progressPercent = totalCount > 0 ? ((learnedCount / totalCount) * 100).toFixed(1) : "0.0";

  const getLevelBadgeClass = (level: string | null) => {
    switch (level) {
      case "A1":
        return "level-badge-a1";
      case "A2":
        return "level-badge-a2";
      case "B1":
        return "level-badge-b1";
      case "B2":
        return "level-badge-b2";
      case "C1":
        return "level-badge-c1";
      case "C2":
        return "level-badge-c2";
      default:
        return "level-badge bg-gray-100 text-gray-700";
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

  const handleSaveSpelling = async () => {
    setIsSaving(true);
    try {
      await upsertProgress.mutateAsync({
        word_id: word.id,
        swedish_word: word.swedish_word,
        custom_spelling: customSpelling || null,
      });
      setIsEditingSpelling(false);
      toast.success("Spelling updated!");
    } catch (error) {
      toast.error("Failed to update spelling");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLearned = async () => {
    setIsSaving(true);
    try {
      await upsertProgress.mutateAsync({
        word_id: word.id,
        swedish_word: word.swedish_word,
        is_learned: !isLearned,
        user_meaning: meaning,
      });
      toast.success(isLearned ? "Marked as unlearned" : "Marked as learned!");
      if (!isLearned && hasNext) {
        onNext();
      }
    } catch (error: any) {
      console.error("Update failed:", error);
      toast.error(`Failed to update: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  /* New Logic for Header */
  const [showDetails, setShowDetails] = useState(false);

  const lists = [];
  if (word.kelly_source_id) lists.push("Kelly");
  if (word.frequency_rank) lists.push("Frequency");
  if (word.sidor_rank) lists.push("Sidor");

  let listBadgeText = "UNKNOWN LIST";
  if (lists.length === 3) listBadgeText = "ALL LISTS";
  else if (lists.length > 0) listBadgeText = lists.join(" & ").toUpperCase() + (lists.length === 1 ? " ONLY" : "");

  const handleEnhanceNotes = async () => {
    try {
      if (!meaning) return;
      toast.info("Enhancing notes...");
      const enhanced = await enhanceUserNote(meaning);
      if (enhanced) {
        setMeaning(enhanced);
        toast.success("Notes enhanced by AI!");
      }
    } catch (e: any) {
      console.error(e);
      // Error handled in context usually, but safety net here
    }
  };

  return (
    <div className="word-card animate-fade-in relative">
      {/* Absolute Positioned Info Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-primary transition-colors"
        title="Show Details"
      >
        <div className="flex flex-col items-center">
          {/* Using a simple 'i' or icon if available, but for now simple text/icon mix */}
          <span className="text-xs font-bold border border-current rounded-full w-5 h-5 flex items-center justify-center">i</span>
        </div>
      </button>

      {/* Header */}
      <div className="flex flex-col gap-2 mb-8">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 pb-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${lists.length === 3 ? "bg-gradient-to-r from-emerald-100 via-blue-100 to-purple-100 text-slate-700 border border-slate-200" :
            listType === 'kelly' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
              listType === 'frequency' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                'bg-purple-100 text-purple-700 border border-purple-200'
            }`}>
            {listBadgeText}
          </div>
        </div>

        {/* Collapsible Details Section */}
        {showDetails && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-200 bg-secondary/30 p-4 rounded-xl mt-2 grid grid-cols-2 gap-x-8 gap-y-2 text-sm border border-border/50">
            {word.kelly_source_id && (
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-muted-foreground">Kelly ID</span>
                <span className="font-mono font-medium">#{word.kelly_source_id}</span>
              </div>
            )}
            {word.kelly_level && (
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-muted-foreground">Level</span>
                <span className={getLevelBadgeClass(word.kelly_level)}>{word.kelly_level}</span>
              </div>
            )}
            {word.frequency_rank && (
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-muted-foreground">Frequency Rank</span>
                <span className="font-mono font-medium text-blue-600">#{word.frequency_rank}</span>
              </div>
            )}
            {word.sidor_rank && (
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-muted-foreground">Sidor Rank</span>
                <span className="font-mono font-medium text-purple-600">#{word.sidor_rank}</span>
              </div>
            )}
            {wordData?.word_type && wordData.word_type !== "NULL WORD" && (
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-muted-foreground">Type</span>
                <span>{wordData.word_type}</span>
              </div>
            )}
            {wordData?.gender && wordData.gender !== "NULL" && (
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-muted-foreground">Gender</span>
                <span className="uppercase font-bold text-xs">{wordData.gender}</span>
              </div>
            )}
          </div>
        )}

      </div>
      {/* Word Display */}
      <div className="text-center py-8">
        {
          isEditingSpelling ? (
            <div className="space-y-4 max-w-md mx-auto" >
              <Input
                value={customSpelling}
                onChange={(e) => setCustomSpelling(e.target.value)}
                placeholder={word.swedish_word}
                className="text-center text-2xl h-14"
                autoFocus
              />
              <div className="flex justify-center gap-2">
                <Button onClick={handleSaveSpelling} disabled={isSaving}>
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingSpelling(false);
                    setCustomSpelling(word.progress?.custom_spelling || "");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-5xl font-bold text-foreground tracking-tight">
                {displayWord}
              </h2>
              {word.progress?.custom_spelling && (
                <p className="text-sm text-muted-foreground">
                  Original: {word.swedish_word}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingSpelling(true)}
                className="mt-2"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit spelling
              </Button>
            </div>
          )
        }
      </div>

      {/* AI-Generated Meanings Section */}
      {
        wordData && wordData.meanings && wordData.meanings.length > 0 && (
          <div className="space-y-3 mb-6">
            <button
              onClick={() => setShowAIMeanings(!showAIMeanings)}
              className="flex items-center gap-2 text-sm font-medium text-foreground w-full hover:bg-secondary/50 p-2 rounded-lg transition-colors"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <Languages className="h-4 w-4" />
              <span>AI Meanings</span>

              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 gap-1 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={(e) => {
                  e.stopPropagation();
                  regenerateSingleWord(word.id, word.swedish_word);
                }}
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </Button>

              <span className="text-xs text-muted-foreground ml-2">
                {showAIMeanings ? "Hide" : "Show"}
              </span>
            </button>

            {showAIMeanings && (
              <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border">
                {/* Meanings */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meanings</p>
                  <div className="space-y-1">
                    {wordData.meanings.map((m, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground mt-1">{i + 1}.</span>
                        <div>
                          <span className="font-medium text-foreground">{m.english}</span>
                          {m.context && (
                            <span className="text-sm text-muted-foreground ml-1">
                              — {m.context}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Examples */}
                {wordData.examples && wordData.examples.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Examples</p>
                    <div className="space-y-2">
                      {wordData.examples.map((ex, i) => (
                        <div key={i} className="text-sm space-y-0.5 bg-background/50 p-2 rounded">
                          <p className="font-medium text-foreground italic">"{ex.swedish}"</p>
                          <p className="text-muted-foreground">"{ex.english}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Synonyms & Antonyms */}
                <div className="flex flex-wrap gap-4">
                  {wordData.synonyms && wordData.synonyms.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Synonyms</p>
                      <div className="flex flex-wrap gap-1">
                        {wordData.synonyms.map((s, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {wordData.antonyms && wordData.antonyms.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Antonyms</p>
                      <div className="flex flex-wrap gap-1">
                        {wordData.antonyms.map((a, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      }

      {/* Generate Button - Shows when no AI meanings exist */}
      {
        (!wordData || !wordData.meanings || wordData.meanings.length === 0) && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-amber-800">No AI meanings yet</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-100"
              onClick={() => regenerateSingleWord(word.id, word.swedish_word)}
            >
              <Sparkles className="h-4 w-4" />
              Generate Meaning
            </Button>
          </div>
        )
      }


      {/* Personal Notes Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Personal Notes
          </label>
          <div className="flex gap-2">
            {meaning && !isEditingNote && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setIsEditingNote(true)}
              >
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            )}
            {isEditingNote && meaning && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary"
                onClick={() => {
                  setIsEditingNote(false);
                  if (meaning !== word.progress?.user_meaning) {
                    handleSaveMeaning();
                  }
                }}
              >
                Review & Save
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-[120px]">
          <RichTextEditor
            value={meaning}
            onChange={setMeaning}
            editable={isEditingNote}
            onAiEnhance={handleEnhanceNotes}
          />
          {!meaning && !isEditingNote && (
            <div
              className="absolute inset-0 flex items-center justify-center text-muted-foreground italic cursor-pointer bg-transparent"
              onClick={() => setIsEditingNote(true)}
            >
              <span className="flex items-center gap-2">Click edit to add notes...</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation & Actions */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!hasPrevious}
          className="gap-2"
        >
          <ChevronLeft className="h-5 w-5" />
          Previous
        </Button>

        <Button
          onClick={handleToggleLearned}
          disabled={isSaving}
          className={`gap-2 px-8 ${isLearned
            ? "bg-success hover:bg-success/90 text-success-foreground"
            : ""
            }`}
        >
          <Check className="h-5 w-5" />
          {isLearned ? "Learned ✓" : "Mark Learned"}
        </Button>

        <Button
          variant="outline"
          onClick={onNext}
          disabled={!hasNext}
          className="gap-2"
        >
          Next
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div >
  );
}
