import Dexie, { Table } from 'dexie';
import { WordData } from '@/types/word';

export interface LocalWord {
    id?: number;
    swedish_word: string;
    kelly_level?: string;
    kelly_source_id?: number;
    frequency_rank?: number;
    sidor_rank?: number;
    word_data?: WordData;
    last_synced_at?: string;
    is_ft?: number;
}

export interface LocalUserProgress {
    id?: string;
    word_swedish: string;
    is_learned: number;
    user_meaning?: string;
    custom_spelling?: string;
    learned_date?: string;
    last_synced_at?: string;
    srs_next_review?: string;
    srs_interval?: number;
    srs_ease?: number;
}

export interface SavedQuiz {
    id?: number;
    type: string;
    questions: any[];
    isPracticed: number;
    createdAt: string;
    practicedAt?: string;
}

export interface WordUsage {
    wordSwedish: string;
    targetCount: number;
    optionCount: number;
}

export class SveordDB extends Dexie {
    words!: Table<LocalWord>;
    progress!: Table<LocalUserProgress>;
    audio_cache!: Table<AudioCache>;
    quizzes!: Table<SavedQuiz>;
    wordUsage!: Table<WordUsage>;

    constructor() {
        super('Sveord_v2');
        this.version(3).stores({
            words: 'swedish_word, id, kelly_level, frequency_rank, sidor_rank',
            progress: 'word_swedish, is_learned, srs_next_review',
            audio_cache: 'word'
        });

        this.version(4).stores({
            quizzes: '++id, type, isPracticed, createdAt',
            wordUsage: 'wordSwedish'
        });

        this.version(5).stores({
            words: 'swedish_word, id, kelly_level, frequency_rank, sidor_rank, is_ft'
        });
    }

    async clearAllQuizzes() {
        await this.quizzes.clear();
        await this.wordUsage.clear();
    }
}

export interface AudioCache {
    word: string;
    blob: Blob;
    created_at: string;
}

export const db = new SveordDB();
