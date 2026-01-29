
// DeepSeek API Service
// Documentation: https://platform.deepseek.com/api-docs/

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

export interface DeepSeekError {
    error: string;
    details?: string;
}

/**
 * Enhance text using DeepSeek
 */
export async function enhanceTextDeepSeek(
    text: string,
    apiKey: string
): Promise<{ text: string } | DeepSeekError> {
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are a professional text organizer.
                        
                        **GOAL:** Format the user's notes with EXTREME spacing and clarity.
                        
                        **THE GOLDEN RULE:**
                        You must treat every logical step as a separate "chunk". Between every chunk, you must output TWO NEWLINES (\\n\\n) to create a visible empty gap.
                        
                        **Example Layout:**
                        [Chunk 1: Word Breakdown]
                        (Empty Line Here)
                        [Chunk 2: Grammar/Suffix Explanation]
                        (Empty Line Here)
                        [Chunk 3: The Meaning/Connection]
                        
                        **Strict Rules:**
                        1. **NO HEADERS** (No "###").
                        2. **NO SYMBOLS** (No bullets, arrows, etc).
                        3. **LANGUAGE:** Keep it in the user's language (English).
                        4. **FORMATTING:** Use **Bold** for Swedish words, *Italics* for meanings.
                        
                        Make it look distinct and airy, exactly like the user's "spaced out" example.
                        
                        Return ONLY the markdown.`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { error: `HTTP ${response.status}`, details: err.error?.message || response.statusText };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) return { error: "Empty response" };

        return { text: content.trim() };

    } catch (e: any) {
        return { error: "Network error", details: e.message };
    }
}
