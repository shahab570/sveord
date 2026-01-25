-- Add model and version columns to user_api_keys
ALTER TABLE public.user_api_keys 
ADD COLUMN IF NOT EXISTS gemini_model TEXT,
ADD COLUMN IF NOT EXISTS gemini_api_version TEXT;
