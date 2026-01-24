-- Create words table (public dictionary)
CREATE TABLE public.words (
  id SERIAL PRIMARY KEY,
  swedish_word TEXT UNIQUE NOT NULL,
  kelly_level TEXT CHECK (kelly_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  frequency_rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_progress table
CREATE TABLE public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  is_learned BOOLEAN DEFAULT FALSE,
  learned_date TIMESTAMP WITH TIME ZONE,
  user_meaning TEXT,
  custom_spelling TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

-- Create user_roles table for admin management
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Words table policies: All authenticated users can read
CREATE POLICY "Authenticated users can read words"
  ON public.words FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert words
CREATE POLICY "Admins can insert words"
  ON public.words FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update words
CREATE POLICY "Admins can update words"
  ON public.words FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete words
CREATE POLICY "Admins can delete words"
  ON public.words FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User progress policies: Users can only access their own data
CREATE POLICY "Users can read own progress"
  ON public.user_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress"
  ON public.user_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own progress"
  ON public.user_progress FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- User roles policies
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for user_progress
CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_words_swedish_word ON public.words(swedish_word);
CREATE INDEX idx_words_kelly_level ON public.words(kelly_level);
CREATE INDEX idx_words_frequency_rank ON public.words(frequency_rank);
CREATE INDEX idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX idx_user_progress_word_id ON public.user_progress(word_id);
CREATE INDEX idx_user_progress_is_learned ON public.user_progress(is_learned);