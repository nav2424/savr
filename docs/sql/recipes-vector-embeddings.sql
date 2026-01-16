-- SAVR Recipes - Vector Embeddings Setup
-- Run this SQL in your Supabase SQL Editor to enable vector search for recipes
-- Requires: pgvector extension (available in Supabase)

-- ============================================
-- STEP 1: Enable pgvector extension
-- ============================================

-- Enable the vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- STEP 2: Add embedding column to recipes table
-- ============================================

-- Add embedding column (1536 dimensions for OpenAI text-embedding-3-small)
ALTER TABLE public.recipes 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add index for vector similarity search (HNSW for fast approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_recipes_embedding ON public.recipes 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Note: For better performance with large datasets (1000+ recipes), consider:
-- CREATE INDEX idx_recipes_embedding ON public.recipes 
-- USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- STEP 3: Create function to generate embedding text from recipe
-- ============================================

-- Function that creates a searchable text representation of a recipe
-- This is what gets embedded for semantic search
CREATE OR REPLACE FUNCTION recipe_embedding_text(
  recipe_title TEXT,
  recipe_description TEXT,
  recipe_ingredients JSONB,
  recipe_tags TEXT[],
  recipe_cuisine TEXT,
  recipe_meal_type TEXT
)
RETURNS TEXT AS $$
DECLARE
  ingredient_names TEXT := '';
  ingredient JSONB;
BEGIN
  -- Extract ingredient names
  IF recipe_ingredients IS NOT NULL THEN
    FOR ingredient IN SELECT * FROM jsonb_array_elements(recipe_ingredients)
    LOOP
      IF ingredient_names != '' THEN
        ingredient_names := ingredient_names || ', ';
      END IF;
      ingredient_names := ingredient_names || COALESCE(ingredient->>'name', '');
    END LOOP;
  END IF;
  
  -- Combine all recipe information into searchable text
  RETURN COALESCE(recipe_title, '') || ' ' ||
         COALESCE(recipe_description, '') || ' ' ||
         ingredient_names || ' ' ||
         COALESCE(array_to_string(recipe_tags, ' '), '') || ' ' ||
         COALESCE(recipe_cuisine, '') || ' ' ||
         COALESCE(recipe_meal_type, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- STEP 4: Create function for semantic recipe search
-- ============================================

-- Function to find similar recipes using vector similarity
-- Returns recipes ordered by cosine similarity (1 = identical, 0 = completely different)
CREATE OR REPLACE FUNCTION search_recipes_by_embedding(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_allergies TEXT[] DEFAULT ARRAY[]::TEXT[],
  filter_dietary TEXT[] DEFAULT ARRAY[]::TEXT[],
  filter_meal_type TEXT DEFAULT NULL,
  filter_cuisine TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  similarity FLOAT,
  ingredients JSONB,
  instructions JSONB,
  prep_time INTEGER,
  cook_time INTEGER,
  servings INTEGER,
  difficulty TEXT,
  cuisine_type TEXT,
  meal_type TEXT,
  tags TEXT[],
  calories INTEGER,
  protein INTEGER,
  carbs INTEGER,
  fat INTEGER,
  image_url TEXT,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.description,
    -- Calculate cosine similarity (1 - distance)
    1 - (r.embedding <=> query_embedding) AS similarity,
    r.ingredients,
    r.instructions,
    r.prep_time,
    r.cook_time,
    r.servings,
    r.difficulty,
    r.cuisine_type,
    r.meal_type,
    r.tags,
    r.calories,
    r.protein,
    r.carbs,
    r.fat,
    r.image_url,
    r.source,
    r.created_at
  FROM public.recipes r
  WHERE 
    -- Only public recipes
    r.is_public = true
    -- Vector similarity threshold
    AND (1 - (r.embedding <=> query_embedding)) >= match_threshold
    -- Optional filters
    AND (filter_meal_type IS NULL OR r.meal_type = filter_meal_type)
    AND (filter_cuisine IS NULL OR r.cuisine_type = filter_cuisine)
    -- Basic allergy filtering (can be enhanced)
    AND (
      filter_allergies = ARRAY[]::TEXT[] OR
      NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.ingredients) AS ing
        WHERE LOWER(ing->>'name') LIKE ANY (
          SELECT '%' || LOWER(allergy) || '%' FROM unnest(filter_allergies) AS allergy
        )
      )
    )
  ORDER BY r.embedding <=> query_embedding  -- Order by distance (closest first)
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- STEP 5: Create trigger to update embedding when recipe changes
-- ============================================

-- Note: Embeddings are generated client-side using OpenAI API
-- This trigger is a placeholder - actual embedding generation happens in the app
-- You can use Supabase Edge Functions or client-side generation

-- ============================================
-- STEP 6: Helper function to batch update embeddings
-- ============================================

-- This function can be called to update embeddings for recipes that don't have them
-- It's a placeholder - actual implementation would call OpenAI API
CREATE OR REPLACE FUNCTION update_recipe_embeddings_batch(
  recipe_ids UUID[],
  embeddings vector(1536)[]
)
RETURNS VOID AS $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..array_length(recipe_ids, 1)
  LOOP
    UPDATE public.recipes
    SET embedding = embeddings[i]
    WHERE id = recipe_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SUCCESS! Vector embeddings are ready
-- ============================================

-- What you get:
-- ✅ pgvector extension enabled
-- ✅ embedding column added to recipes table
-- ✅ Vector similarity index for fast search
-- ✅ Semantic search function
-- ✅ Recipe embedding text generator
-- ✅ Batch update function for embeddings

-- Next steps:
-- 1. Generate embeddings for existing recipes using RecipeEmbeddingService
-- 2. Use RecipeRemixService to search and remix recipes
-- 3. Integrate with smart surfacing feeds

