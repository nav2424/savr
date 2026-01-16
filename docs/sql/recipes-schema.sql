-- SAVR Recipes - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to add recipe functionality

-- ============================================
-- STEP 1: Create recipes table (global library)
-- ============================================

CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  
  -- Recipe details
  prep_time INTEGER, -- minutes
  cook_time INTEGER, -- minutes
  servings INTEGER DEFAULT 4,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  cuisine_type TEXT, -- Italian, Mexican, Asian, etc.
  meal_type TEXT, -- breakfast, lunch, dinner, snack, dessert
  
  -- Ingredients and instructions (stored as JSONB for flexibility)
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example: [{"name": "Chicken breast", "quantity": "2", "unit": "lbs"}, ...]
  
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example: [{"step": 1, "description": "Preheat oven to 350°F"}, ...]
  
  -- Nutritional information
  calories INTEGER,
  protein INTEGER, -- grams
  carbs INTEGER, -- grams
  fat INTEGER, -- grams
  fiber INTEGER, -- grams
  
  -- Categorization and search
  tags TEXT[] DEFAULT '{}', -- array of tags: ['vegetarian', 'high-protein', 'quick']
  
  -- Source tracking
  source TEXT DEFAULT 'user_created', -- 'user_created', 'ai_generated', 'imported', 'curated'
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT true, -- Whether recipe is visible to all users
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 2: Create saved_recipes table (user favorites)
-- ============================================

CREATE TABLE IF NOT EXISTS public.saved_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE NOT NULL,
  
  -- User-specific data
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_favorite BOOLEAN DEFAULT false,
  
  -- Cooking history
  last_cooked DATE,
  times_cooked INTEGER DEFAULT 0,
  
  -- Custom modifications
  custom_ingredients JSONB, -- User's modified ingredient list
  custom_instructions JSONB, -- User's modified instructions
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure user can only save a recipe once
  UNIQUE(user_id, recipe_id)
);

