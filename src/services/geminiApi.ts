// Gemini API service for generating Swedish word meanings
let ACTIVE_MODEL = 'gemini-1.5-flash';
let ACTIVE_VERSION = 'v1';

export const getActiveConfig = () => ({ model: ACTIVE_MODEL, version: ACTIVE_VERSION });

const getApiUrl = (version: string, model: string) => {
    const v = (version || 'v1').trim().replace(/\s+/g, '');
    // Strip "models/" prefix and ALL WHITESPACE to prevent URL errors
    const m = (model || 'gemini-1.5-flash').trim().replace(/^models\//, '').replace(/\s+/g, '');
    return `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent`;
};

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
    // Sanitize accidental experimental or dirty model names. Strip all whitespace!
    let sanitizedModel = model.trim().replace(/^models\//, '').replace(/\s+/g, '');
    let sanitizedVersion = version.trim().replace(/\s+/g, '');

    // Refine the "bad model" check. Only fallback if it's SPECIFICALLY a known-dead name.
    // If it's something like "2.5-flash" that we actually found in their account list, KEEP IT.
    if (sanitizedModel === 'gemini-2.5-flash-experimental' || sanitizedModel === 'gemini-2.0-flash-exp') {
        sanitizedModel = 'gemini-1.5-flash';
    }

    ACTIVE_MODEL = sanitizedModel;
    ACTIVE_VERSION = sanitizedVersion;
    console.log(`[GeminiConfig] Applied: ${sanitizedModel} (${sanitizedVersion})`);
}

export type GeminiVersion = 'v1' | 'v1beta';

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
    baseForm?: string;
    isInflected?: boolean;
    grammaticalForms?: Array<{ label: string; word: string }>;
}

