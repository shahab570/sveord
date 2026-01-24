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
} from "lucide-react";
import { toast } from "sonner";

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
  const [isEditingSpelling, setIsEditingSpelling] = useState(false);
  const [customSpelling, setCustomSpelling] = useState(
    word.progress?.custom_spelling || ""
  );
  const [meaning, setMeaning] = useState(word.progress?.user_meaning || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showAIMeanings, setShowAIMeanings] = useState(true);

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
        is_learned: !isLearned,
        user_meaning: meaning,
      });
      toast.success(isLearned ? "Marked as unlearned" : "Marked as learned!");
      if (!isLearned && hasNext) {
        onNext();
      }
    } catch (error) {
      toast.error("Failed to update progress");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="word-card animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
        {listType === "frequency" && word.frequency_rank && (
          <span className="text-sm font-medium text-muted-foreground">
            #{word.frequency_rank}
          </span>
        )}
        {listType === "kelly" && word.kelly_source_id && (
          <span className="text-sm font-medium text-muted-foreground">
            #{word.kelly_source_id}
          </span>
        )}
        {listType === "sidor" && word.sidor_rank && (
          <span className="text-sm font-medium text-muted-foreground">
            #{word.sidor_rank}
          </span>
        )}
        {word.kelly_level && (
          <span className={getLevelBadgeClass(word.kelly_level)}>
            {word.kelly_level}
          </span>
        )}
        {wordData?.word_type && (
          <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">
            {wordData.word_type}
          </span>
        )}
        </div>
        <div className="flex items-center gap-2">
          {showRandomButton && (
            <Button
              variant={isRandomMode ? "default" : "outline"}
              size="sm"
              onClick={onToggleRandom}
              className="gap-2"
            >
              <Shuffle className="h-4 w-4" />
              Random
            </Button>
          )}
          <div className="text-right">
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {totalCount}
            </span>
            <div className="text-xs text-primary font-medium">
              {learnedCount}/{totalCount} learned ({progressPercent}%)
            </div>
          </div>
        </div>
      </div>

      {/* Word Display */}
      <div className="text-center py-8">
        {isEditingSpelling ? (
          <div className="space-y-4 max-w-md mx-auto">
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
        )}
      </div>

      {/* AI-Generated Meanings Section */}
      {wordData && wordData.meanings && wordData.meanings.length > 0 && (
        <div className="space-y-3 mb-6">
          <button
            onClick={() => setShowAIMeanings(!showAIMeanings)}
            className="flex items-center gap-2 text-sm font-medium text-foreground w-full hover:bg-secondary/50 p-2 rounded-lg transition-colors"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <Languages className="h-4 w-4" />
            <span>AI Meanings</span>
            <span className="text-xs text-muted-foreground ml-auto">
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
      )}

      {/* Personal Notes Section */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Personal Notes
        </label>
        <Textarea
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          onBlur={handleSaveMeaning}
          placeholder="Add your own notes, memory tricks, or additional meanings..."
          className="min-h-[80px] resize-none"
        />
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
          className={`gap-2 px-8 ${
            isLearned
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
    </div>
  );
}
