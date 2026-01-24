-- Fix Issue 1: Allow all authenticated users to insert/update words for imports
-- This makes the vocabulary trainer work for all users who need to import word lists

-- Drop the existing admin-only INSERT policy
DROP POLICY IF EXISTS "Admins can insert words" ON public.words;

-- Create policy allowing authenticated users to insert words
CREATE POLICY "Authenticated users can insert words"
  ON public.words
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Drop the existing admin-only UPDATE policy  
DROP POLICY IF EXISTS "Admins can update words" ON public.words;

-- Create policy allowing authenticated users to update words (for upsert during imports)
CREATE POLICY "Authenticated users can update words"
  ON public.words
  FOR UPDATE
  TO authenticated
  USING (true);

-- Keep DELETE as admin-only (already exists)

-- Fix Issue 2: Add policies for user_roles management (admin-only)
-- This allows admins to assign/modify roles through the application

CREATE POLICY "Admins can insert user roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update user roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));