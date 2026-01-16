-- Add nickname field to users table
-- This allows users to set a friendly nickname for personalized greetings
-- Example: "Arnav" can use nickname "Nav", "Alexander" can use "Alex"

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Update existing users to have nickname = null by default
-- Users can set their nickname in profile settings

