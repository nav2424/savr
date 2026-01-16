-- SAVR AI Intelligence - Database Tables
-- Creates tables for Recipe Success Tracking and Price Learning

-- ============================================================================
-- TABLE 1: Recipe Outcomes (Recipe Success Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recipe_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  
  -- Outcome data
  completed BOOLEAN DEFAULT true,
  enjoyment_rating INTEGER CHECK (enjoyment_rating >= 1 AND enjoyment_rating <= 5),
  difficulty_feedback TEXT CHECK (difficulty_feedback IN ('easier_than_expected', 'as_expected', 'harder_than_expected')),
  actual_cook_time INTEGER, -- In minutes
  would_make_again BOOLEAN DEFAULT false,
  notes TEXT,
  
  -- Timestamps
  cooked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipe_outcomes_user 
  ON recipe_outcomes(user_id);
  
CREATE INDEX IF NOT EXISTS idx_recipe_outcomes_recipe 
  ON recipe_outcomes(recipe_id);
  
CREATE INDEX IF NOT EXISTS idx_recipe_outcomes_cooked_at 
  ON recipe_outcomes(cooked_at DESC);

-- RLS Policies
ALTER TABLE recipe_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recipe outcomes"
  ON recipe_outcomes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recipe outcomes"
  ON recipe_outcomes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipe outcomes"
  ON recipe_outcomes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipe outcomes"
  ON recipe_outcomes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 2: Learned Prices (Price Learning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS learned_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Item data
  item_name TEXT NOT NULL,
  store TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  quantity DECIMAL(10, 2) DEFAULT 1 CHECK (quantity > 0),
  unit TEXT DEFAULT 'units',
  
  -- Metadata
  source TEXT DEFAULT 'receipt' CHECK (source IN ('receipt', 'manual', 'estimated')),
  confidence DECIMAL(3, 2) DEFAULT 0.90 CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Timestamps
  learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast price lookups
CREATE INDEX IF NOT EXISTS idx_learned_prices_user 
  ON learned_prices(user_id);
  
CREATE INDEX IF NOT EXISTS idx_learned_prices_item 
  ON learned_prices(item_name);
  
CREATE INDEX IF NOT EXISTS idx_learned_prices_store 
  ON learned_prices(store);
  
CREATE INDEX IF NOT EXISTS idx_learned_prices_user_item 
  ON learned_prices(user_id, item_name);
  
CREATE INDEX IF NOT EXISTS idx_learned_prices_learned_at 
  ON learned_prices(learned_at DESC);

-- RLS Policies
ALTER TABLE learned_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learned prices"
  ON learned_prices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learned prices"
  ON learned_prices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learned prices"
  ON learned_prices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learned prices"
  ON learned_prices FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Recipe success summary
CREATE OR REPLACE VIEW recipe_success_summary AS
SELECT 
  recipe_id,
  COUNT(*) as times_cooked,
  AVG(enjoyment_rating) as avg_enjoyment,
  SUM(CASE WHEN completed THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as success_rate,
  SUM(CASE WHEN would_make_again THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as would_make_again_rate,
  AVG(actual_cook_time) as avg_actual_cook_time
FROM recipe_outcomes
WHERE enjoyment_rating IS NOT NULL
GROUP BY recipe_id;

-- View: Latest learned prices per item
CREATE OR REPLACE VIEW latest_learned_prices AS
SELECT DISTINCT ON (user_id, item_name, store)
  *
FROM learned_prices
ORDER BY user_id, item_name, store, learned_at DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get user's favorite recipes
CREATE OR REPLACE FUNCTION get_user_favorite_recipes(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  recipe_id UUID,
  avg_enjoyment DECIMAL,
  times_cooked BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ro.recipe_id,
    AVG(ro.enjoyment_rating)::DECIMAL as avg_enjoyment,
    COUNT(*)::BIGINT as times_cooked
  FROM recipe_outcomes ro
  WHERE ro.user_id = p_user_id
    AND ro.completed = true
    AND ro.enjoyment_rating >= 4
  GROUP BY ro.recipe_id
  ORDER BY avg_enjoyment DESC, times_cooked DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Get cheapest store for item
CREATE OR REPLACE FUNCTION get_cheapest_store_for_item(p_user_id UUID, p_item_name TEXT)
RETURNS TABLE (
  store TEXT,
  avg_price DECIMAL,
  last_seen TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lp.store,
    AVG(lp.price)::DECIMAL as avg_price,
    MAX(lp.learned_at) as last_seen
  FROM learned_prices lp
  WHERE lp.user_id = p_user_id
    AND lp.item_name ILIKE '%' || p_item_name || '%'
  GROUP BY lp.store
  ORDER BY avg_price ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP (Optional - for fresh install)
-- ============================================================================

-- Uncomment to drop tables (WARNING: DELETES ALL DATA)
-- DROP TABLE IF EXISTS recipe_outcomes CASCADE;
-- DROP TABLE IF NOT EXISTS learned_prices CASCADE;
-- DROP VIEW IF EXISTS recipe_success_summary;
-- DROP VIEW IF EXISTS latest_learned_prices;
-- DROP FUNCTION IF EXISTS get_user_favorite_recipes(UUID, INTEGER);
-- DROP FUNCTION IF EXISTS get_cheapest_store_for_item(UUID, TEXT);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables created
SELECT 'recipe_outcomes' as table_name, COUNT(*) as row_count FROM recipe_outcomes
UNION ALL
SELECT 'learned_prices', COUNT(*) FROM learned_prices;

-- Test queries
-- SELECT * FROM recipe_success_summary;
-- SELECT * FROM latest_learned_prices;
-- SELECT * FROM get_user_favorite_recipes('USER_ID_HERE', 5);
-- SELECT * FROM get_cheapest_store_for_item('USER_ID_HERE', 'milk');

