# Account Deletion (App Store Requirement)

## Location in App

Users can delete their account from:

**More tab → Profile & Settings → Delete Account** (scroll to bottom, in the Account section)

## Flow

1. User taps **Delete Account** (red button)
2. Confirmation alert explains the action is permanent and irreversible
3. User confirms or cancels
4. On confirm: account is permanently deleted, user is signed out, and redirected to the welcome screen

## Technical Implementation

- **Edge Function**: `supabase/functions/delete-account` – uses Supabase Admin API to permanently delete the user from `auth.users`
- **Client**: `lib/AuthContext.tsx` – `deleteAccount()` invokes the Edge Function
- **UI**: `app/profile-settings.tsx` – Delete Account button with confirmation dialog

## Deployment

1. Deploy the Edge Function:
   ```bash
   supabase functions deploy delete-account
   ```

2. (Optional) If `public.users` doesn't have `ON DELETE CASCADE` from `auth.users`, run:
   ```sql
   -- In Supabase SQL Editor
   \i docs/sql/account-deletion-cascade.sql
   ```

## App Store Connect Response

If asked where to find account deletion:

> Account deletion is available at: **More tab → Profile & Settings → Delete Account** (bottom of the screen). Users see a confirmation dialog before the account is permanently deleted. No customer service contact is required to complete deletion.
