-- Fix RLS policies for user_behavior_data (run in Supabase SQL Editor if inserts fail with 42501)
-- Ensures authenticated users can insert/update their own behavior data

-- Drop existing policies (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view their own behavior data" ON user_behavior_data;
DROP POLICY IF EXISTS "Users can insert their own behavior data" ON user_behavior_data;
DROP POLICY IF EXISTS "Users can update their own behavior data" ON user_behavior_data;
DROP POLICY IF EXISTS "Users can delete their own behavior data" ON user_behavior_data;

-- Recreate policies
CREATE POLICY "Users can view their own behavior data"
  ON user_behavior_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own behavior data"
  ON user_behavior_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own behavior data"
  ON user_behavior_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own behavior data"
  ON user_behavior_data FOR DELETE
  USING (auth.uid() = user_id);
