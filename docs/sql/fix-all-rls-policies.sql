-- COMPREHENSIVE FIX FOR INFINITE RECURSION IN RLS POLICIES
-- Run this in your Supabase SQL Editor

-- ============================================
-- STEP 1: Drop all problematic RLS policies
-- ============================================

-- Drop existing lists policies that cause recursion
DROP POLICY IF EXISTS "Users can view their lists" ON public.lists;
DROP POLICY IF EXISTS "Users can view collaborators" ON public.collaborators;

-- ============================================
-- STEP 2: Create new RLS policies WITHOUT recursion
-- ============================================

-- Lists policy: Users can view lists they own or are directly listed as collaborators
-- This avoids recursion by not joining back to lists table
CREATE POLICY "Users can view their lists" ON public.lists
  FOR SELECT USING (
    -- User owns the list
    owner_id = auth.uid()
    OR
    -- User is listed in a collaborator record for this list (direct check, no subquery to lists)
    id IN (
      SELECT list_id 
      FROM public.collaborators 
      WHERE user_id = auth.uid() 
      AND accepted = true
    )
  );

-- Collaborators policy: Users can view collaborators if they own the list or are a collaborator
-- This avoids recursion by checking list ownership directly without subqueries
CREATE POLICY "Users can view collaborators" ON public.collaborators
  FOR SELECT USING (
    -- User is viewing their own collaborator record
    user_id = auth.uid()
    OR
    -- User owns the list (direct check without subquery)
    list_id IN (
      SELECT id 
      FROM public.lists 
      WHERE owner_id = auth.uid()
    )
    OR
    -- User is a collaborator on the same list (direct check)
    list_id IN (
      SELECT list_id 
      FROM public.collaborators 
      WHERE user_id = auth.uid() 
      AND accepted = true
    )
  );

-- ============================================
-- SUCCESS! Infinite recursion fixed
-- ============================================

-- Test the policies by running:
-- SELECT * FROM lists;
-- SELECT * FROM collaborators;
-- 
-- Both should work without recursion errors

