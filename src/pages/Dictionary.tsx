import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWords, useAddWord } from "@/hooks/useWords";
import { determineUnifiedLevel } from "@/utils/levelUtils";
import { Book, Search, Filter, CheckCircle, Bookmark, Plus, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { WordCard } from "@/components/study/WordCard";
import { toast } from "sonner";
import { useApiKeys } from "@/hooks/useApiKeys";
import { generateFTWordContent as generateWordContent } from "@/services/geminiApi";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/services/db";
import { syncQueue } from "@/services/syncQueue";

const CEFR_TABS = ["All", "A1", "A2", "B1", "B2", "C1", "C2", "D1"];

export default function Dictionary() {
    const words = useWords();
    const addWord = useAddWord();
    const { apiKeys } = useApiKeys();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const isLoading = words === undefined || addWord.isPending;
    const isAdding = addWord.isPending;
    const [isGenerating, setIsGenerating] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("All");
    const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null);

    const handleAddWord = async () => {
        if (!searchTerm.trim()) return;
        const wordToAdd = searchTerm.trim().toLowerCase();

        // Prevent multiple rapid submissions
        if (isGenerating || isAdding) return;

        // 1. Check local duplicate (fast fail)
        if (words?.some(w => w.swedish_word.toLowerCase() === wordToAdd)) {
            toast.error(`"${wordToAdd}" already exists in the dictionary!`);
            setSelectedWordKey(words.find(w => w.swedish_word.toLowerCase() === wordToAdd)?.swedish_word || null);
            return;
        }

        // 2. Remote check: If exists in Supabase, load it locally and show
        try {
            const { data: remoteExisting } = await supabase
                .from('words')
                .select('*')
                .eq('swedish_word', wordToAdd)
                .limit(1)
                .maybeSingle();

            if (remoteExisting) {
                const { db } = await import('@/services/db');
                await db.words.put({
                    id: remoteExisting.id,
                    swedish_word: remoteExisting.swedish_word,
                    kelly_level: remoteExisting.kelly_level || undefined,
                    kelly_source_id: remoteExisting.kelly_source_id || undefined,
                    frequency_rank: remoteExisting.frequency_rank || undefined,
                    sidor_rank: remoteExisting.sidor_rank || undefined,
                    word_data: remoteExisting.word_data as any,
                    last_synced_at: new Date().toISOString(),
                });
                toast.success(`"${wordToAdd}" already exists. Loaded it locally.`);
                setActiveTab("All");
                setSelectedWordKey(wordToAdd);
                queryClient.invalidateQueries({ queryKey: ["words"] });
                return;
            }
        } catch (e) {
            // Ignore remote check errors and continue to generation/add
        }

        // If Gemini API is available, generate word card first
        if (apiKeys?.geminiApiKey) {
            setIsGenerating(true);
            try {
                toast.info(`Generating word card for "${wordToAdd}"...`);
                console.log('Starting Gemini API call for:', wordToAdd);
                
                // Generate word content using Gemini
                const generatedContent = await generateWordContent(wordToAdd, apiKeys.geminiApiKey);
                console.log('Gemini API response:', generatedContent);
                
                if ('error' in generatedContent) {
                    console.error('Gemini API error:', generatedContent.error);
                    throw new Error(generatedContent.error);
                }

                console.log('Creating word data...');
                // Create word data with D1 level
                const wordData = {
                    meanings: generatedContent.meanings || [],
                    examples: generatedContent.examples || [],
                    synonyms: generatedContent.synonyms || [],
                    antonyms: generatedContent.antonyms || [],
                    partOfSpeech: generatedContent.partOfSpeech,
                    gender: generatedContent.gender,
                    inflectionExplanation: generatedContent.inflectionExplanation,
                    grammaticalForms: generatedContent.grammaticalForms || [],
                    cefr_level: "D1" // Set D1 level
                };
                console.log('Word data created:', wordData);

                console.log('Starting database operations...');
                // Upsert to avoid duplicate errors
                const { data: insertedWord, error: upsertError } = await supabase
                    .from('words')
                    .upsert(
                        { swedish_word: wordToAdd, word_data: wordData },
                        { onConflict: 'swedish_word', ignoreDuplicates: true }
                    )
                    .select()
                    .maybeSingle();
                
                if (upsertError) {
                    // Graceful handling: no spam logging
                    toast.error(upsertError.message || 'Insert failed');
                    return;
                }
                
                // If upsert ignored due to duplicate, insertedWord may be null -> fetch existing
                let finalWord = insertedWord;
                if (!finalWord) {
                    const { data: existingWord } = await supabase
                        .from('words')
                        .select('*')
                        .eq('swedish_word', wordToAdd)
                        .limit(1)
                        .maybeSingle();
                    finalWord = existingWord || null;
                }
                
                const upsertedWord = finalWord;

                // Also update local database immediately
                const { db } = await import('@/services/db');
                const wordDataForDb = {
                    ...wordData,
                    word_type: 'generated',
                    populated_at: new Date().toISOString()
                };
                if (upsertedWord) {
                    await db.words.put({
                        id: upsertedWord.id,
                        swedish_word: wordToAdd,
                        word_data: wordDataForDb,
                        last_synced_at: new Date().toISOString()
                    });

                    syncQueue.add({
                        type: 'upsert_word',
                        data: {
                            id: upsertedWord.id,
                            swedish_word: wordToAdd,
                            word_data: wordData,
                            kelly_level: null,
                            frequency_rank: null,
                            sidor_rank: null,
                            sidor_source_id: null
                        }
                    });

                    // IMPORTANT: Create a progress record so the word appears in lists
                    await db.progress.put({
                        user_id: user?.id || '',
                        word_id: upsertedWord.id,
                        word_swedish: wordToAdd,
                        is_learned: 0, // Not learned by default
                        is_reserve: 0, // Not reserved by default
                        last_synced_at: new Date().toISOString()
                    });

                    syncQueue.add({
                        type: 'upsert_progress',
                        data: {
                            user_id: user?.id || '',
                            word_id: upsertedWord.id,
                            is_learned: false,
                            is_reserve: false,
                            user_meaning: null,
                            custom_spelling: null,
                            learned_date: null
                        }
                    });
                }

                toast.success(`Generated and added "${wordToAdd}" to D1 level!`);
                setActiveTab("All");
                setSelectedWordKey(wordToAdd);
                
                // Refresh the words list by invalidating queries
                queryClient.invalidateQueries({ queryKey: ["words"] });
                
                // Small delay to ensure data is updated
                setTimeout(() => {
                    setSelectedWordKey(wordToAdd);
                }, 500);
                
            } catch (error: any) {
                console.error('Word generation failed:', error);
                toast.error(error.message || `Failed to generate word card for "${wordToAdd}"`);
                
                // Fallback to basic add if generation fails
                try {
                    await addWord.mutateAsync({ swedish_word: wordToAdd });
                    
                    // IMPORTANT: Create a progress record for fallback case too
                    const { data: addedWord } = await supabase
                        .from('words')
                        .select('id')
                        .eq('swedish_word', wordToAdd)
                        .single();
                    
                    if (addedWord) {
                        await db.progress.put({
                            user_id: user?.id || '',
                            word_id: addedWord.id,
                            word_swedish: wordToAdd,
                            is_learned: 0, // Not learned by default
                            is_reserve: 0, // Not reserved by default
                            last_synced_at: new Date().toISOString()
                        });
                    }
                    
                    toast.success(`Added "${wordToAdd}" to dictionary (basic mode)`);
                    setSelectedWordKey(wordToAdd);
                } catch (fallbackError: any) {
                    toast.error(fallbackError.message || "Failed to add word");
                }
            } finally {
                setIsGenerating(false);
            }
        } else {
            // Fallback to basic add if no Gemini API
            try {
                // Try remote check first to avoid duplicate errors
                const { data: remoteExisting } = await supabase
                    .from('words')
                    .select('id')
                    .eq('swedish_word', wordToAdd)
                    .limit(1)
                    .maybeSingle();
                if (remoteExisting) {
                    const { db } = await import('@/services/db');
                    await db.words.put({
                        id: remoteExisting.id,
                        swedish_word: wordToAdd,
                        last_synced_at: new Date().toISOString()
                    } as any);
                } else {
                    await addWord.mutateAsync({ swedish_word: wordToAdd });
                }
                toast.success(`Added "${wordToAdd}" to dictionary!`);
                setSelectedWordKey(wordToAdd);
            } catch (error: any) {
                toast.error(error.message || "Failed to add word");
            }
        }
    };

    // Filter and Sort Words
    const filteredWords = useMemo(() => {
        if (!words) return [];

        // STRICT REQUIREMENT: Show only when searched
        if (!searchTerm.trim()) return [];

        let result = words
            .map(w => ({
                ...w,
                unified_level: determineUnifiedLevel(w)
            }));

        // Filter by Search (Strict Swedish Only)
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(w =>
                w.swedish_word.toLowerCase().includes(term)
            );
        }

        // Filter by Level Tab
        if (activeTab !== "All") {
            result = result.filter(w => w.unified_level === activeTab);
        }

        // Sort: Level (A1->C2->D1) then Alphabetical
        result.sort((a, b) => {
            const levelOrder: Record<string, number> = { "A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6, "D1": 7, "Unknown": 8 };
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
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Book className="h-6 w-6 text-primary" />
                            Unified Dictionary
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Dashboard for all words (A1-C2). Search to view details.
                        </p>
                    </div>
                </div>

                {/* Centered Search Bar */}
                <div className="max-w-xl mx-auto w-full relative flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Search swedish words..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 h-14 text-lg text-center shadow-sm rounded-2xl border-2 focus-visible:ring-primary/20"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchTerm.trim() && filteredWords.length === 0) {
                                    handleAddWord();
                                }
                            }}
                        />
                    </div>
                    {searchTerm.trim().length > 0 && !words?.some(w => w.swedish_word.toLowerCase() === searchTerm.toLowerCase()) && (
                        <Button
                            onClick={handleAddWord}
                            className="h-14 w-14 rounded-2xl shrink-0"
                            disabled={isAdding || isGenerating}
                            title={apiKeys?.geminiApiKey ? "Generate word card with AI" : "Add to dictionary"}
                        >
                            {isGenerating ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                             isAdding ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                             apiKeys?.geminiApiKey ? <Sparkles className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                        </Button>
                    )}
                </div>

                {/* Level Tabs */}
                <div className="flex flex-wrap gap-2 pb-2 border-b border-border overflow-x-auto justify-center">
                    {CEFR_TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${activeTab === tab
                                ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                                : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                    </div>
                ) : !searchTerm.trim() ? (
                    <div className="text-center py-20 text-muted-foreground animate-in fade-in zoom-in-95 duration-300">
                        <div className="bg-secondary/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Search className="h-10 w-10 opacity-40" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Ready to search</h3>
                        <p className="max-w-xs mx-auto text-sm opacity-80">
                            Type a word above to search across the entire dictionary.
                        </p>
                    </div>
                ) : filteredWords.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        <p className="text-lg">No words found for "{searchTerm}"</p>
                        {/* Optional: Add Word Button is already visible in search bar, maybe reiterate here? */}
                        <div className="mt-4">
                            <Button variant="outline" onClick={handleAddWord} disabled={isAdding || isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                                 isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                                 apiKeys?.geminiApiKey ? <Sparkles className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                {apiKeys?.geminiApiKey ? `Generate "${searchTerm}" with AI` : `Add "${searchTerm}" to Dictionary`}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="text-center text-sm text-muted-foreground font-medium">
                            Showing {Math.min(filteredWords.length, 50)} of {filteredWords.length} words
                        </div>

                        {/* Virtualized list replacement / Simple map for now (up to limit) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                            {filteredWords.slice(0, 50).map((word) => ( // Strict limit to 50 per user request "dont need to see this many"
                                <div
                                    key={word.id}
                                    className={`flex items-center justify-between p-5 rounded-xl border transition-all cursor-pointer group hover:scale-[1.01] hover:shadow-md ${word.progress?.is_learned ? 'bg-green-500/5 border-green-500/20' :
                                        word.progress?.is_reserve ? 'bg-amber-500/5 border-amber-500/20' :
                                            'bg-card border-border'
                                        }`}
                                    onClick={() => setSelectedWordKey(word.swedish_word)}
                                >
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-lg font-bold tracking-tight">{word.swedish_word}</span>
                                            {word.progress?.is_learned && <CheckCircle className="h-4 w-4 text-green-500" />}
                                            {word.progress?.is_reserve && <Bookmark className="h-4 w-4 text-amber-500 fill-amber-500" />}
                                            {word.unified_level === 'D1' && <Sparkles className="h-4 w-4 text-purple-500" />}
                                        </div>
                                        <div className="text-sm text-muted-foreground line-clamp-1">
                                            {word.word_data?.meanings?.map((m: any) => m.english).join(", ") || "No translation"}
                                        </div>
                                    </div>
                                    {word.unified_level && word.unified_level !== 'Unknown' && (
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${word.unified_level.startsWith('A') ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                            word.unified_level.startsWith('B') ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                            word.unified_level.startsWith('C') ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                                            word.unified_level === 'D1' ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 border-purple-500/20' :
                                            'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                            }`}>
                                            {word.unified_level}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                        {filteredWords.length > 50 && (
                            <div className="text-center p-4 text-sm text-muted-foreground">
                                And {filteredWords.length - 50} more...
                            </div>
                        )}
                    </div>
                )}

            </div>

            <Dialog open={!!selectedWord} onOpenChange={(open) => !open && setSelectedWordKey(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogTitle className="sr-only">Word Details</DialogTitle>
                    <DialogDescription className="sr-only">
                        View and edit details for the selected word.
                    </DialogDescription>
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
