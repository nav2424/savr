-- Allergen scan reports (Report incorrect result) + source coverage score
-- Run after scan-sessions-and-logs.sql

-- ============================================
-- 1. Add source_coverage_score to allergen_scan_logs
-- ============================================
ALTER TABLE public.allergen_scan_logs
  ADD COLUMN IF NOT EXISTS source_coverage_score INTEGER;

COMMENT ON COLUMN public.allergen_scan_logs.source_coverage_score IS '0-100: +60 ingredients_text, +20 allergens_tags, +10 traces_tags, +10 structured ingredients';

-- ============================================
-- 2. Allergen scan reports (Report incorrect result)
-- ============================================
CREATE TABLE IF NOT EXISTS public.allergen_scan_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scan_session_id TEXT,
  barcode TEXT NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('CONTAINS', 'MAY_CONTAIN', 'UNKNOWN')),
  matched_allergens JSONB DEFAULT '[]',
  enabled_allergen_ids TEXT[] DEFAULT '{}',
  off_product_code TEXT,
  off_product_name TEXT,
  off_brands TEXT,
  ingredients_text_truncated TEXT,
  contains_text_truncated TEXT,
  may_contain_text_truncated TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allergen_scan_reports_user_id ON public.allergen_scan_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_allergen_scan_reports_barcode ON public.allergen_scan_reports(barcode);
CREATE INDEX IF NOT EXISTS idx_allergen_scan_reports_created_at ON public.allergen_scan_reports(created_at DESC);

ALTER TABLE public.allergen_scan_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own allergen reports" ON public.allergen_scan_reports;
CREATE POLICY "Users can insert own allergen reports" ON public.allergen_scan_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own allergen reports" ON public.allergen_scan_reports;
CREATE POLICY "Users can view own allergen reports" ON public.allergen_scan_reports
  FOR SELECT USING (auth.uid() = user_id);
