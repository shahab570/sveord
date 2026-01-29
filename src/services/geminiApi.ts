// Gemini API service for generating Swedish word meanings
let ACTIVE_MODEL = 'gemini-1.5-flash';
let ACTIVE_VERSION = 'v1beta';

const getApiUrl = (version: string, model: string) =>
    `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;

/**
 * Configure the active model and version (used to persist selection)
 */
export function setActiveConfig(model: string, version: string) {
    ACTIVE_MODEL = model;
    ACTIVE_VERSION = version;
    console.log(`Gemini API configured: ${model} (${version})`);
}

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
    partOfSpeech?: string;
    gender?: string;
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
    modelOverride?: string,
    versionOverride?: string
): Promise<WordMeaningResult | GeminiError> {
    const model = modelOverride || ACTIVE_MODEL;
    const version = versionOverride || ACTIVE_VERSION;

    try {
        const prompt = `You are a Swedish-English language expert. Provide a detailed explanation of the Swedish word "${swedishWord}" in English.

For each word:
1. Identify the part of speech (noun, verb, adjective, etc.).
2. If it is a noun, specify if it is an "en" word or "ett" word.
3. Provide exactly 3 clear English meanings (definitions) if possible.
4. List relevant synonyms.
5. List relevant antonyms.
6. Provide exactly 2 usage examples (Swedish sentences with English translations).

Format your response as JSON with this exact structure:
{
  "partOfSpeech": "noun/verb/etc",
  "gender": "en/ett/null",
  "meanings": [{"english": "meaning 1", "context": ""}, {"english": "meaning 2", "context": ""}, {"english": "meaning 3", "context": ""}],
  "examples": [{"swedish": "sentence 1", "english": "translation 1"}, {"swedish": "sentence 2", "english": "translation 2"}],
  "synonyms": ["synonym"],
  "antonyms": ["antonym"]
}

Only return the JSON.`;

        const response = await fetch(`${getApiUrl(version, model)}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return { error: `HTTP ${response.status}`, details: errorData.error?.message || response.statusText };
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) return { error: 'Empty response body' };

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { error: 'JSON content not found' };

        const result = JSON.parse(jsonMatch[0]);
        return {
            meanings: result.meanings || [],
            examples: result.examples || [],
            synonyms: result.synonyms || [],
            antonyms: result.antonyms || [],
            partOfSpeech: result.partOfSpeech,
            gender: result.gender,
        };
    } catch (error: any) {
        return { error: 'Network connection error', details: error.message };
    }
}

/**
 * Generate detailed meanings for a BATCH of words in one request.
 * This is significantly faster than one-by-one.
 */
