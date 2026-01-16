-- Track when users actually COOK recipes (not just save them)
-- This is used for accurate savings calculations

CREATE TABLE IF NOT EXISTS cooked_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  
  -- Cooking details
  cooked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  servings_made INTEGER,
  
  -- Pantry usage tracking
  ingredients_from_pantry JSONB DEFAULT '[]',
  ingredients_purchased JSONB DEFAULT '[]',
  estimated_savings DECIMAL(10, 2) DEFAULT 0,
  
  -- User feedback (optional)
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indices for fast lookups
CREATE INDEX IF NOT EXISTS idx_cooked_recipes_user_id ON cooked_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_cooked_recipes_recipe_id ON cooked_recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_cooked_recipes_cooked_at ON cooked_recipes(cooked_at);

-- Enable RLS
ALTER TABLE cooked_recipes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own cooked recipes
CREATE POLICY "Users can read their own cooked recipes"
  ON cooked_recipes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own cooked recipes
CREATE POLICY "Users can insert their own cooked recipes"
  ON cooked_recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own cooked recipes
CREATE POLICY "Users can update their own cooked recipes"
  ON cooked_recipes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own cooked recipes
CREATE POLICY "Users can delete their own cooked recipes"
  ON cooked_recipes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

