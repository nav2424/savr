-- ============================================
-- SAFE FIX: Drop and recreate ALL policies
-- This handles existing policies safely
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Drop BOTH old and new policy names
-- ============================================

-- Drop ALL possible lists policies (old and new names)
DROP POLICY IF EXISTS "Users can view their lists" ON public.lists;
DROP POLICY IF EXISTS "Users can view lists they own" ON public.lists;
DROP POLICY IF EXISTS "Users can view lists they collaborate on" ON public.lists;
DROP POLICY IF EXISTS "Users can create lists" ON public.lists;
DROP POLICY IF EXISTS "Users can update own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON public.lists;

-- Drop ALL possible collaborators policies (old and new names)
DROP POLICY IF EXISTS "Users can view collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Users can view own collaborator records" ON public.collaborators;
DROP POLICY IF EXISTS "List owners can view their collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Collaborators can view peer collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Owners can add collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Owners can remove collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Users can update own collaborator status" ON public.collaborators;

-- ============================================
-- STEP 2: Create fresh policies for LISTS
-- ============================================

CREATE POLICY "Users can view lists they own" ON public.lists
  FOR SELECT USING (
    owner_id = auth.uid()
  );

CREATE POLICY "Users can view lists they collaborate on" ON public.lists
  FOR SELECT USING (
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

-- ============================================
-- STEP 3: Create fresh policies for COLLABORATORS
-- ============================================

CREATE POLICY "Users can view own collaborator records" ON public.collaborators
  FOR SELECT USING (
    user_id = auth.uid()
  );

CREATE POLICY "List owners can view their collaborators" ON public.collaborators
  FOR SELECT USING (
    list_id IN (
      SELECT id 
      FROM public.lists 
      WHERE owner_id = auth.uid()
    )
  );

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

COMMIT;

-- ============================================
-- DONE! Test with these queries:
-- ============================================
-- SELECT * FROM lists;
-- SELECT * FROM collaborators;

