-- Test script to verify share code joining functionality
-- Run this in Supabase SQL Editor to debug issues

-- 1. Check if the function exists
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments,
    pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'get_list_by_share_code';

-- 2. Test the function with the share code from the error
-- This is the code the user tried: SAVR-8GURQM
SELECT * FROM get_list_by_share_code('SAVR-8GURQM');

-- 2b. Test with one of the codes that exists in the database
SELECT * FROM get_list_by_share_code('SAVR-H9DQXW');

-- 3. Check what share codes exist in the database
SELECT 
    id,
    name,
    share_code,
    owner_id,
    created_at
FROM lists
WHERE share_code IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if a specific share code exists (case-insensitive)
SELECT 
    id,
    name,
    share_code,
    UPPER(TRIM(share_code)) as normalized_code
FROM lists
WHERE UPPER(TRIM(share_code)) = UPPER(TRIM('SAVR-8GURQM'));

-- 5. Verify RLS policies on lists table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'lists';

