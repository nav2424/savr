-- Scan sessions + extended allergen logs
-- Run after allergen-custom-and-scan-logs.sql

-- ============================================
-- 1. Scan sessions (barcode-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS public.scan_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  off_lookup_result TEXT NOT NULL CHECK (off_lookup_result IN ('found', 'not_found')),
  off_product_code TEXT,
  off_product_name TEXT,
  off_brands TEXT,
  has_ingredient_data BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_sessions_user_id ON public.scan_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_barcode ON public.scan_sessions(barcode);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_created_at ON public.scan_sessions(created_at DESC);

ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own scan sessions" ON public.scan_sessions;
CREATE POLICY "Users can insert own scan sessions" ON public.scan_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own scan sessions" ON public.scan_sessions;
CREATE POLICY "Users can view own scan sessions" ON public.scan_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 2. Extend allergen_scan_logs (optional columns)
-- ============================================
ALTER TABLE public.allergen_scan_logs
  ADD COLUMN IF NOT EXISTS scan_session_id TEXT,
  ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'OFF' CHECK (data_source IN ('OFF', 'OCR', 'MANUAL')),
  ADD COLUMN IF NOT EXISTS off_found BOOLEAN,
  ADD COLUMN IF NOT EXISTS off_product_code TEXT,
  ADD COLUMN IF NOT EXISTS off_product_name TEXT,
  ADD COLUMN IF NOT EXISTS ingredients_present BOOLEAN,
  ADD COLUMN IF NOT EXISTS allergens_tags_present BOOLEAN,
  ADD COLUMN IF NOT EXISTS traces_tags_present BOOLEAN;
