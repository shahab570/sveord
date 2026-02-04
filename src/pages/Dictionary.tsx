import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWords } from "@/hooks/useWords";
import { determineUnifiedLevel } from "@/utils/levelUtils";
import { Book, Search, Filter, CheckCircle, Bookmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button"; // Assuming you have this
import { Badge } from "@/components/ui/badge"; // Assuming you have this
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WordCard } from "@/components/study/WordCard";

const CEFR_TABS = ["All", "A1", "A2", "B1", "B2", "C1", "C2", "Unknown"];

export default function Dictionary() {
    const words = useWords();
    const isLoading = words === undefined;
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("All");
    const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null);

    // Filter and Sort Words
    const filteredWords = useMemo(() => {
        if (!words) return [];

        let result = words.map(w => ({
            ...w,
            unified_level: determineUnifiedLevel(w)
        }));

        // Filter by Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(w =>
                w.swedish_word.toLowerCase().includes(term) ||
                w.word_data?.meanings?.some((m: any) => m.english.toLowerCase().includes(term))
            );
        }

        // Filter by Level Tab
        if (activeTab !== "All") {
            result = result.filter(w => w.unified_level === activeTab);
        }

        // Sort: Level (A1->C2) then Alphabetical
        result.sort((a, b) => {
            const levelOrder: Record<string, number> = { "A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6, "Unknown": 7 };
            const la = levelOrder[a.unified_level] || 99;
            const lb = levelOrder[b.unified_level] || 99;

            if (la !== lb) return la - lb;
            return a.swedish_word.localeCompare(b.swedish_word);
        });

        return result;
    }, [words, searchTerm, activeTab]);

    const selectedWord = filteredWords.find(w => w.swedish_word === selectedWordKey);
    const selectedIndex = filteredWords.findIndex(w => w.swedish_word === selectedWordKey);

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Book className="h-6 w-6 text-primary" />
                            Unified Dictionary
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            All words consolidated into a single list, sorted by difficulty (A1-C2).
                        </p>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search words..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Level Tabs */}
                <div className="flex flex-wrap gap-2 pb-2 border-b border-border overflow-x-auto">
                    {CEFR_TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${activeTab === tab
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-xs text-muted-foreground font-medium">
                            Showing {filteredWords.length} words
                        </div>

                        {/* Virtualized list replacement / Simple map for now (up to limit) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredWords.slice(0, 100).map((word) => ( // Pagination limit for performance safeguard
                                <div
                                    key={word.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group ${word.progress?.is_learned ? 'bg-green-500/5 border-green-500/20' :
                                            word.progress?.is_reserve ? 'bg-amber-500/5 border-amber-500/20' :
                                                'bg-card border-border hover:shadow-sm'
                                        }`}
                                    onClick={() => setSelectedWordKey(word.swedish_word)}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{word.swedish_word}</span>
                                            {word.progress?.is_learned && <CheckCircle className="h-3 w-3 text-green-500" />}
                                            {word.progress?.is_reserve && <Bookmark className="h-3 w-3 text-amber-500 fill-amber-500" />}
                                        </div>
                                        <div className="text-xs text-muted-foreground line-clamp-1">
                                            {word.word_data?.meanings?.map((m: any) => m.english).join(", ") || "No translation"}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${word.unified_level.startsWith('A') ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                        word.unified_level.startsWith('B') ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                            word.unified_level.startsWith('C') ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                                                'bg-gray-100 text-gray-500'
                                        }`}>
                                        {word.unified_level}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {filteredWords.length > 100 && (
                            <div className="text-center p-4 text-sm text-muted-foreground">
                                And {filteredWords.length - 100} more... (Use search to find specific words)
                            </div>
                        )}
                    </div>
                )}

            </div>

            <Dialog open={!!selectedWord} onOpenChange={(open) => !open && setSelectedWordKey(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogTitle className="sr-only">Word Details</DialogTitle>
                    {selectedWord && (
                        <WordCard
                            word={selectedWord}
                            // Simple nav for now, or connect to filtered list indices
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
                            learnedCount={0} // Not contextually relevant here
                            isRandomMode={false}
                            onToggleRandom={() => { }}
                            showRandomButton={false}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
