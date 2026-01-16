-- Add preferences column to users table if it doesn't exist
-- This column stores user preferences including allergies, dietary preferences, shopping habits, etc.

-- Add the preferences column (JSONB type)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT NULL;

-- Add an index on the preferences column for better query performance
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);

-- Add a comment to document the column
COMMENT ON COLUMN users.preferences IS 'Stores user preferences as JSON: location, household, dietary (including allergies), shopping, budget';

