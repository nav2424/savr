-- Create meal_plans table for weekly meal planning
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TIMESTAMP WITH TIME ZONE NOT NULL,
  plan_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);

-- Create index on week_start for filtering
CREATE INDEX IF NOT EXISTS idx_meal_plans_week_start ON meal_plans(week_start);

-- Enable RLS
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own meal plans
CREATE POLICY "Users can read their own meal plans"
  ON meal_plans
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own meal plans
CREATE POLICY "Users can insert their own meal plans"
  ON meal_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own meal plans
CREATE POLICY "Users can update their own meal plans"
  ON meal_plans
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own meal plans
CREATE POLICY "Users can delete their own meal plans"
  ON meal_plans
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_meal_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meal_plans_timestamp
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_plans_updated_at();
