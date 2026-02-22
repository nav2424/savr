-- Shared Pantry (Households) - Schema and RLS
-- Run in Supabase SQL Editor. Run shared-pantry-migrate.sql after this to backfill existing data.

-- ============================================
-- 1. Create households table
-- ============================================
CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'My Household',
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  share_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_households_owner_id ON public.households(owner_id);
CREATE INDEX IF NOT EXISTS idx_households_share_code ON public.households(share_code);

-- ============================================
-- 2. Create household_members table
-- ============================================
CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'editor',
  added_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted BOOLEAN DEFAULT false,
  UNIQUE(household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON public.household_members(user_id);

-- ============================================
-- 3. Alter pantry_items: add household_id and added_by
-- ============================================
ALTER TABLE public.pantry_items
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pantry_items_household_id ON public.pantry_items(household_id);

-- ============================================
-- 4. Enable RLS on new tables
-- ============================================
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. SECURITY DEFINER helper (avoids RLS recursion on household_members)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_household_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id FROM public.household_members
  WHERE user_id = auth.uid() AND accepted = true
$$;

-- ============================================
-- 6. RLS: households (use function so we don't read household_members under RLS)
-- ============================================
DROP POLICY IF EXISTS "Users can view households they belong to" ON public.households;
DROP POLICY IF EXISTS "Users can view households they own" ON public.households;
DROP POLICY IF EXISTS "Users can view households they are members of" ON public.households;
CREATE POLICY "Users can view households they own" ON public.households
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can view households they are members of" ON public.households
  FOR SELECT USING (id IN (SELECT public.get_my_household_ids()));

DROP POLICY IF EXISTS "Users can create households" ON public.households;
CREATE POLICY "Users can create households" ON public.households
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update their households" ON public.households;
CREATE POLICY "Owners can update their households" ON public.households
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete their households" ON public.households;
CREATE POLICY "Owners can delete their households" ON public.households
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================
-- 7. RLS: household_members (use function so no self-query on household_members)
-- ============================================
DROP POLICY IF EXISTS "Members can view household members" ON public.household_members;
CREATE POLICY "Members can view household members" ON public.household_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR household_id IN (SELECT public.get_my_household_ids())
  );

DROP POLICY IF EXISTS "Owners can add household members" ON public.household_members;
CREATE POLICY "Owners can add household members" ON public.household_members
  FOR INSERT WITH CHECK (
    household_id IN (SELECT id FROM public.households WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners can remove household members" ON public.household_members;
CREATE POLICY "Owners can remove household members" ON public.household_members
  FOR DELETE USING (
    household_id IN (SELECT id FROM public.households WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own member record" ON public.household_members;
CREATE POLICY "Users can update own member record" ON public.household_members
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- 7. RLS: pantry_items (household-based)
-- Add new policies; keep old user_id policies for backward compat until migration is run.
-- ============================================

-- Drop existing pantry_items policies so we can replace with household-based
DROP POLICY IF EXISTS "Users can view own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can create own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can insert own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can update own pantry items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users can delete own pantry items" ON public.pantry_items;

-- SELECT: user can see items if they are in the item's household (owner or accepted member)
CREATE POLICY "Users can view household pantry items" ON public.pantry_items
  FOR SELECT USING (
    household_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.households h
        WHERE h.id = pantry_items.household_id AND h.owner_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.household_members hm
        WHERE hm.household_id = pantry_items.household_id AND hm.user_id = auth.uid() AND hm.accepted = true
      )
    )
  );

-- Also allow viewing rows that have no household_id yet (legacy rows before migration)
DROP POLICY IF EXISTS "Users can view legacy own pantry items" ON public.pantry_items;
CREATE POLICY "Users can view legacy own pantry items" ON public.pantry_items
  FOR SELECT USING (household_id IS NULL AND user_id = auth.uid());

-- INSERT: user can add items if they are owner or editor in the household
CREATE POLICY "Users can insert household pantry items" ON public.pantry_items
  FOR INSERT WITH CHECK (
    household_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.households h
        WHERE h.id = pantry_items.household_id AND h.owner_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.household_members hm
        WHERE hm.household_id = pantry_items.household_id AND hm.user_id = auth.uid()
          AND hm.accepted = true AND hm.role IN ('owner', 'editor')
      )
    )
  );

-- Legacy: allow insert with user_id only (no household_id) for backward compat
DROP POLICY IF EXISTS "Users can insert legacy own pantry items" ON public.pantry_items;
CREATE POLICY "Users can insert legacy own pantry items" ON public.pantry_items
  FOR INSERT WITH CHECK (household_id IS NULL AND user_id = auth.uid());

-- UPDATE: same as insert (owner or editor in household)
CREATE POLICY "Users can update household pantry items" ON public.pantry_items
  FOR UPDATE USING (
    household_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.households h
        WHERE h.id = pantry_items.household_id AND h.owner_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.household_members hm
        WHERE hm.household_id = pantry_items.household_id AND hm.user_id = auth.uid()
          AND hm.accepted = true AND hm.role IN ('owner', 'editor')
      )
    )
  );

DROP POLICY IF EXISTS "Users can update legacy own pantry items" ON public.pantry_items;
CREATE POLICY "Users can update legacy own pantry items" ON public.pantry_items
  FOR UPDATE USING (household_id IS NULL AND user_id = auth.uid());

-- DELETE: same (owner or editor)
CREATE POLICY "Users can delete household pantry items" ON public.pantry_items
  FOR DELETE USING (
    household_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.households h
        WHERE h.id = pantry_items.household_id AND h.owner_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.household_members hm
        WHERE hm.household_id = pantry_items.household_id AND hm.user_id = auth.uid()
          AND hm.accepted = true AND hm.role IN ('owner', 'editor')
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete legacy own pantry items" ON public.pantry_items;
CREATE POLICY "Users can delete legacy own pantry items" ON public.pantry_items
  FOR DELETE USING (household_id IS NULL AND user_id = auth.uid());

-- ============================================
-- 8. Triggers (update_updated_at must already exist from other migrations)
-- ============================================
DROP TRIGGER IF EXISTS update_households_updated_at ON public.households;
CREATE TRIGGER update_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 9. Realtime: ensure pantry_items is in publication (if not already)
-- ============================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.households;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
