import { CEFR_LEVELS } from "@/hooks/useWords";

export function determineUnifiedLevel(word: {
    word_data?: any;
    kelly_level?: string | null;
}) {
    if (word.word_data?.cefr_level && CEFR_LEVELS.includes(word.word_data.cefr_level as any)) {
        return word.word_data.cefr_level;
    }
    if (word.kelly_level && CEFR_LEVELS.includes(word.kelly_level as any)) {
        return word.kelly_level;
    }
    return "Unknown";
}
