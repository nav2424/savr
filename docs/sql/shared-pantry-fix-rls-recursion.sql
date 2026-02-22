-- Fix infinite recursion in RLS policies for households / household_members
-- Run this in Supabase SQL Editor.
-- Errors: "infinite recursion detected in policy for relation households/household_members"

-- ============================================
-- 1. SECURITY DEFINER function (bypasses RLS, no recursion)
-- Returns household_ids where the current user is an accepted member.
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
-- 2. Drop all policies that can cause recursion
-- ============================================
DROP POLICY IF EXISTS "Users can view households they belong to" ON public.households;
DROP POLICY IF EXISTS "Users can view households they own" ON public.households;
DROP POLICY IF EXISTS "Users can view households they are members of" ON public.households;
DROP POLICY IF EXISTS "Members can view household members" ON public.household_members;
DROP POLICY IF EXISTS "Owners can add household members" ON public.household_members;
DROP POLICY IF EXISTS "Owners can remove household members" ON public.household_members;

-- ============================================
-- 3. Households SELECT: use function so we don't read household_members under RLS
-- ============================================
CREATE POLICY "Users can view households they own" ON public.households
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view households they are members of" ON public.households
  FOR SELECT USING (id IN (SELECT public.get_my_household_ids()));

-- ============================================
-- 4. household_members SELECT: use function (no self-query on household_members)
-- ============================================
CREATE POLICY "Members can view household members" ON public.household_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR household_id IN (SELECT public.get_my_household_ids())
  );

-- ============================================
-- 5. household_members INSERT/DELETE (owners only)
-- ============================================
CREATE POLICY "Owners can add household members" ON public.household_members
  FOR INSERT WITH CHECK (
    household_id IN (SELECT id FROM public.households WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners can remove household members" ON public.household_members
  FOR DELETE USING (
    household_id IN (SELECT id FROM public.households WHERE owner_id = auth.uid())
  );
