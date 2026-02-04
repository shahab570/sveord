import { CEFR_LEVELS, FREQUENCY_LEVELS, SIDOR_LEVELS } from "@/hooks/useWords";

export function determineUnifiedLevel(word: {
    kelly_level?: string | null;
    frequency_rank?: number | null;
    sidor_rank?: number | null;
}) {
    // 1. Priority: Kelly Level (Explicit CEFR)
    if (word.kelly_level && CEFR_LEVELS.includes(word.kelly_level as any)) {
        return word.kelly_level;
    }

    // 2. Frequency Rank Mapping
    if (word.frequency_rank) {
        for (const level of FREQUENCY_LEVELS) {
            if (word.frequency_rank >= level.range[0] && word.frequency_rank <= level.range[1]) {
                return level.label;
            }
        }
    }

    // 3. Sidor Rank Mapping
    if (word.sidor_rank) {
        for (const level of SIDOR_LEVELS) {
            if (word.sidor_rank >= level.range[0] && word.sidor_rank <= level.range[1]) {
                return level.label;
            }
        }
    }

    return "Unknown";
}
