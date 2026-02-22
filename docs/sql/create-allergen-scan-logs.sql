-- Create allergen_scan_logs table (required for scan detail + allergen logging)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

CREATE TABLE IF NOT EXISTS public.allergen_scan_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  product_name TEXT,
  ingredients_text_used TEXT,
  contains_text_used TEXT,
  may_contain_text_used TEXT,
  has_ingredient_data BOOLEAN NOT NULL DEFAULT false,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('SAFE', 'CONTAINS', 'MAY_CONTAIN', 'UNKNOWN')),
  matched_allergens JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allergen_scan_logs_user_id ON public.allergen_scan_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_allergen_scan_logs_barcode ON public.allergen_scan_logs(barcode);
CREATE INDEX IF NOT EXISTS idx_allergen_scan_logs_created_at ON public.allergen_scan_logs(created_at DESC);

ALTER TABLE public.allergen_scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own scan logs" ON public.allergen_scan_logs;
CREATE POLICY "Users can insert own scan logs" ON public.allergen_scan_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own scan logs" ON public.allergen_scan_logs;
CREATE POLICY "Users can view own scan logs" ON public.allergen_scan_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Optional columns (used by BarcodeService)
ALTER TABLE public.allergen_scan_logs
  ADD COLUMN IF NOT EXISTS scan_session_id TEXT,
  ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'OFF',
  ADD COLUMN IF NOT EXISTS off_found BOOLEAN,
  ADD COLUMN IF NOT EXISTS source_coverage_score INTEGER;
