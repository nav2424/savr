-- SAVR Pantry Items - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to add pantry functionality

-- ============================================
-- Create pantry_items table
-- ============================================

CREATE TABLE IF NOT EXISTS public.pantry_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🥬',
  category TEXT NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pieces',
  location TEXT NOT NULL CHECK (location IN ('fridge', 'freezer', 'pantry')),
  expiry_date DATE,
  purchase_date DATE DEFAULT CURRENT_DATE,
  price DECIMAL,
  store TEXT,
  notes TEXT,
  barcode TEXT,
  brand TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_pantry_items_user_id ON public.pantry_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON public.pantry_items(category);
CREATE INDEX IF NOT EXISTS idx_pantry_items_location ON public.pantry_items(location);
CREATE INDEX IF NOT EXISTS idx_pantry_items_expiry_date ON public.pantry_items(expiry_date);

-- ============================================
-- Enable Row Level Security
-- ============================================

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Create RLS Policies for pantry_items
-- ============================================

-- Users can view their own pantry items
CREATE POLICY "Users can view own pantry items" ON public.pantry_items
  FOR SELECT USING (user_id = auth.uid());

-- Users can create their own pantry items
CREATE POLICY "Users can create own pantry items" ON public.pantry_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own pantry items
CREATE POLICY "Users can update own pantry items" ON public.pantry_items
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own pantry items
CREATE POLICY "Users can delete own pantry items" ON public.pantry_items
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- Create trigger for updated_at timestamp
-- ============================================

DROP TRIGGER IF EXISTS update_pantry_items_updated_at ON public.pantry_items;
CREATE TRIGGER update_pantry_items_updated_at
  BEFORE UPDATE ON public.pantry_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Enable Realtime (Optional)
-- ============================================

-- To enable realtime updates, add the table to the supabase_realtime publication:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;

-- ============================================
-- SUCCESS! Pantry table is ready
-- ============================================

