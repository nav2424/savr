# Fixes Applied - October 13, 2025

## Summary
Fixed 4 critical errors preventing the app from running properly:

1. ✅ User profile creation error
2. ✅ JSON parsing error in scanning service
3. ✅ Push token duplicate key error
4. ✅ Infinite recursion in collaborators RLS policy

---

## 1. User Profile Creation Error

**Error:** `Cannot coerce the result to a single JSON object (PGRST116)`

**Fix:** Modified `lib/AuthContext.tsx` to automatically create user profiles when they don't exist in the database.

**What it does:**
- When a user signs in and their profile is missing, it now automatically creates one using their auth email
- This prevents the app from crashing when existing users sign in

---

## 2. JSON Parsing Error in Scanning

**Error:** `JSON Parse error: Unexpected character:`

**Fix:** Modified `lib/ScanningService.ts` to handle markdown-wrapped JSON responses from OpenAI.

**What it does:**
- OpenAI sometimes wraps JSON responses in markdown code blocks (` ```json ... ``` `)
- The fix strips these code blocks before parsing the JSON
- Handles both ` ```json ` and ` ``` ` formats

---

## 3. Push Token Duplicate Key Error

**Error:** `duplicate key value violates unique constraint "push_tokens_token_key"`

**Fix:** Modified `lib/NotificationsService.ts` to use proper upsert with conflict resolution.

**What it does:**
- Changed from simple upsert to upsert with `onConflict: 'token'`
- Now properly updates existing push tokens instead of trying to insert duplicates
- Adds `updated_at` timestamp on each upsert

---

## 4. Infinite Recursion in Collaborators RLS Policy

**Error:** `infinite recursion detected in policy for relation "collaborators"`

**Fixes Applied:**

### A. Database RLS Policy Fix (REQUIRED)
You need to run the SQL in `fix-collaborators-rls.sql` in your Supabase SQL Editor.

**What it does:**
- Replaces the problematic collaborators SELECT policy that was referencing itself
- Uses direct checks without recursion to determine access rights

### B. Code Changes
Modified `lib/CollaborativeListsService.ts`:
- Removed the join with collaborators table in `getUserLists()` 
- Now fetches lists first, then fetches collaborators separately
- Prevents triggering the RLS policy recursion

Modified `lib/CollaborativeListsContext.tsx`:
- Updated to fetch items and collaborators in parallel for better performance
- Properly handles the new data structure

### C. Dashboard Fix
Modified `app/(tabs)/index.tsx`:
- Removed unused `useLists` import that was causing provider mismatch
- Dashboard now works with authenticated users using CollaborativeListsProvider

---

## Required Action

**You must run the SQL fix in Supabase:**

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Open the file `fix-collaborators-rls.sql` in this directory
4. Copy and paste the SQL into the editor
5. Click "Run"

This will fix the infinite recursion in the database RLS policy.

---

## Testing

After applying these fixes and running the SQL:

1. ✅ Users should be able to sign in without profile errors
2. ✅ Image scanning should work without JSON parse errors
3. ✅ Push notifications should register without duplicate key errors
4. ✅ Lists should load without infinite recursion errors
5. ✅ Dashboard should render properly for authenticated users

---

## Files Modified

- `lib/AuthContext.tsx` - Auto-create missing user profiles
- `lib/ScanningService.ts` - Handle markdown-wrapped JSON
- `lib/NotificationsService.ts` - Proper push token upsert
- `lib/CollaborativeListsService.ts` - Remove recursive join
- `lib/CollaborativeListsContext.tsx` - Update data fetching
- `app/(tabs)/index.tsx` - Remove unused import
- `fix-collaborators-rls.sql` - Database policy fix (MUST RUN IN SUPABASE)

