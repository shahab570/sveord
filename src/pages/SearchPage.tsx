import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WordCard } from "@/components/study/WordCard";
import { useWords, WordWithProgress } from "@/hooks/useWords";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, GraduationCap, Hash, BookMarked, Sparkles, Plus, Loader2 } from "lucide-react";
import { VirtualList } from "@/components/common/VirtualList";
import { useCaptureWord } from "@/hooks/useCaptureWord";
import { useApiKeys } from "@/hooks/useApiKeys";
import { db } from "@/services/db";
import { toast } from "sonner";
import { stripMarkdown } from "@/utils/markdownUtils";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedWord, setSelectedWord] = useState<WordWithProgress | null>(
    null
  );
  const { apiKeys } = useApiKeys();
  const { captureWord, isCapturing } = useCaptureWord();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // useWords now uses useLiveQuery and returns the array directly
  const words = useWords({
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
  });

  const isLoading = searchQuery.length >= 2 && words === undefined;

  // Sync selectedWord with fresh data after mutations
  useEffect(() => {
    if (selectedWord && words) {
      // Use swedish_word for finding the word, as IDs might be unreliable (e.g. 0)
      const updatedWord = words.find(w => w.swedish_word === selectedWord.swedish_word);
      if (updatedWord) {
        // Deeply check if anything meaningful changed (progress or word_data)
        const hasProgressChanged = JSON.stringify(updatedWord.progress) !== JSON.stringify(selectedWord.progress);
        const hasDataChanged = JSON.stringify(updatedWord.word_data) !== JSON.stringify(selectedWord.word_data);

        if (hasProgressChanged || hasDataChanged) {
          setSelectedWord(updatedWord);
        }
      }
    }
  }, [words, selectedWord]);

  // Split words into Kelly, Frequency, Sidor, and FT lists
  const { kellyWords, frequencyWords, sidorWords, ftWords } = useMemo(() => {
    if (!words) return { kellyWords: [], frequencyWords: [], sidorWords: [], ftWords: [] };

    return {
      kellyWords: words.filter((w) => w.kelly_level !== null),
      frequencyWords: words.filter((w) => w.frequency_rank !== null),
      sidorWords: words.filter((w) => w.sidor_rank !== null),
      ftWords: words.filter((w) => !!w.is_ft),
    };
  }, [words]);

  const getLevelBadgeClass = (level: string | null) => {
    switch (level) {
      case "A1": return "level-badge-a1";
      case "A2": return "level-badge-a2";
      case "B1": return "level-badge-b1";
      case "B2": return "level-badge-b2";
      case "C1": return "level-badge-c1";
      case "C2": return "level-badge-c2";
      default: return "level-badge bg-gray-100 text-gray-700";
    }
  };

  const handleAddWordToFT = async () => {
    if (!debouncedSearch.trim()) return;

    const result = await captureWord(debouncedSearch);

    if (result.status === 'success') {
      toast.success(`Successfully added "${result.word.swedish_word}" to FT List!`);
    } else if (result.status === 'confirmation_needed') {
      // Ideally we should show a confirmation dialog here, but for now we'll just notify
      toast.info(`Found base form "${result.baseForm}". Please try adding that instead.`);
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  };

  const renderWordItem = (word: WordWithProgress, listType: "kelly" | "frequency" | "sidor" | "ft") => {
    const isLearned = word.progress?.is_learned;
    const isReserve = word.progress?.is_reserve;

    // Learned takes precedence over Reserve for styling if both are true (though usually mutual exclusive in intent, logic allows both)
    // If Learned -> Green
    // If Reserve & !Learned -> Amber

    let containerClasses = "";

    if (isLearned) {
      containerClasses = listType === "kelly"
        ? "bg-emerald-100 border-l-4 border-l-emerald-600 border-y border-r border-emerald-200 shadow-md"
        : listType === "frequency"
          ? "bg-blue-100 border-l-4 border-l-blue-600 border-y border-r border-blue-200 shadow-md"
          : listType === "sidor"
            ? "bg-purple-100 border-l-4 border-l-purple-600 border-y border-r border-purple-200 shadow-md"
            : "bg-indigo-100 border-l-4 border-l-indigo-600 border-y border-r border-indigo-200 shadow-md";
    } else if (isReserve) {
      containerClasses = "bg-amber-100 border-l-4 border-l-amber-500 border-y border-r border-amber-200 shadow-md";
    } else {
      // Unlearned / Normal
      containerClasses = listType === "kelly"
        ? "bg-emerald-50/30 border border-emerald-100 hover:border-emerald-300"
        : listType === "frequency"
          ? "bg-blue-50/30 border border-blue-100 hover:border-blue-300"
          : listType === "sidor"
            ? "bg-purple-50/30 border border-purple-100 hover:border-purple-300"
            : "bg-indigo-50/30 border border-indigo-100 hover:border-indigo-300";
    }

    return (
      <button
        onClick={() => setSelectedWord(word)}
        className={`w-full flex items-center justify-between p-4 rounded-lg transition-all text-left mb-2 group ${containerClasses} hover:translate-x-1`}
      >
        <div className="flex items-center gap-3">
          {isReserve && !isLearned ? (
            <div className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center">
              <BookMarked className="h-4 w-4 text-amber-600 fill-amber-600" />
            </div>
          ) : (
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${isLearned
                ? "bg-success ring-2 ring-white shadow-sm scale-110"
                : "bg-muted-foreground/30"
                }`}
            />
          )}

          <div className="flex flex-col">
            <span className={`text-base text-foreground ${isLearned || isReserve ? 'font-black tracking-tight text-lg' : 'font-medium'}`}>
              {word.swedish_word}
            </span>
            {(word.progress?.user_meaning || word.word_data?.meanings?.[0]?.english) && (
              <span className={`text-xs truncate max-w-[150px] ${isLearned || isReserve ? 'text-foreground/80 font-medium' : 'text-muted-foreground'}`}>
                {stripMarkdown(word.progress?.user_meaning || word.word_data?.meanings?.[0]?.english || "")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {listType === "frequency" && word.frequency_rank && (
            <span className={`text-xs font-mono font-bold ${isLearned ? 'text-blue-800' : isReserve ? 'text-amber-800' : 'text-blue-600'}`}>
              #{word.frequency_rank}
            </span>
          )}
          {listType === "sidor" && word.sidor_rank && (
            <span className={`text-xs font-mono font-bold ${isLearned ? 'text-purple-800' : isReserve ? 'text-amber-800' : 'text-purple-600'}`}>
              #{word.sidor_rank}
            </span>
          )}
          {listType === "kelly" && word.kelly_level && (
            <span className={`${getLevelBadgeClass(word.kelly_level)} ${isLearned || isReserve ? 'ring-1 ring-black/10 shadow-sm' : ''}`}>
              {word.kelly_level}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Search Words</h1>
              <p className="text-sm text-muted-foreground">Find any word across all lists</p>
            </div>
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedWord(null);
            }}
            placeholder="Search keywords..."
            className="pl-12 h-14 text-lg bg-card border-2 border-border focus:border-primary rounded-2xl shadow-sm transition-all"
            autoFocus
          />
        </div>

        {selectedWord && (
          <div className="relative animate-in slide-in-from-top-4 duration-300">
            <button
              onClick={() => setSelectedWord(null)}
              className="absolute -top-3 -right-3 z-10 p-2 bg-background border border-border rounded-full shadow-lg hover:bg-muted transition-colors"
            >
              <span className="text-xl">×</span>
            </button>
            <WordCard
              key={selectedWord.swedish_word}
              word={selectedWord}
              onPrevious={() => { }}
              onNext={() => { }}
              hasPrevious={false}
              hasNext={false}
              currentIndex={0}
              totalCount={1}
              learnedCount={selectedWord.progress?.is_learned ? 1 : 0}
              isRandomMode={false}
              onToggleRandom={() => { }}
              showRandomButton={false}
              onDelete={() => setSelectedWord(null)}
            />
          </div>
        )}

        {!selectedWord && searchQuery.length >= 2 && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-64 bg-card rounded-2xl animate-pulse border border-border" />
                ))}
              </div>
            ) : words && words.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Kelly */}
                <div className="border border-emerald-500/20 rounded-2xl p-4 bg-emerald-50/10 flex flex-col h-[600px] shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-emerald-500/10">
                    <GraduationCap className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-lg font-bold text-emerald-800">Kelly List</h3>
                    <span className="ml-auto bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">{kellyWords.length}</span>
                  </div>
                  <VirtualList
                    items={kellyWords}
                    height="100%"
                    itemHeight={64}
                    getItemKey={(index) => kellyWords[index].swedish_word}
                    renderItem={(word) => <div className="pr-1 pb-2">{renderWordItem(word, "kelly")}</div>}
                  />
                </div>

                {/* Frequency */}
                <div className="border border-blue-500/20 rounded-2xl p-4 bg-blue-50/10 flex flex-col h-[600px] shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-500/10">
                    <Hash className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-bold text-blue-800">Frequency List</h3>
                    <span className="ml-auto bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{frequencyWords.length}</span>
                  </div>
                  <VirtualList
                    items={frequencyWords}
                    height="100%"
                    itemHeight={64}
                    getItemKey={(index) => frequencyWords[index].swedish_word}
                    renderItem={(word) => <div className="pr-1 pb-2">{renderWordItem(word, "frequency")}</div>}
                  />
                </div>

                {/* Sidor */}
                <div className="border border-purple-500/20 rounded-2xl p-4 bg-purple-50/10 flex flex-col h-[600px] shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-purple-500/10">
                    <BookMarked className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-bold text-purple-800">Sidor List</h3>
                    <span className="ml-auto bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">{sidorWords.length}</span>
                  </div>
                  <VirtualList
                    items={sidorWords}
                    height="100%"
                    itemHeight={64}
                    getItemKey={(index) => sidorWords[index].swedish_word}
                    renderItem={(word) => <div className="pr-1 pb-2">{renderWordItem(word, "sidor")}</div>}
                  />
                </div>

                {/* FT List */}
                <div className="border border-indigo-500/20 rounded-2xl p-4 bg-indigo-50/10 flex flex-col h-[600px] shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-500/10">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-lg font-bold text-indigo-800">FT List</h3>
                    <span className="ml-auto bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold">{ftWords.length}</span>
                  </div>
                  <VirtualList
                    items={ftWords}
                    height="100%"
                    itemHeight={64}
                    getItemKey={(index) => ftWords[index].swedish_word}
                    renderItem={(word) => <div className="pr-1 pb-2">{renderWordItem(word, "ft")}</div>}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl flex flex-col items-center gap-6">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-lg italic">No results found in your current lists for "{searchQuery}"</p>
                  <p className="text-sm text-muted-foreground">Would you like to generate an AI card and add it to your FT List?</p>
                </div>
                <Button
                  onClick={handleAddWordToFT}
                  disabled={isCapturing}
                  className="h-12 px-8 rounded-xl bg-purple-600 hover:bg-purple-700 hover:scale-105 transition-all shadow-lg gap-3"
                >
                  {isCapturing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Add "{searchQuery}" to FT List
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {!selectedWord && searchQuery.length < 2 && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-secondary/10 rounded-3xl border border-dashed border-border/50">
            <div className="p-5 bg-primary/10 rounded-full animate-pulse">
              <BookOpen className="h-12 w-12 text-primary/60" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Start Searching</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">Type at least 2 characters to find words in your Swedish vocabulary database.</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
