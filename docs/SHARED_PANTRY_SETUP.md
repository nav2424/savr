# Shared Pantry (Households) Setup

Multiple users can share one pantry so everyone sees the same items and changes sync in real time.

## 1. Run the database migration

In **Supabase Dashboard → SQL Editor**, run in order:

1. **Schema and RLS**  
   Run the contents of `docs/sql/shared-pantry-schema.sql`.  
   This creates `households`, `household_members`, adds `household_id` and `added_by` to `pantry_items`, and sets RLS policies (non-recursive).

2. **Backfill existing data** (run once)  
   Run the contents of `docs/sql/shared-pantry-migrate.sql`.  
   This creates one household per user who already has pantry items and assigns those items to that household.

**If you see "infinite recursion detected in policy for relation households" or "household_members":**  
Run `docs/sql/shared-pantry-fix-rls-recursion.sql` once. It adds a `get_my_household_ids()` SECURITY DEFINER function and replaces recursive RLS policies so policies never self-reference or cross-reference in a way that triggers recursion.

3. **Join by code (required for joining to work)**  
   Run the contents of `docs/sql/shared-pantry-join-by-code.sql`.  
   This adds `join_household_by_code(p_share_code)` so users who aren’t yet members can look up a household by share code and join. Without this, “Household not found” appears when joining.

## 2. Realtime

If `pantry_items` is not already in the Realtime publication, add it:

- **Database → Replication** → `supabase_realtime` → add table `pantry_items`.

## 3. App behavior

- **Pantry tab:** Header has a people (household) icon; tap it to open **Shared Pantry**.
- **Shared Pantry screen:** Join with a code (e.g. `SAVR-H-XXXXXX`), view members, regenerate share code (owner), leave household (non-owner).
- **First load:** If the user has no household, the app creates one automatically (“My Household”) so the pantry still works.
- **Sync:** All members of a household see the same pantry; add/edit/delete from any device updates for everyone in real time.

## 4. Summary

| File / area | Purpose |
|-------------|--------|
| `docs/sql/shared-pantry-schema.sql` | Tables, columns, RLS |
| `docs/sql/shared-pantry-migrate.sql` | Backfill `household_id` for existing `pantry_items` |
| `docs/sql/shared-pantry-join-by-code.sql` | RPC so users can join by share code (fixes “Household not found”) |
| `lib/HouseholdService.ts` | Create household, join by code, invite, members |
| `lib/HouseholdContext.tsx` | Active household, members, UI state |
| `lib/PantryContext.tsx` | Loads by `household_id`; realtime by household |
| `app/pantry-household.tsx` | Shared Pantry UI (join, invite, members) |
| `app/(tabs)/pantry.tsx` | Household button in header → `/pantry-household` |
