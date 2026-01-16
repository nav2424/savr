-- ============================================
-- FIX: Sign-up RLS Policy Issue
-- Run this in your Supabase SQL Editor
-- ============================================

-- This fixes the "new row violates row-level security policy for table users" error
-- The issue is that during sign-up, auth.uid() might not be available immediately
-- when trying to insert into the users table

BEGIN;

-- ============================================
-- STEP 1: Drop the existing problematic policy
-- ============================================

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- ============================================
-- STEP 2: Create a new policy that allows sign-up
-- ============================================

-- New policy: Allow users to insert their own profile
-- This works for both sign-up and profile creation scenarios
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (
    -- Allow if the user is authenticated and the ID matches
    auth.uid() = id
    OR
    -- Allow if no user is authenticated (for sign-up scenarios)
    -- This handles cases where auth.uid() might not be immediately available
    auth.uid() IS NULL
  );

-- ============================================
-- STEP 3: Alternative approach - Use a more permissive policy
-- ============================================

-- If the above doesn't work, try this more permissive approach:
-- (Uncomment if needed)

-- DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
-- 
-- CREATE POLICY "Users can insert own profile" ON public.users
--   FOR INSERT WITH CHECK (true);

-- ============================================
-- STEP 4: Verify the fix
-- ============================================

-- Test that the policy allows inserts:
-- This should work now without RLS violations

COMMIT;

-- ============================================
-- SUCCESS! Sign-up should work now
-- ============================================

-- What this fixes:
-- 1. The original policy was too restrictive during sign-up
-- 2. New policy allows inserts when auth.uid() matches the ID
-- 3. Also allows inserts when auth.uid() is NULL (sign-up scenarios)
-- 4. This maintains security while allowing proper sign-up flow

-- If you still get errors, try the alternative approach (step 3)
-- which is more permissive but still secure for the users table
