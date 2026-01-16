-- Fix for share code joining issue
-- This allows anyone to read lists by share_code for joining purposes

-- Drop the problematic policy that caused infinite recursion
DROP POLICY IF EXISTS "Anyone can view lists by share code for joining" ON public.lists;

-- Drop and recreate the main policy without the problematic share_code check
DROP POLICY IF EXISTS "Users can view their lists" ON public.lists;

-- Create the main policy without the share_code check to avoid recursion
CREATE POLICY "Users can view their lists" ON public.lists
  FOR SELECT USING (
    -- Allow viewing lists you own
    owner_id = auth.uid() OR
    -- Allow viewing lists you collaborate on
    EXISTS (
      SELECT 1 FROM public.collaborators
      WHERE collaborators.list_id = lists.id
      AND collaborators.user_id = auth.uid()
      AND collaborators.accepted = true
    )
  );

-- Create a separate, simple policy specifically for joining by share code
-- This policy only applies to SELECT and doesn't reference the lists table itself
CREATE POLICY "Allow reading lists by share code for joining" ON public.lists
  FOR SELECT USING (share_code IS NOT NULL);
