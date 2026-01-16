-- Add Pantry Items Table for Storing User Pantry
-- Run this in your Supabase SQL Editor

-- ============================================
-- STEP 1: Create pantry_items table
-- ============================================

CREATE TABLE IF NOT EXISTS public.pantry_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🥫',
  category TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pieces',
  location TEXT CHECK (location IN ('fridge', 'freezer', 'pantry')) NOT NULL DEFAULT 'pantry',
  expiry_date DATE,
  purchase_date DATE,
  price DECIMAL(10, 2),
  store TEXT,
  notes TEXT,
  barcode TEXT,
  brand TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 2: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id ON public.pantry_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON public.pantry_items(category);
CREATE INDEX IF NOT EXISTS idx_pantry_items_location ON public.pantry_items(location);
CREATE INDEX IF NOT EXISTS idx_pantry_items_expiry_date ON public.pantry_items(expiry_date);

-- ============================================
-- STEP 3: Enable Row Level Security
-- ============================================

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Drop existing policies (if any)
-- ============================================

DROP POLICY IF EXISTS "Users can view own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can insert own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can update own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can delete own pantry items" ON public.pantry_items;

-- ============================================
-- STEP 5: Create RLS Policies
-- ============================================

-- Users can view their own pantry items
CREATE POLICY "Users can view own pantry items" ON public.pantry_items
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own pantry items
CREATE POLICY "Users can insert own pantry items" ON public.pantry_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own pantry items
CREATE POLICY "Users can update own pantry items" ON public.pantry_items
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own pantry items
CREATE POLICY "Users can delete own pantry items" ON public.pantry_items
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- STEP 6: Create trigger for updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_pantry_items_updated_at ON public.pantry_items;
CREATE TRIGGER update_pantry_items_updated_at
  BEFORE UPDATE ON public.pantry_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STEP 7: Enable Realtime for pantry_items
-- ============================================

-- Note: You may need to enable realtime manually in Supabase Dashboard
-- Go to Database > Replication > supabase_realtime publication
-- Enable the table: public.pantry_items

-- Or run this command (skip if table already added):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;

-- ============================================
-- SUCCESS! Pantry items table is ready
-- ============================================

-- Test by running:
-- SELECT * FROM public.pantry_items;

