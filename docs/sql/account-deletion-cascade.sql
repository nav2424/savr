-- Account Deletion: Ensure public.users cascades when auth.users is deleted
--
-- When a user deletes their account via the delete-account Edge Function,
-- auth.admin.deleteUser() removes the row from auth.users. This migration
-- ensures public.users is also removed via ON DELETE CASCADE.
--
-- Prerequisite: public.users.id must match auth.users.id (same UUID).
-- Run in Supabase SQL Editor if your users table was created without this FK.
--
-- If you get "relation already has a foreign key" or "constraint already exists",
-- your schema is already configured correctly.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
    AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_auth_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'users_auth_fkey already exists - no action needed';
END $$;
