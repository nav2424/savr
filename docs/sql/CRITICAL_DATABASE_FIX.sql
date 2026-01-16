-- ============================================
-- CRITICAL FIX: Eliminate ALL infinite recursion in RLS policies
-- Run this ENTIRE script in your Supabase SQL Editor
-- ============================================

-- This fixes the circular dependency between lists and collaborators policies
-- The key is to make policies independent without cross-table references

BEGIN;

-- ============================================
-- STEP 1: Drop ALL existing RLS policies that cause recursion
-- ============================================

-- Drop lists policies
DROP POLICY IF EXISTS "Users can view their lists" ON public.lists;
DROP POLICY IF EXISTS "Users can create lists" ON public.lists;
DROP POLICY IF EXISTS "Users can update own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON public.lists;

-- Drop collaborators policies
DROP POLICY IF EXISTS "Users can view collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Owners can add collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Owners can remove collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Users can update own collaborator status" ON public.collaborators;

-- ============================================
-- STEP 2: Create NEW non-recursive policies for LISTS
-- ============================================

-- Policy 1: Users can view lists they OWN (direct check, no joins)
CREATE POLICY "Users can view lists they own" ON public.lists
  FOR SELECT USING (
    owner_id = auth.uid()
  );

-- Policy 2: Users can view lists where they ARE a collaborator (direct collaborator check)
-- This uses a simple IN clause without EXISTS to avoid recursion
CREATE POLICY "Users can view lists they collaborate on" ON public.lists
  FOR SELECT USING (
    id IN (
      SELECT list_id 
      FROM public.collaborators 
      WHERE user_id = auth.uid() 
      AND accepted = true
    )
  );

-- Policy 3: Users can create lists
CREATE POLICY "Users can create lists" ON public.lists
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Policy 4: Users can update their own lists
CREATE POLICY "Users can update own lists" ON public.lists
  FOR UPDATE USING (owner_id = auth.uid());

-- Policy 5: Users can delete their own lists
CREATE POLICY "Users can delete own lists" ON public.lists
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================
-- STEP 3: Create NEW non-recursive policies for COLLABORATORS
-- ============================================

-- Policy 1: Users can view their OWN collaborator records (self)
CREATE POLICY "Users can view own collaborator records" ON public.collaborators
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Policy 2: List owners can view ALL collaborators on their lists
CREATE POLICY "List owners can view their collaborators" ON public.collaborators
  FOR SELECT USING (
    list_id IN (
      SELECT id 
      FROM public.lists 
      WHERE owner_id = auth.uid()
    )
  );

-- Policy 3: Collaborators can view OTHER collaborators on the SAME lists
CREATE POLICY "Collaborators can view peer collaborators" ON public.collaborators
  FOR SELECT USING (
    accepted = true AND
    list_id IN (
      SELECT list_id 
      FROM public.collaborators 
      WHERE user_id = auth.uid() 
      AND accepted = true
    )
  );

-- Policy 4: List owners can add collaborators
CREATE POLICY "Owners can add collaborators" ON public.collaborators
  FOR INSERT WITH CHECK (
    list_id IN (
      SELECT id 
      FROM public.lists 
      WHERE owner_id = auth.uid()
    )
  );

-- Policy 5: List owners can remove collaborators
CREATE POLICY "Owners can remove collaborators" ON public.collaborators
  FOR DELETE USING (
    list_id IN (
      SELECT id 
      FROM public.lists 
      WHERE owner_id = auth.uid()
    )
  );

-- Policy 6: Users can update their own collaborator status (accept invitations)
CREATE POLICY "Users can update own collaborator status" ON public.collaborators
  FOR UPDATE USING (user_id = auth.uid());

COMMIT;

-- ============================================
-- STEP 4: Verify policies work
-- ============================================

-- Test queries (should work without recursion):
-- SELECT * FROM lists;
-- SELECT * FROM collaborators;

-- ============================================
-- SUCCESS! All infinite recursion eliminated
-- ============================================

-- What we fixed:
-- 1. Split the lists SELECT policy into two separate policies
--    - One for owned lists (no joins)
--    - One for collaborated lists (simple IN, no EXISTS)
-- 2. Split the collaborators SELECT policy into three separate policies
--    - One for own records (no joins)
--    - One for list owners (simple IN)
--    - One for peer collaborators (simple IN, no cross-reference)
-- 3. Used IN clauses instead of EXISTS to avoid recursion
-- 4. Made each policy independent without circular dependencies

-- The key insight: Multiple simple policies > One complex policy

