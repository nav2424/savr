-- Fix push_tokens RLS policy to allow authenticated users to insert their own tokens

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can view their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can update their own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can delete their own push tokens" ON push_tokens;

-- Enable RLS on push_tokens table
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Allow users to INSERT their own push tokens
CREATE POLICY "Users can insert their own push tokens"
ON push_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to SELECT their own push tokens
CREATE POLICY "Users can view their own push tokens"
ON push_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to UPDATE their own push tokens
CREATE POLICY "Users can update their own push tokens"
ON push_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to DELETE their own push tokens
CREATE POLICY "Users can delete their own push tokens"
ON push_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Verify policies are created
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'push_tokens';

