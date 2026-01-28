
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
                        content: "You are a professional editor. Rewrite the user's notes to be well-structured, fix grammar, and use nice formatting (bullet points, bold key terms). Keep the tone personal but clear. Return ONLY markdown."
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
            const err = await response.json();
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
