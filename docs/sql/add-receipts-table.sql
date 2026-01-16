-- Add Receipts Table for Storing Scan History
-- Run this in your Supabase SQL Editor

-- ============================================
-- STEP 1: Create receipts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT,
  purchase_date DATE,
  total_amount DECIMAL(10, 2),
  image_url TEXT,
  scan_result JSONB NOT NULL, -- Stores the entire scan result including items
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 2: Create index for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON public.receipts(created_at DESC);

-- ============================================
-- STEP 3: Enable Row Level Security
-- ============================================

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Drop existing policies (if any)
-- ============================================

DROP POLICY IF EXISTS "Users can view own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can insert own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can update own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can delete own receipts" ON public.receipts;

-- ============================================
-- STEP 5: Create RLS Policies
-- ============================================

-- Users can view their own receipts
CREATE POLICY "Users can view own receipts" ON public.receipts
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own receipts
CREATE POLICY "Users can insert own receipts" ON public.receipts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own receipts
CREATE POLICY "Users can update own receipts" ON public.receipts
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own receipts
CREATE POLICY "Users can delete own receipts" ON public.receipts
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- STEP 6: Create trigger for updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_receipts_updated_at ON public.receipts;
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SUCCESS! Receipts table is ready
-- ============================================

