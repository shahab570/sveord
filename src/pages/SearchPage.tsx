import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WordCard } from "@/components/study/WordCard";
import { useWords, WordWithProgress } from "@/hooks/useWords";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, GraduationCap, Hash, BookMarked } from "lucide-react";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWord, setSelectedWord] = useState<WordWithProgress | null>(
    null
  );

  // Search uses partial matching (ILIKE %query%) - already implemented in useWords
  const { data: words, isLoading } = useWords({
    search: searchQuery.length >= 2 ? searchQuery : undefined,
  });

  // Sync selectedWord with fresh data after mutations
  useEffect(() => {
    if (selectedWord && words) {
      const updatedWord = words.find(w => w.id === selectedWord.id);
      if (updatedWord && updatedWord.progress?.is_learned !== selectedWord.progress?.is_learned) {
        setSelectedWord(updatedWord);
      }
    }
  }, [words, selectedWord]);

  // Split words into Kelly, Frequency, and Sidor lists
  const { kellyWords, frequencyWords, sidorWords } = useMemo(() => {
    if (!words) return { kellyWords: [], frequencyWords: [], sidorWords: [] };
    return {
      kellyWords: words.filter((w) => w.kelly_level !== null),
      frequencyWords: words.filter((w) => w.frequency_rank !== null),
      sidorWords: words.filter((w) => w.sidor_rank !== null),
    };
  }, [words]);

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

  const renderWordItem = (word: WordWithProgress, listType: "kelly" | "frequency" | "sidor") => {
    const isLearned = word.progress?.is_learned;
    
    // Different background colors for learned vs unlearned
    const learnedBg = listType === "kelly" 
      ? "bg-emerald-100 border-emerald-400" 
      : listType === "frequency"
        ? "bg-blue-100 border-blue-400"
        : "bg-purple-100 border-purple-400";
    const unlearnedBg = listType === "kelly"
      ? "bg-emerald-50/30 border-emerald-200"
      : listType === "frequency"
        ? "bg-blue-50/30 border-blue-200"
        : "bg-purple-50/30 border-purple-200";
    
    return (
      <button
        key={`${listType}-${word.id}`}
        onClick={() => setSelectedWord(word)}
        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
          isLearned ? learnedBg : unlearnedBg
        } hover:opacity-80`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isLearned ? "bg-success" : "bg-muted-foreground/30"
            }`}
          />
          <div>
            <span className="text-base font-medium text-foreground">
              {word.swedish_word}
            </span>
            {isLearned && (
              <span className="text-xs ml-2 px-1.5 py-0.5 bg-success/20 text-success rounded">
                Learned
              </span>
            )}
            {word.progress?.user_meaning && (
              <span className="text-sm text-muted-foreground ml-2">
                - {word.progress.user_meaning}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {listType === "frequency" && word.frequency_rank && (
            <span className="text-sm text-blue-600 font-medium">
              #{word.frequency_rank}
            </span>
          )}
          {listType === "sidor" && word.sidor_rank && (
            <span className="text-sm text-purple-600 font-medium">
              #{word.sidor_rank}
            </span>
          )}
          {listType === "kelly" && word.kelly_level && (
            <span className={getLevelBadgeClass(word.kelly_level)}>
              {word.kelly_level}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Search Words</h1>
            <p className="text-sm text-muted-foreground">
              Find any word in your vocabulary (partial matching supported)
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedWord(null);
            }}
            placeholder="Type at least 2 characters to search (e.g., 'bil' finds bil, bilen, bilar...)"
            className="pl-10 h-14 text-lg"
            autoFocus
          />
        </div>

        {/* Selected Word Card - without random mode button */}
        {selectedWord && (
          <div className="relative">
            <button
              onClick={() => setSelectedWord(null)}
              className="absolute -top-2 -right-2 z-10 p-2 bg-muted rounded-full hover:bg-muted/80 transition-colors text-lg font-bold"
            >
              <span className="sr-only">Close</span>
              ×
            </button>
            <WordCard
              word={selectedWord}
              onPrevious={() => {}}
              onNext={() => {}}
              hasPrevious={false}
              hasNext={false}
              currentIndex={0}
              totalCount={1}
              learnedCount={selectedWord.progress?.is_learned ? 1 : 0}
              isRandomMode={false}
              onToggleRandom={() => {}}
              showRandomButton={false}
            />
          </div>
        )}

        {/* Search Results - Three separate boxes */}
        {!selectedWord && searchQuery.length >= 2 && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-card rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : words && words.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Found {words.length} word{words.length !== 1 ? 's' : ''} containing "{searchQuery}"
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Kelly List Box */}
                  <div className="border-2 border-emerald-300 rounded-xl p-4 bg-emerald-50/30">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-emerald-200">
                      <GraduationCap className="h-5 w-5 text-emerald-600" />
                      <h3 className="text-lg font-semibold text-emerald-800">
                        Kelly List
                      </h3>
                      <span className="ml-auto text-sm text-emerald-600 font-medium">
                        {kellyWords.length} found
                      </span>
                    </div>
                    {kellyWords.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {kellyWords.slice(0, 25).map((word) => renderWordItem(word, "kelly"))}
                        {kellyWords.length > 25 && (
                          <p className="text-sm text-muted-foreground text-center pt-2">
                            Showing first 25 of {kellyWords.length} results
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No Kelly List words found
                      </p>
                    )}
                  </div>

                  {/* Frequency List Box */}
                  <div className="border-2 border-blue-300 rounded-xl p-4 bg-blue-50/30">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-200">
                      <Hash className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-blue-800">
                        Frequency List
                      </h3>
                      <span className="ml-auto text-sm text-blue-600 font-medium">
                        {frequencyWords.length} found
                      </span>
                    </div>
                    {frequencyWords.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {frequencyWords.slice(0, 25).map((word) => renderWordItem(word, "frequency"))}
                        {frequencyWords.length > 25 && (
                          <p className="text-sm text-muted-foreground text-center pt-2">
                            Showing first 25 of {frequencyWords.length} results
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No Frequency List words found
                      </p>
                    )}
                  </div>

                  {/* Sidor List Box */}
                  <div className="border-2 border-purple-300 rounded-xl p-4 bg-purple-50/30">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-purple-200">
                      <BookMarked className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-800">
                        Sidor List
                      </h3>
                      <span className="ml-auto text-sm text-purple-600 font-medium">
                        {sidorWords.length} found
                      </span>
                    </div>
                    {sidorWords.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {sidorWords.slice(0, 25).map((word) => renderWordItem(word, "sidor"))}
                        {sidorWords.length > 25 && (
                          <p className="text-sm text-muted-foreground text-center pt-2">
                            Showing first 25 of {sidorWords.length} results
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No Sidor List words found
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No words found containing "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!selectedWord && searchQuery.length < 2 && (
          <div className="text-center py-12">
            <div className="p-4 bg-muted rounded-2xl w-fit mx-auto mb-4">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">
              Search your vocabulary
            </h3>
            <p className="text-muted-foreground mt-2">
              Type at least 2 characters to find words. Partial matches are supported.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Example: searching "bil" will find bil, bilen, bilar, bilarna, rosbil, etc.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