export async function generateMeaningsTrueBatch(
    words: string[],
    apiKey: string,
    modelOverride?: string,
    versionOverride?: string
): Promise<Map<string, WordMeaningResult>> {
    const model = modelOverride || ACTIVE_MODEL;
    const version = versionOverride || ACTIVE_VERSION;
    const results = new Map<string, WordMeaningResult>();

    if (words.length === 0) return results;

    try {
        const prompt = `You are a Swedish dictionary generator. 
Task: Analyze these words: ${JSON.stringify(words)}.
Output: A JSON Array with one object per word.
Fields:
- word: string (The Swedish word)
- partOfSpeech: string (noun, verb, etc)
- gender: string (en/ett/null)
- meanings: Array of { english: "concise definition" } (List ALL common meanings, no limit. Be comprehensive but concise.)
- synonyms: String[] (Max 3)
- antonyms: String[] (Max 3)
- examples: [] (Keep empty to save space)

JSON ONLY.`;

        const response = await fetch(`${getApiUrl(version, model)}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    responseMimeType: "application/json" // Force JSON mode if supported by model, otherwise prompt handles it
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) throw new Error('Empty response from AI');

        // Parse the JSON array
        let parsedData: any[] = [];
        try {
            // Try explicit parse first
            parsedData = JSON.parse(responseText);
        } catch (e) {
            // Fallback: Try to find array bracket in text
            const match = responseText.match(/\[[\s\S]*\]/);
            if (match) {
                parsedData = JSON.parse(match[0]);
            } else {
                throw new Error('Could not parse JSON array from response');
            }
        }

        if (!Array.isArray(parsedData)) {
            throw new Error('Response was not a JSON array');
        }

        // Map results back to the original words
        // We iterate through the returned data and try to match it to the requested words
        parsedData.forEach((item: any) => {
            if (item && item.word) {
                // Normalize for matching
                const key = words.find(w => w.toLowerCase() === item.word.toLowerCase()) || item.word;

                results.set(key, {
                    meanings: item.meanings || [],
                    examples: item.examples || [],
                    synonyms: item.synonyms || [],
                    antonyms: item.antonyms || [],
                    partOfSpeech: item.partOfSpeech,
                    gender: item.gender
                });
            }
        });

    } catch (error: any) {
        console.error("Batch generation failed:", error);
        // We return whatever we managed to get (which might be empty map), 
        // effectively failing the whole batch gracefully so re-tries can happen later 
        // or we can fallback to single mode if we wanted to (but simplest is just fail this batch).
    }

    return results;
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
            console.error(`Failed to generate meaning for "${word}":`, result.error, result.details);
            results.set(word, {
                meanings: [{ english: `Generation failed: ${result.error}` }],
                examples: [], synonyms: [], antonyms: [],
            });
        }

        completed++;
        // Rate limiting removed for paid tier.
        // We still add a tiny 200ms delay to prevent browser fetch congestion and 429 errors.
        if (completed < words.length) await new Promise(r => setTimeout(r, 200));
    }
    return results;
}

/**
 * List available models for the API key
 */
async function listModels(apiKey: string): Promise<string[]> {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.models || []).map((m: any) => m.name.replace('models/', ''));
    } catch (e) {
        return [];
    }
}

/**
 * Validate Gemini API key by probing multiple models and versions
 */
export async function validateGeminiApiKey(apiKey: string): Promise<{ success: boolean; error?: string; model?: string; version?: string }> {
    console.log('validateGeminiApiKey starting probe...');

    const availableModels = await listModels(apiKey);
    console.log('Available models from API list:', availableModels);

    // Prioritize the models we saw in your screenshot!
    const modelsToTry = [...new Set([
        ...availableModels.filter(m => m.includes('flash') || m.includes('pro')),
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-2.5-flash',
        'gemini-flash-latest',
        'gemini-pro-latest'
    ])].filter(m => !m.includes('vision') && !m.includes('embedding') && m !== '');

    const versions = ['v1beta', 'v1'];
    let lastError = 'No models found to test.';

    for (const model of modelsToTry) {
        for (const version of versions) {
            console.log(`Probing: ${model} (${version})...`);
            const result = await generateWordMeaning('test', apiKey, model, version);

            if ('meanings' in result) {
                console.log(`✅ Success! Using ${model} on ${version}`);
                ACTIVE_MODEL = model;
                ACTIVE_VERSION = version;
                return { success: true, model, version };
            }

            lastError = `Model ${model} (${version}): ${result.details || result.error}`;
            console.log(`❌ Probe failed:`, lastError);
        }
    }

    return { success: false, error: lastError };
}

/**
 * Enhance and format user notes using Gemini
 */
export async function enhanceText(
    text: string,
    apiKey: string,
    modelOverride?: string,
    versionOverride?: string
): Promise<{ text: string } | GeminiError> {
    const model = modelOverride || 'gemini-1.5-flash'; // Default to fast model
    const version = versionOverride || ACTIVE_VERSION;

    try {
        const prompt = `You are a professional editor. Rewrite the following personal learning notes to be well-structured, fix grammar, and use nice formatting (bullet points, bold key terms). 
        
        Rules:
        1. Keep the tone personal but clear. 
        2. Fix any spelling or grammar mistakes.
        3. Use formatting: **Bold** for key terms, *Italics* for emphasis, and - Bullet points for lists.
        4. Do NOT add any conversational filler like "Here is your text". Just return the formatted text.
        5. Return ONLY markdown.

        Original Text:
        "${text}"`;

        const response = await fetch(`${getApiUrl(version, model)}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return { error: `HTTP ${response.status}`, details: errorData.error?.message || response.statusText };
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) return { error: 'Empty response' };

        return { text: responseText.trim() };

    } catch (error: any) {
        return { error: 'Network connection error', details: error.message };
    }
}
