-- Quick verification script for share code function
-- Run this in Supabase SQL Editor to verify the function is working

-- 1. Check if function exists and its signature
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'get_list_by_share_code';

-- 2. Test with a share code that exists (from the logs: SAVR-86OATE for Mancave)
SELECT * FROM get_list_by_share_code('SAVR-86OATE');

-- 3. Test with the code that's failing (SAVR-68TE5W)
SELECT * FROM get_list_by_share_code('SAVR-68TE5W');

-- 4. Check all share codes in database
SELECT 
    id,
    name,
    share_code,
    UPPER(TRIM(share_code)) as normalized_code
FROM lists
WHERE share_code IS NOT NULL
ORDER BY updated_at DESC
LIMIT 20;

-- 5. Test case-insensitive matching
SELECT 
    id,
    name,
    share_code
FROM lists
WHERE UPPER(TRIM(share_code)) = UPPER(TRIM('SAVR-68TE5W'));

