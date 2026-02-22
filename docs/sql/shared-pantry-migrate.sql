-- Shared Pantry Migration: create one household per user and assign their pantry_items to it.
-- Run this AFTER shared-pantry-schema.sql and only once.

-- For each user who has pantry_items (or who might use pantry), ensure they have a household and members.
-- Step 1: Create a household for each distinct user_id in pantry_items (and ensure owner is in household_members)
INSERT INTO public.households (id, name, owner_id, share_code, created_at, updated_at)
SELECT
  uuid_generate_v4(),
  'My Household',
  pi.user_id,
  'SAVR-H-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
  NOW(),
  NOW()
FROM (SELECT DISTINCT user_id FROM public.pantry_items WHERE household_id IS NULL) pi
WHERE NOT EXISTS (
  SELECT 1 FROM public.households h WHERE h.owner_id = pi.user_id
)
ON CONFLICT DO NOTHING;

-- Step 2: Add owner as accepted owner member (if not already in household_members)
INSERT INTO public.household_members (household_id, user_id, role, added_by, accepted)
SELECT h.id, h.owner_id, 'owner', h.owner_id, true
FROM public.households h
WHERE NOT EXISTS (
  SELECT 1 FROM public.household_members hm
  WHERE hm.household_id = h.id AND hm.user_id = h.owner_id
);

-- Step 3: Update pantry_items to set household_id and added_by where household_id is null
UPDATE public.pantry_items pi
SET
  household_id = (SELECT id FROM public.households WHERE owner_id = pi.user_id LIMIT 1),
  added_by = pi.user_id
WHERE pi.household_id IS NULL AND pi.user_id IS NOT NULL;

-- Step 4 (optional): Make household_id NOT NULL after verifying no nulls remain
-- ALTER TABLE public.pantry_items ALTER COLUMN household_id SET NOT NULL;
