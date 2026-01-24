-- Add a dedicated field for preserving the original Kelly JSON ordering/ID
ALTER TABLE public.words
ADD COLUMN IF NOT EXISTS kelly_source_id integer;

-- Index to make ordered per-level reads fast
CREATE INDEX IF NOT EXISTS idx_words_kelly_level_source_id
ON public.words (kelly_level, kelly_source_id);
