-- Create RPC function to get list by share code (bypasses RLS)
-- This function allows anyone to read a list by share code for joining purposes
-- NOTE: Must drop existing function first if parameter name changed

-- Drop existing function if it exists (in case parameter name needs to change)
DROP FUNCTION IF EXISTS get_list_by_share_code(TEXT);

-- Create the function with p_share_code parameter (PostgREST convention)
CREATE OR REPLACE FUNCTION get_list_by_share_code(p_share_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  icon TEXT,
  color TEXT,
  owner_id UUID,
  share_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to bypass RLS
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.description,
    l.icon,
    l.color,
    l.owner_id,
    l.share_code,
    l.created_at,
    l.updated_at
  FROM public.lists l
  WHERE UPPER(TRIM(l.share_code)) = UPPER(TRIM(p_share_code));
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_list_by_share_code(TEXT) TO authenticated;
