import { useState } from "react";
import { usePopulation } from "@/contexts/PopulationContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Wand2,
    RefreshCw,
    AlertCircle,
    BookOpen,
    Info,
    Pause,
    Play,
    Languages,
    Trash2
} from "lucide-react";

export function PopulateMeaningsSection() {
    const { status, startPopulation, isPopulating, error, processedCount, sessionTotal, pausePopulation, resumePopulation, isPaused, lastBatchInfo, resetGrammar } = usePopulation();
    const [overwrite, setOverwrite] = useState(false);

    if (!status || status.total === 0) return null;

    return (
        <section className="word-card space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <BookOpen className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Base Word Generation
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Generate origins and base forms for inflected words
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={() => startPopulation('missing_grammar')}
                        disabled={isPopulating}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                    >
                        {isPopulating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                        Fill Grammar
                    </Button>
                    <Button
                        onClick={resetGrammar}
                        disabled={isPopulating}
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive hover:text-red-700 font-bold"
                    >
                        <Trash2 className="h-3 w-3" />
                        Reset Progress
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Grammar Forms Coverage</span>
                            <span className="text-xs font-bold text-blue-600">
                                {Math.round((status.grammarCount / status.total) * 100)}%
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">
                            {status.grammarCount} <span className="text-sm font-normal text-blue-400">/ {status.total}</span>
                        </p>
                        <p className="text-xs text-blue-600/80 mt-1">Total words with AI-verified forms</p>
                    </div>
                </div>

                {isPopulating && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between text-xs font-medium">
                            <span className="text-primary tracking-tight">System is generating base-word stories...</span>
                            <div className="flex items-center gap-4">
                                <span className="text-muted-foreground font-mono">
                                    {Math.round((processedCount / sessionTotal) * 100)}%
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={isPaused ? resumePopulation : pausePopulation}
                                    className="h-6 px-2 text-[10px] gap-1"
                                >
                                    {isPaused ? (
                                        <>
                                            <Play className="h-3 w-3" /> Resume
                                        </>
                                    ) : (
                                        <>
                                            <Pause className="h-3 w-3" /> Pause
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                        <Progress value={(processedCount / sessionTotal) * 100} className="h-1.5" />
                        <div className="flex flex-col items-center gap-1 pt-1">
                            {lastBatchInfo && (
                                <p className="text-[10px] text-primary font-medium animate-pulse">
                                    {lastBatchInfo}
                                </p>
                            )}
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                                {isPaused ? "Generation Paused" : "Optimized for speed • Batch size 100"}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <Info className="h-5 w-5 text-blue-600 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-blue-900">What is this?</p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                            This tool uses AI to detect if a word is an inflected form (like <b>flickan</b>) and generates a short 2-sentence explanation of its base form (<b>flicka</b>) and meaning.
                        </p>
                    </div>
                </div>



                {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-xs font-medium">{error}</p>
                    </div>
                )}
            </div>
        </section>
    );
}
