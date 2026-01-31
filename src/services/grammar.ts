export type WordType = 'noun' | 'verb' | 'adjective';

export interface GrammaticalForm {
    label: string;
    word: string;
}

export function generateForms(word: string, type: string, aiForms?: GrammaticalForm[]): GrammaticalForm[] {
    if (aiForms && aiForms.length > 0) {
        return aiForms;
    }

    const lowerType = (type || '').toLowerCase();
    const lowerWord = word.toLowerCase().trim();

    // Adverbs, Prepositions, Conjunctions, Pronouns don't have these form sets
    if (['adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'particle', 'räkneord'].includes(lowerType)) {
        return [];
    }

    const forms: GrammaticalForm[] = [];

    // Strictly validate form counts for AI data to catch hallucinations
    if (aiForms && aiForms.length > 0) {
        if (lowerType === 'verb' && aiForms.length !== 5) return []; // Reject invalid counts
        if (lowerType.includes('noun') && aiForms.length < 2) return [];
        if (lowerType === 'adjective' && aiForms.length !== 3) return [];
        return aiForms;
    }

    if (lowerType.includes('noun') || lowerType.includes('substantiv')) {
        // Simple heuristic for Nouns
        // flicka -> flickan, flickor, flickorna (Group 1 - ending in a)
        // bil -> bilen, bilar, bilarna (Group 2 - ending in consonant)

        if (lowerWord.endsWith('a')) {
            const base = lowerWord.slice(0, -1);
            forms.push({ label: 'Indefinite Singular', word: lowerWord });
            forms.push({ label: 'Definite Singular', word: lowerWord + 'n' });
            forms.push({ label: 'Indefinite Plural', word: base + 'or' });
            forms.push({ label: 'Definite Plural', word: base + 'orna' });
        } else {
            forms.push({ label: 'Indefinite Singular', word: lowerWord });
            forms.push({ label: 'Definite Singular', word: lowerWord + 'en' });
            forms.push({ label: 'Indefinite Plural', word: lowerWord + 'ar' });
            forms.push({ label: 'Definite Plural', word: lowerWord + 'arna' });
        }
    } else if (lowerType.includes('verb')) {
        // Simple heuristic for Verbs
        // tala -> talar, talade, talat, tala (Group 1 - ending in a)

        if (lowerWord.endsWith('a')) {
            const base = lowerWord.slice(0, -1);
            forms.push({ label: 'Infinitive', word: lowerWord });
            forms.push({ label: 'Present', word: lowerWord + 'r' });
            forms.push({ label: 'Past', word: lowerWord + 'de' });
            forms.push({ label: 'Supine', word: lowerWord + 't' });
            forms.push({ label: 'Imperative', word: lowerWord });
        } else {
            // General fallback for non -a verbs (irregular/other groups)
            forms.push({ label: 'Infinitive', word: lowerWord });
            forms.push({ label: 'Present', word: lowerWord + 'er' });
            forms.push({ label: 'Past', word: lowerWord + 'te' }); // simplification
            forms.push({ label: 'Supine', word: lowerWord + 't' });
            forms.push({ label: 'Imperative', word: lowerWord });
        }
    } else if (lowerType.includes('adj')) {
        // Adjectives: Common, Neuter, Plural/Definite
        // stor -> stort, stora

        forms.push({ label: 'Common', word: lowerWord });

        if (lowerWord.endsWith('t')) {
            forms.push({ label: 'Neuter', word: lowerWord });
        } else {
            forms.push({ label: 'Neuter', word: lowerWord + 't' });
        }

        if (lowerWord.endsWith('a')) {
            forms.push({ label: 'Plural/Definite', word: lowerWord });
        } else {
            forms.push({ label: 'Plural/Definite', word: lowerWord + 'a' });
        }
    }

    return forms;
}