export interface AIQuizQuestion {
    type: string;
    targetWord?: string;
    targetMeaning?: string;
    sentence?: string; // For 'context' type, e.g. "Jag bor i en [[blank]]."
    dialogue?: Array<{ speaker: string; text: string }>; // For 'dialogue' type
    blanks?: Array<{ index: number; answer: string; options: string[] }>;
    correctAnswer?: string; // For MCQ types
    options?: Array<{ word: string; meaning?: string }>; // For MCQ types
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

Standard Guidelines:
1. inflectionExplanation: (CRITICAL) Provide a 1-2 sentence "Base Word Story" in English. If the word is NOT in its base/dictionary form (e.g., conjugated verb, plural noun), clearly state the base form and its primary meaning. If it IS already in its base form, provide a short note about its common word family or a practical usage tip. Avoid etymological history.
2. Identify the part of speech.
3. If it is a noun, specify if it is an "en" or "ett" word.
4. Provide English meanings (definitions).
5. List relevant synonyms and antonyms.
6. Provide usage examples (Swedish sentences with English translations).

${customInstruction ? `CRITICAL USER INSTRUCTION: "${customInstruction}"
This instruction is your HIGHEST PRIORITY. It OVERRIDES all standard guidelines above. If the instruction asks for specific formatting, content, or a complete change in how definitions/explanations are presented, follow it exactly even if it deviates from a typical dictionary layout.` : ""}

Format your response as JSON with this exact structure:
{
  "partOfSpeech": "noun/verb/etc",
  "gender": "en/ett/null",
  "inflectionExplanation": "explanation or null",
  "meanings": [{"english": "meaning 1", "context": ""}],
  "grammaticalForms": [
    {"label": "Infinitive", "word": "word"},
    {"label": "Present", "word": "word"},
    {"label": "Past", "word": "word"},
    {"label": "Supine", "word": "word"},
    {"label": "Imperative", "word": "word"}
  ],
  "examples": [{"swedish": "sentence 1", "english": "translation 1"}],
  "synonyms": ["synonym"],
  "antonyms": ["antonym"]
}

CRITICAL: Swedish grammar is strict. Double check irregular verbs (e.g., känna -> känner/kände/känt, springa -> springer/sprang/sprungit) and nouns (e.g., bok -> boken/böcker/böckerna). NEVER regularize irregular forms.

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
            grammaticalForms: result.grammaticalForms || result.grammatical_forms,
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
    onlyExplanations: boolean = false,
    onlyGrammar: boolean = false
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
        } else if (onlyGrammar) {
            prompt = `You are a Swedish grammar expert. 
Task: Provide the standard grammatical forms for these words: ${JSON.stringify(words)}.

For each word, return:
- word: string
- partOfSpeech: string (verb, noun, adjective, adverb, preposition, conjunction, etc.)
- grammaticalForms: Array of { label: string, word: string } 

CRITICAL RULES (Based on SAOL/Swedish Academy):
1. VERBS: MUST provide exactly 5 forms (Infinitive, Present, Past, Supine, Imperative).
2. NOUNS: MUST provide exactly 4 forms (Indef. Sing, Def. Sing, Indef. Plur, Def. Plur). If uncountable (singulare tantum), return 2 forms and label plural as "N/A".
3. ADJECTIVES: MUST provide exactly 3 forms (Common, Neuter, Plural/Definite).
4. ALL OTHER TYPES (Adverb, Preposition, Conjunction, Pronoun, Interjection, Partikel): Return an EMPTY ARRAY: "grammaticalForms": [].
5. LINGUISTIC ACCURACY IS MANDATORY. NEVER invent forms. If unsure, return exactly what SAOL (svenska.se) would show.

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
- grammaticalForms: Array of { label: string, word: string } (CRITICAL: Provide the 4-5 MOST COMMON grammatical forms. VERBS: Infinitive, Present, Past, Supine, Imperative. NOUNS: Indefinite Singular, Definite Singular, Indefinite Plural, Definite Plural. ADJECTIVES: Common, Neuter, Plural/Definite. Use these exact labels. LINGUISTIC ACCURACY IS MANDATORY. DO NOT regularize irregular words. Examples: känna -> känner/kände/känt; bok -> boken/böcker/böckerna.)
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
                    inflectionExplanation: item.inflectionExplanation,
                    grammaticalForms: item.grammaticalForms || item.grammatical_forms
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
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-flash-latest',
        'gemini-pro-latest'
    ])].filter(m => !m.includes('vision') && !m.includes('embedding') && m !== '');

    const versions = ['v1', 'v1beta']; // Try v1 first for stability
    let lastError = 'No models found to test.';

    console.log('[GeminiProbe] Full model list found:', availableModels.join(', '));

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

/**
 * Generate high-quality quiz questions using Gemini
 */
export async function generateAIQuizData(
    words: { swedish_word: string; word_data: any }[],
    type: string,
    apiKey: string
): Promise<AIQuizQuestion[]> {
    const model = ACTIVE_MODEL;
    const version = ACTIVE_VERSION;
    const wordList = words.map(w => w.swedish_word);

    let typeInstruction = "";
    if (type === 'meaning') {
        typeInstruction = "For each word, provide its English meaning as the correctAnswer. Provide 3 other PLAUSIBLE but incorrect English meanings as options. Options should be similar in part-of-speech to avoid giveaways. CRITICAL: For each option (even distractors), the 'swedishWord' field MUST contain the Swedish word that actually corresponds to that English meaning. DO NOT reuse the target word for distractors.";
    } else if (type === 'synonym') {
        typeInstruction = "For each word, provide a Swedish synonym as the correctAnswer. Provide 3 other common Swedish words as options. Options should be semantically related or often confused with the target word.";
    } else if (type === 'antonym') {
        typeInstruction = "For each word, provide a Swedish antonym as the correctAnswer. Provide 3 other common Swedish words as options.";
    } else if (type === 'context') {
        typeInstruction = "For each word, create a natural Swedish sentence with a blank marked as '[[blank]]' where the word fits perfectly. Provide the target word as the answer and 3 other grammatically correct but contextually wrong Swedish words as options.";
    } else if (type === 'dialogue') {
        typeInstruction = "Create a short 4-6 turn conversation between two speakers. Include 3-5 blanks marked as [[0]], [[1]], etc. Each blank MUST correspond to one of the target words provided. For each blank, provide the correct answer and 3 smart Swedish distractor words. CRITICAL: For each turn in the dialogue, provide a 'translation' field with the English translation.";
    } else if (type === 'translation') {
        typeInstruction = "For each Swedish word, provide its English meaning as the targetWord. The correctAnswer MUST be the original Swedish word. Provide 3 other common Swedish words as options to test the user's ability to produce the correct Swedish term based on English.";
    } else if (type === 'recall') {
        typeInstruction = "For each Swedish word, provide its English meaning as the targetWord. The correctAnswer MUST be the original Swedish word. This is a flashcard-style recall practice, so ensure the targetWord (English) is clear and the answer (Swedish) is accurate. Set an empty options array.";
    } else if (type === 'similarity') {
        typeInstruction = "For each word, provide its English meaning as the targetWord. The correctAnswer MUST be the original Swedish word. Provide 3 smart distractors that are ARCHITECTURALLY/STRUCTURALLY similar to the correct Swedish word (e.g., if correct is 'en', distractors could be 'än', 'ett'). Focus on words that look almost identical but have different meanings to test the user's precision.";
    }

    const prompt = `You are a Swedish language educator. Create a high-quality quiz for these words: ${JSON.stringify(wordList)}.
    Type: ${type}
    
    Instructions:
    ${typeInstruction}
    
    Format the response as a JSON array of objects.
    Structure for 'meaning', 'synonym', 'antonym', 'translation':
    { "type": "...", "targetWord": "word", "correctAnswer": "answer", "options": [{ "word": "answer", "swedishWord": "...", "meaning": "..." }, { "word": "distractor1", ... }] }
    
    CRITICAL: The 'options' array MUST include the 'correctAnswer' as one of the choices.
    
    Structure for 'context':
    { "type": "context", "targetWord": "word", "sentence": "Jag bor i en [[blank]].", "correctAnswer": "hus", "options": [{ "word": "bil", "swedishWord": "bil" }, { "word": "skog", "swedishWord": "skog" }, { "word": "stad", "swedishWord": "stad" }, { "word": "hus", "swedishWord": "hus" }] }
    
    Structure for 'dialogue':
    { "type": "dialogue", "dialogue": [{ "speaker": "A", "text": "Hej, hur [[0]] det?", "translation": "Hi, how are you?" }], "blanks": [{ "index": 0, "answer": "mår", "options": ["mår", "går", "är", "står"] }] }
    
    CRITICAL: For 'meaning' type, ensure each object in the 'options' array includes the 'swedishWord' field.
    CRITICAL: For all types, the 'options' array MUST always contain the 'correctAnswer' (or 'answer' for dialogue) plus 3 unique distractors.
    CRITICAL: For 'dialogue' type, ensure 'answer' and 'options' are ONLY plain strings, NEVER objects.
    Return ONLY the JSON array.`;

    try {
        const response = await fetch(`${getApiUrl(version, model)}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    responseMimeType: "application/json"
                }
            }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return parseGeminiResponse(responseText);
    } catch (e) {
        console.error("AI Quiz generation failed:", e);
        return [];
    }
}

