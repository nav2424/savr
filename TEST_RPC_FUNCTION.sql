-- Test the RPC function with valid share codes from the database
-- This will verify the function is working correctly

-- Test 1: Test with "Mancave" list (SAVR-86OATE)
SELECT * FROM get_list_by_share_code('SAVR-86OATE');

-- Test 2: Test with "Weekend Getaway" list (SAVR-H9DQXW)
SELECT * FROM get_list_by_share_code('SAVR-H9DQXW');

-- Test 3: Test case-insensitive (lowercase)
SELECT * FROM get_list_by_share_code('savr-86oate');

-- Test 4: Test with spaces (should be trimmed)
SELECT * FROM get_list_by_share_code('  SAVR-86OATE  ');

-- Test 5: Test with invalid code (should return empty)
SELECT * FROM get_list_by_share_code('SAVR-68TE5W');

-- Test 6: Verify function signature
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments,
    prosrc as function_body
FROM pg_proc 
WHERE proname = 'get_list_by_share_code';

