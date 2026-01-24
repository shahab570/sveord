-- Add Sidor list columns to words table
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS sidor_source_id integer;
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS sidor_rank integer;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_words_sidor_rank ON public.words(sidor_rank);