-- ============================================
-- STEP 3: Create recipe_collections table (meal plans, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS public.recipe_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📖',
  color TEXT DEFAULT '#6A9571',
  
  -- Collection metadata
  recipe_ids UUID[] DEFAULT '{}', -- Array of recipe IDs
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 4: Create indexes for performance
-- ============================================

-- Recipes indexes
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON public.recipes(created_by);
CREATE INDEX IF NOT EXISTS idx_recipes_is_public ON public.recipes(is_public);
CREATE INDEX IF NOT EXISTS idx_recipes_meal_type ON public.recipes(meal_type);
CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON public.recipes(difficulty);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_source ON public.recipes(source);

-- Saved recipes indexes
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_id ON public.saved_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_recipe_id ON public.saved_recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_is_favorite ON public.saved_recipes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_rating ON public.saved_recipes(rating);

-- Collections indexes
CREATE INDEX IF NOT EXISTS idx_recipe_collections_user_id ON public.recipe_collections(user_id);

-- Full-text search index on recipes
CREATE INDEX IF NOT EXISTS idx_recipes_search ON public.recipes 
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ============================================
-- STEP 5: Enable Row Level Security
-- ============================================

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_collections ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: Create RLS Policies for recipes
-- ============================================

-- Everyone can view public recipes
CREATE POLICY "Public recipes are viewable by everyone" ON public.recipes
  FOR SELECT USING (is_public = true);

-- Users can view their own private recipes
CREATE POLICY "Users can view own recipes" ON public.recipes
  FOR SELECT USING (created_by = auth.uid());

-- Users can create recipes
CREATE POLICY "Users can create recipes" ON public.recipes
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can update their own recipes
CREATE POLICY "Users can update own recipes" ON public.recipes
  FOR UPDATE USING (created_by = auth.uid());

-- Users can delete their own recipes
CREATE POLICY "Users can delete own recipes" ON public.recipes
  FOR DELETE USING (created_by = auth.uid());

-- ============================================
-- STEP 7: Create RLS Policies for saved_recipes
-- ============================================

-- Users can view their saved recipes
CREATE POLICY "Users can view own saved recipes" ON public.saved_recipes
  FOR SELECT USING (user_id = auth.uid());

-- Users can save recipes
CREATE POLICY "Users can save recipes" ON public.saved_recipes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their saved recipes
CREATE POLICY "Users can update own saved recipes" ON public.saved_recipes
  FOR UPDATE USING (user_id = auth.uid());

-- Users can unsave recipes
CREATE POLICY "Users can delete own saved recipes" ON public.saved_recipes
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- STEP 8: Create RLS Policies for recipe_collections
-- ============================================

-- Users can view their own collections
CREATE POLICY "Users can view own collections" ON public.recipe_collections
  FOR SELECT USING (user_id = auth.uid());

-- Users can create collections
CREATE POLICY "Users can create collections" ON public.recipe_collections
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their collections
CREATE POLICY "Users can update own collections" ON public.recipe_collections
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their collections
CREATE POLICY "Users can delete own collections" ON public.recipe_collections
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- STEP 9: Create helper functions
-- ============================================

-- Trigger to auto-update updated_at on recipes
DROP TRIGGER IF EXISTS update_recipes_updated_at ON public.recipes;
CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger to auto-update updated_at on saved_recipes
DROP TRIGGER IF EXISTS update_saved_recipes_updated_at ON public.saved_recipes;
CREATE TRIGGER update_saved_recipes_updated_at
  BEFORE UPDATE ON public.saved_recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger to auto-update updated_at on recipe_collections
DROP TRIGGER IF EXISTS update_recipe_collections_updated_at ON public.recipe_collections;
CREATE TRIGGER update_recipe_collections_updated_at
  BEFORE UPDATE ON public.recipe_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to calculate ingredient match percentage with user's pantry
CREATE OR REPLACE FUNCTION calculate_ingredient_match(
  recipe_ingredients JSONB,
  user_pantry_items TEXT[]
)
RETURNS INTEGER AS $$
DECLARE
  total_ingredients INTEGER;
  matched_ingredients INTEGER := 0;
  ingredient JSONB;
  ingredient_name TEXT;
  pantry_item TEXT;
BEGIN
  -- Get total number of ingredients
  total_ingredients := jsonb_array_length(recipe_ingredients);
  
  IF total_ingredients = 0 THEN
    RETURN 0;
  END IF;
  
  -- Loop through each ingredient
  FOR ingredient IN SELECT * FROM jsonb_array_elements(recipe_ingredients)
  LOOP
    ingredient_name := LOWER(ingredient->>'name');
    
    -- Check if ingredient matches any pantry item
    FOREACH pantry_item IN ARRAY user_pantry_items
    LOOP
      IF LOWER(pantry_item) LIKE '%' || ingredient_name || '%' OR
         ingredient_name LIKE '%' || LOWER(pantry_item) || '%' THEN
        matched_ingredients := matched_ingredients + 1;
        EXIT; -- Break inner loop once matched
      END IF;
    END LOOP;
  END LOOP;
  
  -- Return percentage
  RETURN ROUND((matched_ingredients::FLOAT / total_ingredients::FLOAT) * 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 10: Seed some default recipes (optional)
-- ============================================

-- Insert a few curated recipes to get started
INSERT INTO public.recipes (
  title, description, image_url, prep_time, cook_time, servings, difficulty,
  cuisine_type, meal_type, ingredients, instructions, calories, protein, carbs, fat,
  tags, source, is_public
) VALUES 
(
  'Classic Chicken Stir-Fry',
  'A quick and healthy dinner with tender chicken and colorful vegetables.',
  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
  10, 15, 4, 'Easy',
  'Asian', 'dinner',
  '[
    {"name": "Chicken breast", "quantity": "1", "unit": "lb"},
    {"name": "Bell peppers", "quantity": "2", "unit": "pieces"},
    {"name": "Soy sauce", "quantity": "3", "unit": "tbsp"},
    {"name": "Garlic", "quantity": "3", "unit": "cloves"},
    {"name": "Ginger", "quantity": "1", "unit": "tbsp"},
    {"name": "Rice", "quantity": "2", "unit": "cups"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Cut chicken into bite-sized pieces"},
    {"step": 2, "description": "Heat oil in a large pan or wok over high heat"},
    {"step": 3, "description": "Cook chicken until golden brown, about 5-7 minutes"},
    {"step": 4, "description": "Add sliced bell peppers, garlic, and ginger"},
    {"step": 5, "description": "Stir-fry for 3-4 minutes until vegetables are tender-crisp"},
    {"step": 6, "description": "Add soy sauce and toss to coat"},
    {"step": 7, "description": "Serve over cooked rice"}
  ]'::jsonb,
  420, 28, 45, 12,
  ARRAY['high-protein', 'quick', 'asian', 'dinner'],
  'curated', true
),
(
  'Mediterranean Chickpea Salad',
  'A refreshing and protein-packed salad with Mediterranean flavors.',
  'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=800&q=80',
  15, 0, 4, 'Easy',
  'Mediterranean', 'lunch',
  '[
    {"name": "Chickpeas", "quantity": "2", "unit": "cans"},
    {"name": "Cherry tomatoes", "quantity": "1", "unit": "cup"},
    {"name": "Cucumber", "quantity": "1", "unit": "piece"},
    {"name": "Red onion", "quantity": "1/2", "unit": "piece"},
    {"name": "Feta cheese", "quantity": "1/2", "unit": "cup"},
    {"name": "Olive oil", "quantity": "3", "unit": "tbsp"},
    {"name": "Lemon juice", "quantity": "2", "unit": "tbsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Drain and rinse chickpeas"},
    {"step": 2, "description": "Halve cherry tomatoes and dice cucumber"},
    {"step": 3, "description": "Finely chop red onion"},
    {"step": 4, "description": "Combine all vegetables in a large bowl"},
    {"step": 5, "description": "Crumble feta cheese over the salad"},
    {"step": 6, "description": "Whisk together olive oil and lemon juice"},
    {"step": 7, "description": "Pour dressing over salad and toss gently"}
  ]'::jsonb,
  320, 12, 35, 18,
  ARRAY['vegetarian', 'healthy', 'mediterranean', 'no-cook'],
  'curated', true
),
(
  'Salmon with Roasted Vegetables',
  'Nutritious baked salmon with colorful roasted vegetables.',
  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80',
  10, 20, 2, 'Medium',
  'American', 'dinner',
  '[
    {"name": "Salmon fillets", "quantity": "2", "unit": "pieces"},
    {"name": "Broccoli", "quantity": "2", "unit": "cups"},
    {"name": "Bell peppers", "quantity": "2", "unit": "pieces"},
    {"name": "Olive oil", "quantity": "2", "unit": "tbsp"},
    {"name": "Lemon", "quantity": "1", "unit": "piece"},
    {"name": "Garlic powder", "quantity": "1", "unit": "tsp"}
  ]'::jsonb,
  '[
    {"step": 1, "description": "Preheat oven to 400°F (200°C)"},
    {"step": 2, "description": "Cut vegetables into bite-sized pieces"},
    {"step": 3, "description": "Toss vegetables with olive oil and seasonings"},
    {"step": 4, "description": "Place salmon and vegetables on a baking sheet"},
    {"step": 5, "description": "Bake for 18-20 minutes until salmon is cooked through"},
    {"step": 6, "description": "Squeeze fresh lemon juice over salmon before serving"}
  ]'::jsonb,
  480, 32, 25, 28,
  ARRAY['high-protein', 'omega-3', 'healthy', 'baked'],
  'curated', true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 11: Enable Realtime (Optional)
-- ============================================

-- To enable realtime updates, add the tables to the supabase_realtime publication:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_recipes;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_collections;

-- ============================================
-- SUCCESS! Recipe database is ready
-- ============================================

-- What you get:
-- ✅ Global recipe library with public/private recipes
-- ✅ User-saved recipes with ratings and notes
-- ✅ Recipe collections (meal plans)
-- ✅ Full-text search capability
-- ✅ Ingredient matching function
-- ✅ Nutritional information
-- ✅ Complete RLS security
-- ✅ 3 starter recipes to begin with

-- Next steps:
-- 1. Enable realtime if you want live updates
-- 2. Add more curated recipes
-- 3. Integrate with AI for recipe generation
-- 4. Connect to pantry for ingredient matching

