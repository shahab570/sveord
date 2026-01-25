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

export class SveordDB extends Dexie {
    words!: Table<LocalWord>;
    progress!: Table<LocalUserProgress>;

    constructor() {
        super('Sveord_v2');
        this.version(1).stores({
            words: 'swedish_word, kelly_level, frequency_rank, sidor_rank',
            progress: 'word_swedish, is_learned, srs_next_review'
        });
    }
}

export const db = new SveordDB();
