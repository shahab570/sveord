import { useState } from "react";
import { generateFTWordContent } from "@/services/geminiApi";
import { db } from "@/services/db";
import { supabase } from "@/integrations/supabase/client";
import { useApiKeys } from "@/hooks/useApiKeys";
import { toast } from "sonner";
import { WordWithProgress } from "./useWords";
import { useQueryClient } from "@tanstack/react-query";

export function useCaptureWord() {
    const { apiKeys } = useApiKeys();
    const [isCapturing, setIsCapturing] = useState(false);
    const queryClient = useQueryClient();

    const captureWord = async (swedishWord: string): Promise<WordWithProgress | null> => {
        if (!swedishWord.trim()) return null;

        const cleanedWord = swedishWord.trim().toLowerCase();

        // 1. Double check if original word exists
        const existingOriginal = await db.words.get(cleanedWord);
        if (existingOriginal && existingOriginal.word_data?.populated_at) {
            return {
                ...existingOriginal,
                id: existingOriginal.id || 0,
                kelly_level: existingOriginal.kelly_level || null,
                kelly_source_id: existingOriginal.kelly_source_id || null,
                frequency_rank: existingOriginal.frequency_rank || null,
                sidor_rank: existingOriginal.sidor_rank || null,
                sidor_source_id: null,
                created_at: "",
                word_data: existingOriginal.word_data as any,
                progress: undefined
            } as WordWithProgress;
        }

        if (!apiKeys.geminiApiKey) {
            toast.error("Please add a Gemini API Key in Settings to capture words.");
            return null;
        }

        setIsCapturing(true);
        try {
            // 2. Generate content and detect base form
            const result = await generateFTWordContent(cleanedWord, apiKeys.geminiApiKey);

            if ('error' in result) {
                toast.error(`Generation failed: ${result.error}`);
                return null;
            }

            const baseForm = (result.baseForm || cleanedWord).trim().toLowerCase();

            // 3. Check if base form already exists in DB (maybe it's in Kelly/Frequency/Sidor!)
            const existingBase = await db.words.get(baseForm);
            if (existingBase) {
                console.log(`Base form "${baseForm}" already exists for "${cleanedWord}". Redirecting...`);
                return {
                    ...existingBase,
                    id: existingBase.id || 0,
                    kelly_level: existingBase.kelly_level || null,
                    kelly_source_id: existingBase.kelly_source_id || null,
                    frequency_rank: existingBase.frequency_rank || null,
                    sidor_rank: existingBase.sidor_rank || null,
                    sidor_source_id: null,
                    created_at: "",
                    word_data: existingBase.word_data as any,
                    progress: undefined
                } as WordWithProgress;
            }

            // 4. If not exists, save the base form as a new FT word
            console.log(`Adding new base form "${baseForm}" to FT List for "${cleanedWord}".`);
            const wordData = {
                word_type: result.partOfSpeech || 'noun',
                gender: result.gender,
                meanings: result.meanings || [],
                examples: result.examples || [],
                synonyms: result.synonyms || [],
                antonyms: result.antonyms || [],
                inflectionExplanation: result.inflectionExplanation,
                populated_at: new Date().toISOString(),
                is_ft: true // Save to cloud JSON
            };

            // 5. Persist to Supabase first to get a real ID (Cloud Persistence)
            let cloudId: number | undefined;
            try {
                const { data: remoteWord, error: remoteError } = await supabase
                    .from('words')
                    .insert({
                        swedish_word: baseForm,
                        word_data: wordData as any,
                    })
                    .select('id')
                    .single();

                if (!remoteError && remoteWord) {
                    cloudId = remoteWord.id;
                    console.log(`Saved "${baseForm}" to cloud with ID: ${cloudId}`);
                } else if (remoteError?.code === '23505') {
                    // Unique constraint violation - word might have just been added by someone else or another tab
                    const { data: existingRemote } = await supabase
                        .from('words')
                        .select('id')
                        .eq('swedish_word', baseForm)
                        .single();
                    cloudId = existingRemote?.id;
                }
            } catch (err) {
                console.error("Cloud persistence failed, falling back to local only:", err);
            }

            const wordToSave = {
                id: cloudId, // Might be undefined if cloud insert failed
                swedish_word: baseForm, // Use base form as primary entry
                word_data: wordData as any,
                is_ft: 1,
                last_synced_at: new Date().toISOString()
            };

            await db.words.put(wordToSave);

            // Invalidate queries to ensure UI updates
            queryClient.invalidateQueries({ queryKey: ["words"] });
            queryClient.invalidateQueries({ queryKey: ["stats"] });
            queryClient.invalidateQueries({ queryKey: ["levelStats"] });

            return {
                ...wordToSave,
                id: 0,
                kelly_level: null,
                kelly_source_id: null,
                frequency_rank: null,
                sidor_rank: null,
                sidor_source_id: null,
                created_at: new Date().toISOString(),
                progress: undefined
            } as WordWithProgress;
        } catch (error) {
            console.error("Capture failed:", error);
            toast.error("An unexpected error occurred during capture.");
            return null;
        } finally {
            setIsCapturing(false);
        }
    };

    return { captureWord, isCapturing };
}
