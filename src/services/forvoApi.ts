import { db } from './db';

const FORVO_API_KEY = import.meta.env.VITE_FORVO_API_KEY;
const FORVO_BASE_URL = 'https://apifree.forvo.com';

export interface ForvoPronunciation {
    id: number;
    word: string;
    addtime: string;
    hits: number;
    username: string;
    sex: string;
    country: string;
    code: string;
    langname: string;
    pathmp3: string;
    pathogg: string;
    rate: number;
    num_votes: number;
    num_positive_votes: number;
}

/**
 * Fetches the highest rated MP3 path for a Swedish word from Forvo.
 */
export async function getForvoAudioUrl(word: string): Promise<string | null> {
    if (!FORVO_API_KEY) {
        console.warn('VITE_FORVO_API_KEY is not set');
        return null;
    }

    try {
        const url = `${FORVO_BASE_URL}/key/${FORVO_API_KEY}/format/json/action/word-pronunciations/word/${encodeURIComponent(word)}/language/sv`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Forvo API error: ${response.statusText}`);
        }

        const data = await response.json();
        const pronunciations: ForvoPronunciation[] = data.items || [];

        if (pronunciations.length === 0) return null;

        // Sort by rate descending to get the highest rated one
        const best = pronunciations.sort((a, b) => b.rate - a.rate)[0];
        return best.pathmp3;
    } catch (error) {
        console.error(`Error fetching Forvo URL for "${word}":`, error);
        return null;
    }
}

/**
 * Downloads audio from a URL and returns as a Blob.
 */
export async function downloadAudioBlob(url: string): Promise<Blob | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to download audio');
        return await response.blob();
    } catch (error) {
        console.error('Error downloading audio blob:', error);
        return null;
    }
}

/**
 * Gets audio blob for a word, either from cache or by fetching from Forvo.
 */
export async function getAudioForWord(word: string): Promise<Blob | null> {
    const lowerWord = word.toLowerCase().trim();

    // 1. Check Cache
    const cached = await db.audio_cache.get(lowerWord);
    if (cached) {
        return cached.blob;
    }

    // 2. Fetch from Forvo
    const audioUrl = await getForvoAudioUrl(lowerWord);
    if (!audioUrl) return null;

    // 3. Download
    const blob = await downloadAudioBlob(audioUrl);
    if (!blob) return null;

    // 4. Store in Cache
    try {
        await db.audio_cache.put({
            word: lowerWord,
            blob,
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.error('Failed to cache audio:', e);
    }

    return blob;
}

/**
 * Plays an audio blob.
 */
export function playAudioBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().finally(() => {
        // We delay cleanup slightly to ensure playback starts, 
        // though modern browsers are usually fine with immediate revoke if the Audio object holds the reference.
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
}
