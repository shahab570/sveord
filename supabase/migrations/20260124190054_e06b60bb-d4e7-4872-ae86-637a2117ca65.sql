-- Add word_data JSONB column to store comprehensive meaning information
ALTER TABLE words 
ADD COLUMN word_data JSONB DEFAULT NULL;

-- Add GIN index for efficient JSONB queries
CREATE INDEX idx_words_word_data ON words USING GIN (word_data);