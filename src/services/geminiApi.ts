// Gemini API service for generating Swedish word meanings
let ACTIVE_MODEL = 'gemini-1.5-flash';
let ACTIVE_VERSION = 'v1beta';

const getApiUrl = (version: string, model: string) =>
    `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;

/**
 * Helper to parse JSON from Gemini response, handling potential backticks or trailing text
 */
function parseGeminiResponse(responseText: string | undefined): any {
    if (!responseText) throw new Error('Empty response body');

    // Clean up potential markdown blocks or trailing text
    const cleanText = responseText.trim()
        .replace(/^```json\s+/, '')
        .replace(/^```\s+/, '')
        .replace(/\s+```$/, '');

    try {
        // Try direct parse first
        return JSON.parse(cleanText);
    } catch (e) {
        // If that fails, try extraction via regex as a fallback
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/) || cleanText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (innerE) {
                console.error("Failed to parse matched JSON segment:", jsonMatch[0]);
                throw innerE;
            }
        }
        throw e;
    }
}

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
    inflectionExplanation?: string;
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
    versionOverride?: string,
    customInstruction?: string
): Promise<WordMeaningResult | GeminiError> {
    const model = modelOverride || ACTIVE_MODEL;
    const version = versionOverride || ACTIVE_VERSION;

    try {
        const prompt = `You are a Swedish-English language expert. Provide a detailed explanation of the Swedish word "${swedishWord}" in English.

${customInstruction ? `CRITICAL: The user has provided a custom instruction that OVERRIDES all standard rules: "${customInstruction}". Prioritize fulfilling this instruction perfectly within the JSON structure.` : ""}

For each word:
1. inflectionExplanation: (CRITICAL) Provide a 1-2 sentence "Base Word Story" in English. If the word is NOT in its base/dictionary form (e.g., conjugated verb, plural noun), clearly state the base form and its primary meaning. If it IS already in its base form, provide a short note about its common word family or a practical usage tip. Examples: "**Present participle of vaka (to watch).**" or "**Base form; related to 'vaken' (awake).**" Avoid etymological history like "Old Norse" or "Proto-Germanic". Focus on how the word relates to its base form or other common Swedish words.
2. Identify the part of speech (noun, verb, adjective, etc.).
3. If it is a noun, specify if it is an "en" word or "ett" word.
4. Provide English meanings (definitions). Each meaning should be a brief descriptive phrase or short sentence explaining the sense, not just a single-word synonym.
5. List relevant synonyms.
6. List relevant antonyms.
7. Provide usage examples (Swedish sentences with English translations).

Format your response as JSON with this exact structure:
{
  "partOfSpeech": "noun/verb/etc",
  "gender": "en/ett/null",
  "inflectionExplanation": "explanation or null",
  "meanings": [{"english": "meaning 1", "context": ""}],
  "examples": [{"swedish": "sentence 1", "english": "translation 1"}],
  "synonyms": ["synonym"],
  "antonyms": ["antonym"]
}

Only return the JSON.`;

        const response = await fetch(`${getApiUrl(version, model)}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    responseMimeType: "application/json"
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return { error: `HTTP ${response.status}`, details: errorData.error?.message || response.statusText };
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        const result = parseGeminiResponse(responseText);

        return {
            meanings: result.meanings || [],
            examples: result.examples || [],
            synonyms: result.synonyms || [],
            antonyms: result.antonyms || [],
            partOfSpeech: result.partOfSpeech,
            gender: result.gender,
            inflectionExplanation: result.inflectionExplanation,
        };
    } catch (error: any) {
        return { error: 'Parse Error', details: error.message };
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
    versionOverride?: string,
    customInstruction?: string,
    onlyExplanations: boolean = false
): Promise<Map<string, WordMeaningResult>> {
    const model = modelOverride || ACTIVE_MODEL;
    const version = versionOverride || ACTIVE_VERSION;
    const results = new Map<string, WordMeaningResult>();

    if (words.length === 0) return results;

    try {
        let prompt = "";

        if (onlyExplanations) {
            prompt = `You are a Swedish language expert. 
Task: Produce a short "Base Word Story" for each word in this list: ${JSON.stringify(words)}.

For each word, return a JSON object with:
- word: string (The Swedish word)
- inflectionExplanation: string (CRITICAL: 1-2 sentences. If not a base form, state base/dictionary form. Format: "**[form] of [base] ([meaning]).**". If already base form, provide a brief usage note or related word. No etymology/history. NEVER null.)

Output Format: A JSON Array of these objects.
JSON ONLY.`;
        } else {
            prompt = `You are a Swedish dictionary generator. 
Task: Analyze these words: ${JSON.stringify(words)}.
Important: Identify if each word is a "base form" or "inflected form."

${customInstruction ? `CRITICAL: The user has provided a custom instruction that OVERRIDES all standard rules: "${customInstruction}". Prioritize fulfilling this instruction perfectly within the JSON structure.` : ""}

Output: A JSON Array with one object per word.
Fields:
- word: string (The Swedish word)
- inflectionExplanation: string (CRITICAL: Provide a 1-2 sentence note. If not a base form, clearly state base/dictionary form. Format: "**[form] of [base] ([meaning]).**" Example: "**Plural of bok (book).**". If already base form, provide a brief usage note or related word. Avoid etymology/history. NEVER null.)
- partOfSpeech: string (noun, verb, etc)
- gender: string (en/ett/null)
- meanings: Array of { english: "descriptive definition" } (List ALL common meanings. Each explanation should be a brief descriptive phrase or short sentence explaining the sense, not just a single-word synonym.)
- synonyms: String[] (Max 3)
- antonyms: String[] (Max 3)
- examples: [] (Keep empty to save space)

JSON ONLY.`;
        }

        const response = await fetch(`${getApiUrl(version, model)}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    responseMimeType: "application/json"
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        const parsedData = parseGeminiResponse(responseText);

        if (!Array.isArray(parsedData)) {
            throw new Error('Response was not a JSON array');
        }

        parsedData.forEach((item: any) => {
            if (item && item.word) {
                const key = words.find(w => w.toLowerCase() === item.word.toLowerCase()) || item.word;

                results.set(key, {
                    meanings: item.meanings || [],
                    examples: item.examples || [],
                    synonyms: item.synonyms || [],
                    antonyms: item.antonyms || [],
                    partOfSpeech: item.partOfSpeech,
                    gender: item.gender,
                    inflectionExplanation: item.inflectionExplanation
                });
            }
        });

    } catch (error: any) {
        console.error("Batch generation failed:", error);
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
            console.error(`Failed to generate meaning for "${word}": `, result.error, result.details);
            results.set(word, {
                meanings: [{ english: `Generation failed: ${result.error} ` }],
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
