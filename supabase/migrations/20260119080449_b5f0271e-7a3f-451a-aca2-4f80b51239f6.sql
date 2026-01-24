-- Fix: Add WITH CHECK constraint to user_progress UPDATE policy
-- This prevents users from reassigning their progress records to other users

DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;

CREATE POLICY "Users can update own progress"
  ON public.user_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());