export interface DataValidator {
  validate(data: any): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class WordValidator implements DataValidator {
  validate(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!data.swedish_word) {
      errors.push('Swedish word is required');
    } else if (typeof data.swedish_word !== 'string') {
      errors.push('Swedish word must be a string');
    } else if (data.swedish_word.trim().length === 0) {
      errors.push('Swedish word cannot be empty');
    } else if (data.swedish_word.length > 100) {
      errors.push('Swedish word is too long (max 100 characters)');
    }

    // Optional fields validation

    // Word data validation
    if (data.word_data) {
      if (typeof data.word_data !== 'object') {
        errors.push('Word data must be an object');
      } else {
        // Validate meanings
        if (data.word_data.meanings && !Array.isArray(data.word_data.meanings)) {
          errors.push('Word meanings must be an array');
        } else if (data.word_data.meanings) {
          data.word_data.meanings.forEach((meaning: any, index: number) => {
            if (!meaning.english) {
              errors.push(`Meaning ${index + 1} missing English translation`);
            }
          });
        }

        // Validate examples
        if (data.word_data.examples && !Array.isArray(data.word_data.examples)) {
          errors.push('Word examples must be an array');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export class ProgressValidator implements DataValidator {
  validate(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!data.user_id) {
      errors.push('User ID is required');
    }

    if (!data.word_id || typeof data.word_id !== 'number') {
      errors.push('Word ID is required and must be a number');
    }

    if (!data.word_swedish) {
      errors.push('Word Swedish text is required');
    } else if (typeof data.word_swedish !== 'string') {
      errors.push('Word Swedish must be a string');
    }

    // Unified status fields (support both 0/1 and boolean true/false)
    if (data.is_learned !== undefined && typeof data.is_learned !== 'number' && typeof data.is_learned !== 'boolean') {
      errors.push('is_learned must be a number or boolean');
    }

    if (data.is_reserve !== undefined && typeof data.is_reserve !== 'number' && typeof data.is_reserve !== 'boolean') {
      errors.push('is_reserve must be a number or boolean');
    }

    // Date validation
    if (data.learned_date) {
      const learnedDate = new Date(data.learned_date);
      if (isNaN(learnedDate.getTime())) {
        errors.push('learned_date must be a valid date');
      }
    }

    if (data.reserved_at) {
      const reservedDate = new Date(data.reserved_at);
      if (isNaN(reservedDate.getTime())) {
        errors.push('reserved_at must be a valid date');
      }
    }

    // SRS validation
    if (data.srs_interval !== undefined && (typeof data.srs_interval !== 'number' || data.srs_interval < 0)) {
      warnings.push('SRS interval must be a non-negative number');
    }

    if (data.srs_ease !== undefined && (typeof data.srs_ease !== 'number' || data.srs_ease < 1.3)) {
      warnings.push('SRS ease must be at least 1.3');
    }

    // Mutual exclusivity check
    if (data.is_learned === 1 && data.is_reserve === 1) {
      errors.push('Word cannot be both learned and reserved');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Validation decorator for operations
export function validateData(validator: DataValidator) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const data = args[0]; // Assume first argument is the data to validate

      const result = validator.validate(data);

      if (!result.isValid) {
        const error = new Error(`Validation failed: ${result.errors.join(', ')}`);
        (error as any).validationErrors = result.errors;
        throw error;
      }

      if (result.warnings.length > 0) {
        console.warn('Validation warnings:', result.warnings);
      }

      return method.apply(this, args);
    };
  };
}

// Global validation functions
export const validateWord = (data: any): ValidationResult => {
  const validator = new WordValidator();
  return validator.validate(data);
};

export const validateProgress = (data: any): ValidationResult => {
  const validator = new ProgressValidator();
  return validator.validate(data);
};

// Sanitization functions
export const sanitizeWord = (data: any): any => {
  return {
    ...data,
    swedish_word: data.swedish_word?.toString().trim().toLowerCase(),
    word_data: data.word_data || null
  };
};

export const sanitizeProgress = (data: any, existing?: any): any => {
  const sanitized = {
    ...existing,
    ...data,
    // Strictly convert status to 0 or 1
    is_learned: data.is_learned === true || data.is_learned === 1 ? 1 : (data.is_learned === false || data.is_learned === 0 ? 0 : (existing?.is_learned ?? 0)),
    is_reserve: data.is_reserve === true || data.is_reserve === 1 ? 1 : (data.is_reserve === false || data.is_reserve === 0 ? 0 : (existing?.is_reserve ?? 0)),

    // Ensure IDs and Strings are clean
    user_id: data.user_id || existing?.user_id,
    word_id: Number(data.word_id || existing?.word_id),
    word_swedish: (data.word_swedish || existing?.word_swedish)?.toString().toLowerCase(),

    // Dates
    learned_date: data.learned_date || existing?.learned_date || null,
    reserved_at: data.reserved_at || existing?.reserved_at || null,

    // Content
    user_meaning: data.user_meaning !== undefined ? data.user_meaning?.toString().trim() : existing?.user_meaning,
    custom_spelling: data.custom_spelling !== undefined ? data.custom_spelling?.toString().trim() : existing?.custom_spelling
  };

  return sanitized;
};
