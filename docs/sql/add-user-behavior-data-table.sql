-- SAVR AI Learning - User Behavior Data Table
-- Creates table to store user behavior data for AI learning and personalization

-- ============================================================================
-- TABLE: User Behavior Data
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_behavior_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Behavior data stored as JSONB for flexibility
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_behavior_data_user 
  ON user_behavior_data(user_id);

-- Unique constraint to ensure one behavior record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_behavior_data_user_unique
  ON user_behavior_data(user_id);

-- Index on updated_at for sorting
CREATE INDEX IF NOT EXISTS idx_user_behavior_data_updated_at 
  ON user_behavior_data(updated_at DESC);

-- RLS Policies
ALTER TABLE user_behavior_data ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- AUTOMATIC UPDATE TIMESTAMP
-- ============================================================================

-- Create or replace function to update timestamp
CREATE OR REPLACE FUNCTION update_user_behavior_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update timestamp
DROP TRIGGER IF EXISTS update_user_behavior_data_timestamp ON user_behavior_data;
CREATE TRIGGER update_user_behavior_data_timestamp
  BEFORE UPDATE ON user_behavior_data
  FOR EACH ROW
  EXECUTE FUNCTION update_user_behavior_data_updated_at();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify table created
SELECT 'user_behavior_data' as table_name, COUNT(*) as row_count FROM user_behavior_data;