/**
 * Generates a detailed explanation for a quiz question.
 */
export async function getQuizExplanation(
    question: any,
    selectedAnswer: string | null,
    apiKey: string,
    version: GeminiVersion = ACTIVE_VERSION as GeminiVersion,
    model: string = ACTIVE_MODEL
): Promise<string> {
    if (!apiKey) throw new Error("Gemini API key not found. Please add it in Settings.");

    const questionJson = JSON.stringify(question, null, 2);
    const prompt = `You are an expert Swedish language educator. Your goal is to provide a comprehensive, high-quality pedagogical explanation for this quiz question to help a student learn.

    ### QUIZ CONTEXT:
    - Question JSON: ${questionJson}
    - Student's Choice: "${selectedAnswer || 'No choice yet'}"
    - Correct Answer: "${question.correctAnswer}"

    ### YOUR TASK:
    Write a clear, educational explanation (50-100 words) that includes the following three sections:

    1. **FULL TRANSLATION**: Provide a natural English translation of the prompt ${question.type === 'context' ? 'sentence' : 'word/phrase'}.
    2. **WHY THIS IS CORRECT**: Explain the specific meaning of **${question.correctAnswer}** and why it's the perfect fit here ${question.type === 'context' ? '(grammar, logic, or nuance)' : ''}.
    3. **WHY OTHERS ARE WRONG**: Briefly explain the meanings of the distractor words and why they don't fit (e.g., wrong part of speech, different meaning, or opposite nuance).

    ### RULES:
    - **CRITICAL**: Use **bold** for ALL Swedish words.
    - **CRITICAL**: Use *italics* for ALL English translations and meanings.
    - Use a professional yet encouraging tone.
    - If the student's choice was "${selectedAnswer}" and it was WRONG, specifically explain the mistake.
    - Do NOT be lazy. Provide a thorough explanation.
    - Format as a single, well-organized response without section headers.`;

    const v = version || ACTIVE_VERSION || 'v1';
    const m = model || ACTIVE_MODEL || 'gemini-1.5-flash';
    const fetchUrl = `${getApiUrl(v, m)}?key=${apiKey}`;

    console.log('[GeminiExplanation] Model:', m, 'Version:', v);
    console.log('[GeminiExplanation] Requesting:', fetchUrl.split('?')[0]);

    try {
        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[GeminiExplanation] Server replied with ${response.status}:`, errorText);

            // Auto-retry with v1 if v1beta failed with 404
            if (response.status === 404 && v === 'v1beta') {
                console.log('[GeminiExplanation] 404 on v1beta, retrying with v1...');
                return getQuizExplanation(question, selectedAnswer, apiKey, 'v1', m);
            }

            // Extreme fallback: list models and try to find a valid Flash model
            if (response.status === 404) {
                console.warn('[GeminiExplanation] Total 404. Fetching available model list as fallback...');
                const available = await listModels(apiKey);
                const betterModel = available.find(mod => mod.includes('1.5-flash')) || available.find(mod => mod.includes('flash'));
                if (betterModel && betterModel !== m) {
                    console.log(`[GeminiExplanation] Found replacement model: ${betterModel}. Updating config and retrying...`);
                    // IMPORTANT: Update global config so NEXT request uses this working model!
                    setActiveConfig(betterModel, v);
                    return getQuizExplanation(question, selectedAnswer, apiKey, v as GeminiVersion, betterModel);
                }
            }

            throw new Error(`Failed to fetch explanation: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation provided.";
    } catch (error) {
        console.error("Error getting quiz explanation:", error);
        return "Sorry, I couldn't generate an explanation right now. Please try again.";
    }
}

