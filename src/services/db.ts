import Dexie, { Table } from 'dexie';
import { WordData } from '@/types/word';

export interface LocalWord {
    id: number; // Primary Key
    swedish_word: string;
    word_data?: WordData;
    last_synced_at?: string;
    kelly_level?: string;
    kelly_source_id?: number;
    frequency_rank?: number;
    sidor_rank?: number;
    sidor_source_id?: number;
    is_ft?: number;
}

export interface LocalUserProgress {
    id?: string;
    user_id: string; // Cloud sync ID
    word_id: number; // Foreign key to words.id
    word_swedish: string; // Helpful redundant info
    is_learned: number;
    user_meaning?: string;
    custom_spelling?: string;
    learned_date?: string;
    last_synced_at?: string;
    srs_next_review?: string;
    srs_interval?: number;
    srs_ease?: number;
    is_reserve?: number;
    reserved_at?: string;
}

export interface SavedQuiz {
    id?: number;
    type: string;
    questions: any[];
    explanations?: Record<number, string>;
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
    patterns!: Table<SavedPattern>;

    constructor() {
        super('Sveord_v3');
        this.version(8).stores({
            words: 'id, swedish_word',
            progress: '++id, user_id, word_id, word_swedish, is_learned, srs_next_review, is_reserve',
            audio_cache: 'word',
            quizzes: '++id, type, isPracticed, createdAt, practicedAt',
            wordUsage: 'wordSwedish',
            patterns: '++id, pattern, created_at'
        });
    }

    async clearAllQuizzes() {
        await this.quizzes.clear();
        await this.wordUsage.clear();
        await this.patterns.clear();
    }
}

export interface SavedPattern {
    id?: number;
    title: string;
    pattern: string;
    content: any; // PatternArticleResult stored as JSON
    created_at: string;
}

export interface AudioCache {
    word: string;
    blob: Blob;
    created_at: string;
}

export const db = new SveordDB();
