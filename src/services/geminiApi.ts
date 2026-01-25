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