/**
 * Specialized generator for FT List words (manually added).
 * Ensures 2-3 meanings, 2-3 examples, and correct metadata.
 */
export async function generateFTWordContent(
    swedishWord: string,
    apiKey: string
): Promise<WordMeaningResult | GeminiError> {
    const model = ACTIVE_MODEL;
    const version = ACTIVE_VERSION;

    try {
        const prompt = `You are a Swedish language expert. Provide high-quality content for the Swedish word "${swedishWord}" for a language learning app.

Requirements:
1. **2-3 English Meanings**: Clear, descriptive definitions.
2. **2-3 Usage Examples**: Natural Swedish sentences with English translations.
3. **1-2 Synonyms**: Swedish words.
4. **1-2 Antonyms**: Swedish words.
5. **Part of Speech**: Must be one of: "noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "interjection".
6. **Gender**: If noun, specify "en" or "ett".
7. **Inflection Explanation**: A 1-2 sentence "Base Word Story" explaining the word's form or usage tips.
8. **Base Form detection**: (CRITICAL) Identify the dictionary/base form of the word. If the word is already a base form, return true for isInflected: false. If it is inflected (plural, conjugated, etc.), provide the baseForm (e.g. "by" for "byar") and set isInflected: true.
9. **Grammatical Forms**: (STRICT RULES) Provide the standard forms based on SAOL:
   - VERBS: 5 forms (Infinitive, Present, Past, Supine, Imperative).
   - NOUNS: 4 forms (Indef. Sing, Def. Sing, Indef. Plur, Def. Plur).
   - ADJECTIVES: 3 forms (Common, Neuter, Plural).
   - OTHERS: Return empty array.

Format your response as JSON:
{
  "partOfSpeech": "noun/verb/etc",
  "gender": "en/ett/null",
  "inflectionExplanation": "...",
  "baseForm": "correct root word",
  "isInflected": true/false,
  "grammaticalForms": [{"label": "Infinitive", "word": "word"}, ...],
  "meanings": [{"english": "meaning 1", "context": ""}, {"english": "meaning 2", "context": ""}],
  "examples": [{"swedish": "...", "english": "..."}, {"swedish": "...", "english": "..."}],
  "synonyms": ["...", "..."],
  "antonyms": ["...", "..."]
}

ONLY return the JSON.`;

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
            baseForm: result.baseForm,
            isInflected: result.isInflected,
            grammaticalForms: result.grammaticalForms || result.grammatical_forms || []
        };
    } catch (error: any) {
        return { error: 'Parse Error', details: error.message };
    }
}

export interface PatternArticleResult {
    title: string;
    pattern: string;
    patternMeaning: string;
    intro: string;
    words: Array<{
        word: string;
        meaning: string;
        breakdown: string;
        example?: string;
    }>;
    construction: string;
    outro: string;
}

/**
 * Generate an educational "blog post" about a specific Swedish pattern or suffix.
 */
