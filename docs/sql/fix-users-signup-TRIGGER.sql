-- ============================================
-- COMPLETE FIX: Auto-create user profiles on signup
-- Run this ENTIRE script in your Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Update RLS policies for users table
-- ============================================

-- Drop existing INSERT policy (it's too restrictive)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Allow authenticated users to insert their own profile
-- This is more permissive and works with triggers
CREATE POLICY "Allow user profile creation" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 2: Create trigger function to auto-create profiles
-- ============================================

-- This function automatically creates a user profile when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at, last_seen)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================
-- STEP 3: Create trigger on auth.users
-- ============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;

-- ============================================
-- SUCCESS! New users will automatically get profiles
-- ============================================

-- How it works:
-- 1. User signs up with email/password
-- 2. Supabase Auth creates record in auth.users
-- 3. Trigger fires and creates matching record in public.users
-- 4. User can now use the app immediately

-- Test by creating a new account - it should work now!

