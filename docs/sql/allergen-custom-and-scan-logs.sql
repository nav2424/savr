-- Allergen Detection: Custom Allergens + Scan Logs
-- Run in Supabase SQL Editor after users table exists.
-- Enables user-defined custom allergens and audit logging for allergen scans.

-- ============================================
-- 1. Custom allergens table (user-defined rules)
-- ============================================
CREATE TABLE IF NOT EXISTS public.custom_allergens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  match_mode TEXT NOT NULL CHECK (match_mode IN ('EXACT_PHRASE', 'KEYWORDS')) DEFAULT 'EXACT_PHRASE',
  terms TEXT[] NOT NULL DEFAULT '{}',
  approved_synonyms TEXT[] DEFAULT '{}',
  enabled_sections TEXT[] NOT NULL DEFAULT ARRAY['ingredients', 'contains', 'may_contain'],
  severity_level TEXT NOT NULL CHECK (severity_level IN ('allergy', 'preference')) DEFAULT 'allergy',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_allergens_user_id ON public.custom_allergens(user_id);

-- ============================================
-- 2. Allergen scan logs (audit/debug)
-- ============================================
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

-- ============================================
-- 3. Enable RLS
-- ============================================
ALTER TABLE public.custom_allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allergen_scan_logs ENABLE ROW LEVEL SECURITY;

-- Custom allergens: users can only access their own
DROP POLICY IF EXISTS "Users can manage own custom allergens" ON public.custom_allergens;
CREATE POLICY "Users can manage own custom allergens" ON public.custom_allergens
  FOR ALL USING (auth.uid() = user_id);

-- Scan logs: users can only access their own (insert + select)
DROP POLICY IF EXISTS "Users can insert own scan logs" ON public.allergen_scan_logs;
CREATE POLICY "Users can insert own scan logs" ON public.allergen_scan_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own scan logs" ON public.allergen_scan_logs;
CREATE POLICY "Users can view own scan logs" ON public.allergen_scan_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 4. Optional: retention policy (delete old logs)
-- ============================================
-- You can run periodically: DELETE FROM allergen_scan_logs WHERE created_at < NOW() - INTERVAL '90 days';
