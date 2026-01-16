-- Recipe Interactions Table for Learning User Preferences
-- SAFE VERSION - Won't error if already exists
-- Run this in Supabase SQL Editor

-- Create recipe_interactions table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.recipe_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL,
  recipe_title TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('viewed', 'saved', 'cooked', 'rated', 'unsaved')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  ingredients JSONB,
  cuisine_type TEXT,
  meal_type TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS recipe_interactions_user_id_idx ON public.recipe_interactions(user_id);
CREATE INDEX IF NOT EXISTS recipe_interactions_recipe_id_idx ON public.recipe_interactions(recipe_id);
CREATE INDEX IF NOT EXISTS recipe_interactions_timestamp_idx ON public.recipe_interactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS recipe_interactions_action_idx ON public.recipe_interactions(action);

-- Enable Row Level Security
ALTER TABLE public.recipe_interactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own recipe interactions" ON public.recipe_interactions;
DROP POLICY IF EXISTS "Users can insert own recipe interactions" ON public.recipe_interactions;
DROP POLICY IF EXISTS "Users can update own recipe interactions" ON public.recipe_interactions;
DROP POLICY IF EXISTS "Users can delete own recipe interactions" ON public.recipe_interactions;

-- Create RLS Policies (fresh)
CREATE POLICY "Users can view own recipe interactions"
  ON public.recipe_interactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recipe interactions"
  ON public.recipe_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipe interactions"
  ON public.recipe_interactions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipe interactions"
  ON public.recipe_interactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.recipe_interactions TO authenticated;
GRANT ALL ON public.recipe_interactions TO service_role;

-- Add comment
COMMENT ON TABLE public.recipe_interactions IS 'Tracks user interactions with recipes to learn preferences and personalize recommendations';

-- SUCCESS! Recipe interactions table is ready
SELECT 'Recipe interactions table setup complete! ✅' as status;

