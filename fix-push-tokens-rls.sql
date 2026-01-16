-- Fix push_tokens RLS policy to allow inserts and updates

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can insert their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can update their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can read their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can delete their own push tokens" ON push_tokens;

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own push tokens
CREATE POLICY "Users can read their own push tokens"
  ON push_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own push tokens (FIXED)
CREATE POLICY "Users can insert their own push tokens"
  ON push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own push tokens
CREATE POLICY "Users can update their own push tokens"
  ON push_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own push tokens
CREATE POLICY "Users can delete their own push tokens"
  ON push_tokens
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Verify the table exists
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

