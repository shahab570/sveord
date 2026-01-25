// Word data types for enriched word information
export interface WordMeaning {
  english: string;
  context?: string;
}

export interface WordExample {
  swedish: string;
  english: string;
}

export interface WordData {
  word_type: string;
  gender?: string;
  meanings: WordMeaning[];
  examples: WordExample[];
  synonyms: string[];
  antonyms: string[];
  populated_at: string;
}
