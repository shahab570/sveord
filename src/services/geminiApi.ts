// Gemini API service for generating Swedish word meanings
let ACTIVE_MODEL = 'gemini-1.5-flash';
const API_VERSION = 'v1beta';

const getApiUrl = (model: string) => `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent`;

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
    apiKey: string,
    modelOverride?: string
): Promise<WordMeaningResult | GeminiError> {
    const model = modelOverride || ACTIVE_MODEL;
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

        const response = await fetch(`${getApiUrl(model)}?key=${apiKey}`, {
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
            return { error: `Request failed (${response.status})`, details: errorData.error?.message || response.statusText };
        }

        const data = await response.json();

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return { error: 'Invalid response from Gemini API' };
        }

        const responseText = data.candidates[0].content.parts[0].text;
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) jsonMatch = [jsonMatch[1]];
        }

        if (!jsonMatch) return { error: 'Could not parse response' };

        const result = JSON.parse(jsonMatch[0]);
        return {
            meanings: result.meanings || [],
            examples: result.examples || [],
            synonyms: result.synonyms || [],
            antonyms: result.antonyms || [],
        };
    } catch (error: any) {
        return { error: 'Connection error', details: error.message };
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
        if (onProgress) onProgress(completed, words.length, word);

        const result = await generateWordMeaning(word, apiKey);

        if ('meanings' in result) {
            results.set(word, result);
        } else {
            results.set(word, {
                meanings: [{ english: 'Failed to generate meaning' }],
                examples: [],
                synonyms: [],
                antonyms: [],
            });
        }

        completed++;
        if (completed < words.length) {
            await new Promise(resolve => setTimeout(resolve, 4000));
        }
    }

    return results;
}

/**
 * Validate Gemini API key by probing multiple models
 */
export async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
    // List of models to try in order of preference
    const modelsToTry = [
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp',
        'gemini-3-flash',
        'gemini-pro',
        'gemini-flash'
    ];

    for (const model of modelsToTry) {
        console.log(`Checking model: ${model}...`);
        const result = await generateWordMeaning('test', apiKey, model);

        if ('meanings' in result) {
            console.log(`✅ Success with model: ${model}`);
            ACTIVE_MODEL = model; // Set it globally for subsequent calls
            return true;
        }

        console.log(`❌ Model ${model} returned error:`, result.details);
    }

    console.error('All models failed validation.');
    return false;
}

