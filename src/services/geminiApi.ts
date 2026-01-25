// Gemini API service for generating Swedish word meanings
let ACTIVE_MODEL = 'gemini-1.5-flash';
let ACTIVE_VERSION = 'v1beta';

const getApiUrl = (version: string, model: string) =>
    `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;

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
    modelOverride?: string,
    versionOverride?: string
): Promise<WordMeaningResult | GeminiError> {
    const model = modelOverride || ACTIVE_MODEL;
    const version = versionOverride || ACTIVE_VERSION;

    try {
        const prompt = `You are a Swedish-English language expert. Provide a detailed explanation of the Swedish word "${swedishWord}" in English.

Format your response as JSON with this exact structure:
{
  "meanings": [{"english": "definition", "context": "context"}],
  "examples": [{"swedish": "sentence", "english": "translation"}],
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
            results.set(word, {
                meanings: [{ english: 'Generation failed' }],
                examples: [], synonyms: [], antonyms: [],
            });
        }

        completed++;
        // Keep rate limiting for batch processing
        if (completed < words.length) await new Promise(r => setTimeout(r, 4000));
    }
    return results;
}

/**
 * List available models for the API key
 */
async function listModels(apiKey: string): Promise<string[]> {
    try {
        console.log('Fetching model list...');
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            console.error(`Failed to fetch model list: HTTP ${response.status} ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        const models = (data.models || []).map((m: any) => m.name.replace('models/', ''));
        console.log('Successfully fetched models:', models);
        return models;
    } catch (e: any) {
        console.error('Error listing models:', e.message);
        return [];
    }
}

/**
 * Validate Gemini API key by probing multiple models and versions
 */
export async function validateGeminiApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
    console.log('validateGeminiApiKey starting probe...');

    // 1. Try to list models to see exactly what this key can do
    const availableModels = await listModels(apiKey);
    console.log('Available models from API list:', availableModels);

    // 2. Build the list of models to probe (prioritize discovered ones)
    const modelsToTry = [...new Set([
        ...availableModels,
        'gemini-1.5-flash',
        'gemini-3-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-pro',
    ])].filter(m => !m.includes('vision') && !m.includes('embedding') && m !== '');

    if (modelsToTry.length === 0) {
        return { success: false, error: 'No models found to test. Check if Gemini API is enabled.' };
    }

    const versions = ['v1beta', 'v1'];
    let lastError = 'All probes failed.';

    for (const model of modelsToTry) {
        for (const version of versions) {
            console.log(`Probing: ${model} (${version})...`);
            // No wait time during validation probe to make it fast
            const result = await generateWordMeaning('test', apiKey, model, version);

            if ('meanings' in result) {
                console.log(`✅ Success! Using ${model} on ${version}`);
                ACTIVE_MODEL = model;
                ACTIVE_VERSION = version;
                return { success: true };
            }

            lastError = `Model ${model} (${version}): ${result.details || result.error}`;
            console.log(`❌ Probe failed:`, lastError);
        }
    }

    return { success: false, error: lastError };
}
