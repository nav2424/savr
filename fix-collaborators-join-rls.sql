-- Fix RLS policy for collaborators table to allow joining via share code
-- This allows users to add themselves as collaborators when joining a list by share code

BEGIN;

-- ============================================
-- STEP 1: Drop existing INSERT policy if it exists
-- ============================================

DROP POLICY IF EXISTS "Owners can add collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Users can join lists via share code" ON public.collaborators;

-- ============================================
-- STEP 2: Create policy for owners to add collaborators
-- ============================================

CREATE POLICY "Owners can add collaborators" ON public.collaborators
  FOR INSERT WITH CHECK (
    -- Allow if the current user is the list owner
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = collaborators.list_id
      AND lists.owner_id = auth.uid()
    )
  );

-- ============================================
-- STEP 3: Create policy for users to join via share code
-- ============================================

CREATE POLICY "Users can join lists via share code" ON public.collaborators
  FOR INSERT WITH CHECK (
    -- Allow if:
    -- 1. The user is adding themselves (user_id matches auth.uid())
    -- 2. The list has a share_code (they're joining via share code)
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = collaborators.list_id
      AND lists.share_code IS NOT NULL
      AND lists.share_code != ''
    )
  );

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================
-- Test that the policies work:
-- 1. List owners can still add collaborators
-- 2. Users can join lists via share code by adding themselves

-- Check policies:
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'collaborators'
ORDER BY policyname;

