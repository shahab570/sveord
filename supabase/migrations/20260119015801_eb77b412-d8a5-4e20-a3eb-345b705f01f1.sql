-- Fix: Restrict words table INSERT and UPDATE to admin-only
-- This prevents any authenticated user from modifying the shared vocabulary database

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert words" ON public.words;
DROP POLICY IF EXISTS "Authenticated users can update words" ON public.words;

-- Create admin-only INSERT policy
CREATE POLICY "Admins can insert words"
  ON public.words FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create admin-only UPDATE policy  
CREATE POLICY "Admins can update words"
  ON public.words FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));