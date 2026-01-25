// Gemini API service for generating Swedish word meanings
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';

export interface WordMeaningResult {
    meanings: Array<{
        english: string;
        context?: string;
    }>;
    examples?: Array<{
        swedish: string;
        english: string;
    }>;
    synonyms?: string[];
    antonyms?: string[];
}

export interface GeminiError {
    error: string;
    details?: string;
}

/**
 * Generate detailed meaning for a Swedish word using Gemini API
 */
export async function generateWordMeaning(
    swedishWord: string,
    apiKey: string
): Promise<WordMeaningResult | GeminiError> {
    try {
        const prompt = `You are a Swedish-English language expert. Provide a detailed explanation of the Swedish word "${swedishWord}" in English.

Please provide:
1. 2-3 different meanings/definitions (if the word has multiple meanings)
2. 1-2 example sentences in Swedish with English translations
3. 2-3 synonyms (Swedish words with similar meaning)
4. 1-2 antonyms (if applicable)

Format your response as JSON with this exact structure:
{
  "meanings": [
    {"english": "definition 1", "context": "when used in this context"},
    {"english": "definition 2", "context": "when used in this context"}
  ],
  "examples": [
    {"swedish": "example sentence in Swedish", "english": "English translation"}
  ],
  "synonyms": ["synonym1", "synonym2"],
  "antonyms": ["antonym1"]
}

Only return the JSON, no additional text.`;

        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 400) {
                return { error: 'Invalid API key or request', details: errorData.error?.message };
            }
            if (response.status === 403) {
                return { error: 'API key not authorized or Gemini API not enabled', details: errorData.error?.message };
            }
            if (response.status === 429) {
                return { error: 'Rate limit exceeded. Please wait a moment and try again.', details: errorData.error?.message };
            }

            return { error: `Request failed: ${response.statusText}`, details: errorData.error?.message };
        }

        const data = await response.json();

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return { error: 'Invalid response from Gemini API' };
        }

        // Extract JSON from response
        const responseText = data.candidates[0].content.parts[0].text;

        // Try to parse JSON from the response
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            // If no JSON found, try to extract it from markdown code blocks
            jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                jsonMatch = [jsonMatch[1]];
            }
        }

        if (!jsonMatch) {
            return { error: 'Could not parse response from Gemini' };
        }

        const result = JSON.parse(jsonMatch[0]);

        // Validate the structure
        if (!result.meanings || !Array.isArray(result.meanings)) {
            return { error: 'Invalid response structure from Gemini' };
        }

        return {
            meanings: result.meanings || [],
            examples: result.examples || [],
            synonyms: result.synonyms || [],
            antonyms: result.antonyms || [],
        };
    } catch (error: any) {
        console.error('Gemini API error:', error);
        return { error: 'Network error or invalid API key', details: error.message };
    }
}

/**
 * Generate meanings for multiple words in batch
 */
export async function generateMeaningsBatch(
    words: string[],
    apiKey: string,
    onProgress?: (completed: number, total: number, currentWord: string) => void
): Promise<Map<string, WordMeaningResult>> {
    const results = new Map<string, WordMeaningResult>();
    let completed = 0;

    for (const word of words) {
        if (onProgress) {
            onProgress(completed, words.length, word);
        }

        const result = await generateWordMeaning(word, apiKey);

        if ('meanings' in result) {
            results.set(word, result);
        } else {
            console.error(`Failed to generate meaning for "${word}":`, result.error);
            // Store empty result for failed words
            results.set(word, {
                meanings: [{ english: 'Failed to generate meaning' }],
                examples: [],
                synonyms: [],
                antonyms: [],
            });
        }

        completed++;

        // Rate limiting: Wait 4 seconds between requests
        // Gemini free tier: 15 requests per minute = 1 request per 4 seconds
        if (completed < words.length) {
            await new Promise(resolve => setTimeout(resolve, 4000));
        }
    }

    return results;
}

/**
 * Validate Gemini API key
 */
export async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
    console.log('validateGeminiApiKey called with key:', apiKey.substring(0, 10) + '...');
    const result = await generateWordMeaning('test', apiKey);
    console.log('generateWordMeaning result:', result);

    if ('error' in result) {
        console.error('Validation error:', result.error, result.details);
        return false;
    }

    return true;
}
