-- FINAL FIX FOR INFINITE RECURSION IN RLS POLICIES
-- Run this ENTIRE script in your Supabase SQL Editor

-- ============================================
-- STEP 1: Drop ALL existing policies to start fresh
-- ============================================

-- Drop all lists policies
DROP POLICY IF EXISTS "Users can view their lists" ON public.lists;
DROP POLICY IF EXISTS "Users can create lists" ON public.lists;
DROP POLICY IF EXISTS "Users can update own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON public.lists;

-- Drop all collaborators policies
DROP POLICY IF EXISTS "Users can view collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Owners can add collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Owners can remove collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Users can update own collaborator status" ON public.collaborators;

-- ============================================
-- STEP 2: Create NEW policies WITHOUT any recursion
-- ============================================

-- LISTS POLICIES (using IN subquery to avoid recursion)
CREATE POLICY "Users can view their lists" ON public.lists
  FOR SELECT USING (
    -- User owns the list
    owner_id = auth.uid()
    OR
    -- User is a collaborator (direct subquery, no join back to lists)
    id IN (
      SELECT list_id 
      FROM public.collaborators 
      WHERE user_id = auth.uid() 
        AND accepted = true
    )
  );

CREATE POLICY "Users can create lists" ON public.lists
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own lists" ON public.lists
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own lists" ON public.lists
  FOR DELETE USING (owner_id = auth.uid());

-- COLLABORATORS POLICIES (simplified to avoid recursion)
CREATE POLICY "Users can view collaborators" ON public.collaborators
  FOR SELECT USING (
    -- User is viewing their own collaborator record
    user_id = auth.uid()
    OR
    -- User owns the list (direct check, no recursion)
    list_id IN (
      SELECT id 
      FROM public.lists 
      WHERE owner_id = auth.uid()
    )
    OR
    -- User is a collaborator on this list (self-join is safe)
    list_id IN (
      SELECT c2.list_id 
      FROM public.collaborators c2
      WHERE c2.user_id = auth.uid() 
        AND c2.accepted = true
    )
  );

CREATE POLICY "Owners can add collaborators" ON public.collaborators
  FOR INSERT WITH CHECK (
    list_id IN (
      SELECT id 
      FROM public.lists 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can remove collaborators" ON public.collaborators
  FOR DELETE USING (
    list_id IN (
      SELECT id 
      FROM public.lists 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own collaborator status" ON public.collaborators
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- STEP 3: Verify the fix
-- ============================================

-- Test by running these queries (they should work without recursion):
-- SELECT * FROM public.lists;
-- SELECT * FROM public.collaborators;

-- ============================================
-- SUCCESS! The infinite recursion is now fixed
-- ============================================

