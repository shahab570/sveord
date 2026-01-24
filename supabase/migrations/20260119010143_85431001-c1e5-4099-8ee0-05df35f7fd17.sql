-- Table to track file upload history
CREATE TABLE public.upload_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  records_processed INTEGER DEFAULT 0,
  list_type TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own upload history"
  ON public.upload_history
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own upload history"
  ON public.upload_history
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own upload history"
  ON public.upload_history
  FOR DELETE
  USING (user_id = auth.uid());

-- Index for faster queries
CREATE INDEX idx_upload_history_user_id ON public.upload_history(user_id);
CREATE INDEX idx_upload_history_uploaded_at ON public.upload_history(uploaded_at DESC);