export async function generatePatternArticle(
    pattern: string, // Can be empty or "Surprise Me" for auto-mode
    apiKey: string,
    userWords: string[] = [],
    excludePatterns: string[] = []
): Promise<PatternArticleResult | GeminiError> {
    const model = ACTIVE_MODEL;
    const version = ACTIVE_VERSION;

    try {
        const userContext = userWords.length > 0
            ? `USER CONTEXT: The user already knows these words: ${JSON.stringify(userWords.slice(0, 50))}.`
            : "USER CONTEXT: The user is a beginner.";

        const exclusionText = excludePatterns.length > 0
            ? `CRITICAL EXCLUSION: DU NOT USE THESE PATTERNS/SUFFIXES: ${JSON.stringify(excludePatterns)}. Find something different.`
            : "";

        const prompt = `You are an expert Swedish language educator.
        
Task: Select a high-value Swedish suffix, prefix, or word formation rule to teach the user.
${userContext}
${exclusionText}

Selection Strategy:
1. If the user context implies a clear gap (e.g. they know verbs but no nouns), find a relevant pattern.
2. OTHERWISE, prioritize variety. Do NOT just stick to "-ning" or "-het". 
   Consider: 
   - Suffixes: -skap, -dom, -is, -are, -bar, -aktig, -lös
   - Prefixes: o-, miss-, sam-, åter-
   - Compounds: "Noun + Noun" logic, "Verb + Noun" logic.

Your goal is to write a short, engaging educational blog post about this pattern.

Structure the response as a JSON object with these fields:
1. title: A catchy title (e.g., "The Power of -plats", "Unlock 10 words with one suffix").
2. pattern: The specific suffix being taught (e.g., "-plats").
3. patternMeaning: What does this suffix usually mean? (e.g., "Indicates a place or location").
4. intro: A 2-3 sentence engaging intro paragraph explaining why learning this pattern is a "hack" for vocabulary.
5. words: A list of 5-8 common, high-value compound words taking this suffix.
   - word: The Swedish word (e.g. "Arbetsplats").
   - meaning: English meaning.
   - breakdown: How it's made (e.g. "Arbete (Work) + Plats (Place)").
   - example: A short Swedish usage sentence.
6. construction: A brief explanation of the grammar/logic behind combining these words.
7. outro: A motivating closing sentence.

CRITICAL INSTRUCTIONS FOR SWEDISH AUTHENTICITY:
- Use **Authentic Swedish** words and examples found in SAOL (Svenska Akademiens ordlista).
- Ensure the "breakdown" is linguistic accurate.
- Do NOT invent compounds that do not exist in standard Swedish.
- Tone: Educational, encouraging, "life-hack" style.
- Content: meaningful, real words.
- SELECT THE PATTERN YOURSELF based on educational value.

JSON ONLY.`;

        const response = await fetch(`${getApiUrl(version, model)}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.5, // Slightly higher creative temperature for "blog" feel
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
        return parseGeminiResponse(responseText);

    } catch (error: any) {
        return { error: 'Pattern Generation Failed', details: error.message };
    }
}

/**
 * Generate MORE words for an existing pattern.
 * Strictly checks against duplicates and enforces SAOL authenticity.
 */
export async function generateMorePatternWords(
    pattern: string,
    existingWords: string[],
    apiKey: string
): Promise<PatternArticleResult['words'] | GeminiError> {
    const model = ACTIVE_MODEL;
    const version = ACTIVE_VERSION;

    try {
        const prompt = `You are a Swedish lexicographer.
        
Task: Find 5-8 MORE authentic Swedish compound words that contain the pattern/suffix "${pattern}".
Existing words to EXCLUDE: ${JSON.stringify(existingWords)}.

Rules:
1. words must be AUTHENTIC and found in SAOL or standard dictionaries.
2. NO duplicates from the exclusion list.
3. NO fake/invented words.
4. If there are no more common words for this pattern, return an empty array [].

Format: JSON Array of objects:
[
  {
    "word": "SwedishWord",
    "meaning": "English Meaning",
    "breakdown": "Part1 + Part2",
    "example": "Short Swedish sentence."
  }
]

JSON ONLY.`;

        const response = await fetch(`${getApiUrl(version, model)}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3, // Lower temperature for stricter word recall
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

        if (Array.isArray(result)) {
            return result;
        } else {
            return [];
        }

    } catch (error: any) {
        return { error: 'Expansion Failed', details: error.message };
    }
}
