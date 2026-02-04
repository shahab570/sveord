import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { WordCard } from "@/components/study/WordCard";
import { useWords } from "@/hooks/useWords";
import { Sparkles, BookOpen, Bookmark, CheckCircle, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { determineUnifiedLevel } from "@/utils/levelUtils"; // Import added

export default function ReserveList() {
    const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Fetch only reserved words
    const words = useWords({ listType: "reserve" });
    const isLoading = words === undefined;

    const filteredWords = useMemo(() => {
        if (!words) return [];
        let result = words.map(w => ({
            ...w,
            unified_level: determineUnifiedLevel(w)
        }));

        // Optional search within queue
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(w => w.swedish_word.toLowerCase().includes(term));
        }

        return result;
    }, [words, searchTerm]);

    const selectedWord = filteredWords.find(w => w.swedish_word === selectedWordKey);
    const selectedIndex = filteredWords.findIndex(w => w.swedish_word === selectedWordKey);

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-10">
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-100 rounded-xl">
                                <Bookmark className="h-6 w-6 text-amber-600 fill-current" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Study Queue</h1>
                                <p className="text-sm text-muted-foreground">
                                    {filteredWords.length} words saved for later study.
                                </p>
                            </div>
                        </div>

                        {/* Search within queue */}
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Filter queue..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-background"
                            />
                        </div>
                    </div>
                </div>

                {/* List Content */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                    </div>
                ) : filteredWords.length === 0 ? (
                    <div className="text-center py-20 bg-secondary/20 rounded-3xl border-2 border-dashed border-border/50">
                        <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <Bookmark className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Queue is empty</h3>
                        <p className="max-w-xs mx-auto text-sm text-muted-foreground">
                            {searchTerm ? "No matches found in your queue." : "Add words to your queue from the Dictionary or Daily predictions."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredWords.map((word) => (
                            <div
                                key={word.id}
                                onClick={() => setSelectedWordKey(word.swedish_word)}
                                className="group relative flex flex-col justify-between p-5 rounded-2xl border bg-card hover:shadow-md hover:border-primary/50 transition-all cursor-pointer overflow-hidden border-l-4 border-l-amber-500"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">
                                        {word.swedish_word}
                                    </h3>
                                    {word.unified_level && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase">
                                            {word.unified_level}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                                    {word.word_data?.meanings?.[0]?.english || "No translation"}
                                </p>
                                <div className="flex items-center gap-2 mt-auto">
                                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                        QUEUED
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Word Details Dialog */}
            <Dialog open={!!selectedWord} onOpenChange={(open) => !open && setSelectedWordKey(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-none">
                    <DialogTitle className="sr-only">Word Details</DialogTitle>
                    {selectedWord && (
                        <div className="relative">
                            {/* Close button handled by Dialog default, but we can add custom if needed. 
                                 WordCard usually has its own style. 
                                 We'll wrap it nicely. */}
                            <WordCard
                                word={selectedWord}
                                onPrevious={() => {
                                    const prevIndex = selectedIndex - 1;
                                    if (prevIndex >= 0) setSelectedWordKey(filteredWords[prevIndex].swedish_word);
                                }}
                                onNext={() => {
                                    const nextIndex = selectedIndex + 1;
                                    if (nextIndex < filteredWords.length) setSelectedWordKey(filteredWords[nextIndex].swedish_word);
                                }}
                                hasPrevious={selectedIndex > 0}
                                hasNext={selectedIndex < filteredWords.length - 1}
                                currentIndex={selectedIndex}
                                totalCount={filteredWords.length}
                                learnedCount={0}
                                isRandomMode={false}
                                onToggleRandom={() => { }}
                                showRandomButton={false}
                                hideActions={false}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
