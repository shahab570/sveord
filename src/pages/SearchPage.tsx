import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WordCard } from "@/components/study/WordCard";
import { useWords, WordWithProgress } from "@/hooks/useWords";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, GraduationCap, Hash, BookMarked } from "lucide-react";
import { VirtualList } from "@/components/common/VirtualList";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedWord, setSelectedWord] = useState<WordWithProgress | null>(
    null
  );

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
      if (updatedWord && JSON.stringify(updatedWord.progress) !== JSON.stringify(selectedWord.progress)) {
        setSelectedWord(updatedWord);
      }
    }
  }, [words, selectedWord]);

  // ... (lines 33-193)

  <VirtualList
    items={kellyWords}
    height="100%"
    itemHeight={64}
    getItemKey={(index) => kellyWords[index].swedish_word}
    renderItem={(word) => <div className="pr-1 pb-2">{renderWordItem(word, "kelly")}</div>}
  />
                </div >

    {/* Frequency */ }
    < div className = "border border-blue-500/20 rounded-2xl p-5 bg-blue-50/10 flex flex-col h-[600px] shadow-sm" >
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
                </div >

    {/* Sidor */ }
    < div className = "border border-purple-500/20 rounded-2xl p-5 bg-purple-50/10 flex flex-col h-[600px] shadow-sm" >
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
                </div >
              </div >
            ) : (
    <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
      <p className="text-muted-foreground text-lg">No results found for "{searchQuery}"</p>
    </div>
  )
}
          </div >
        )}

{
  !selectedWord && searchQuery.length < 2 && (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-secondary/10 rounded-3xl border border-dashed border-border/50">
      <div className="p-5 bg-primary/10 rounded-full animate-pulse">
        <BookOpen className="h-12 w-12 text-primary/60" />
      </div>
      <div>
        <h3 className="text-xl font-bold">Start Searching</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">Type at least 2 characters to find words in your Swedish vocabulary database.</p>
      </div>
    </div>
  )
}
      </div >
    </AppLayout >
  );
}
