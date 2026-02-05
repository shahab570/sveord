import { CEFR_LEVELS } from "@/hooks/useWords";

export function determineUnifiedLevel(word: {
    word_data?: any;
}) {
    // 1. Check if word_data has CEFR level (AI generated or manually set)
    if (word.word_data?.cefr_level && CEFR_LEVELS.includes(word.word_data.cefr_level as any)) {
        return word.word_data.cefr_level;
    }

    // Default fallback
    return "Unknown";
}
