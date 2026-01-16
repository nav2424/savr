-- Add preferences column to users table for storing user preferences

-- Add preferences column as JSONB (flexible for all preference types)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Create index for faster preference queries
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING gin (preferences);

-- Update existing users to have empty preferences object
UPDATE users 
SET preferences = '{}'::jsonb 
WHERE preferences IS NULL;

-- Add constraint to ensure preferences is always valid JSON (skip if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'preferences_is_object'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT preferences_is_object 
    CHECK (jsonb_typeof(preferences) = 'object');
  END IF;
END $$;

