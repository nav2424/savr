# 🔄 Collaborative Lists Functionality - Complete Flow

## Overview

Collaborative lists allow users to create shopping lists and share them with others using share codes. Multiple users can collaborate on the same list in real-time.

---

## 📋 How It Works

### 1. **Creating a List**

**Flow:**
1. User calls `createList(name, icon, description?)`
2. System generates a unique share code: `SAVR-XXXXXX` (6 random uppercase alphanumeric)
3. List is created in database with:
   - `owner_id`: Current user's ID
   - `share_code`: Generated unique code
   - Other list metadata

**Code Location:** `lib/CollaborativeListsService.ts::createList()`

**Share Code Format:**
- Format: `SAVR-XXXXXX` (e.g., `SAVR-H9DQXW`)
- Generated using: `'SAVR-' + Math.random().toString(36).substring(2, 8).toUpperCase()`
- Always uppercase
- Uniqueness checked before assignment

---

### 2. **Joining a List by Share Code**

**Flow:**
1. User enters share code (e.g., `SAVR-H9DQXW`)
2. Code is normalized: trimmed, spaces removed, uppercase
3. System tries to find list using **two methods**:

   **Method 1: RPC Function (Primary)**
   - Calls `get_list_by_share_code(p_share_code)` SQL function
   - This function **bypasses RLS** (Row Level Security) using `SECURITY DEFINER`
   - Performs case-insensitive search: `UPPER(TRIM(l.share_code)) = UPPER(TRIM($1))`
   - Returns list data if found

   **Method 2: Direct Query (Backup)**
   - Direct Supabase query: `.from('lists').select('*').ilike('share_code', candidate)`
   - Case-insensitive search using `ilike`
   - May be blocked by RLS if user doesn't have access

4. If list found:
   - Check if user is already a collaborator
   - If not, add user as collaborator with role `'editor'` and `accepted: true`
   - Return list data

5. If list not found:
   - Return error: "List not found with share code..."

**Code Location:** `lib/CollaborativeListsService.ts::joinListByCode()`

**Key Features:**
- Tries multiple code variants (normalized, uppercase, original, etc.)
- Comprehensive error logging for debugging
- Handles both array and single result from RPC

---

### 3. **Viewing Lists**

**Flow:**
1. User calls `getUserLists()`
2. System fetches:
   - **Owned lists**: `WHERE owner_id = user.id`
   - **Collaborated lists**: Lists where user is in `collaborators` table with `accepted = true`
3. Combines both lists, removes duplicates
4. Sorts by `updated_at` descending
5. For each list, loads:
   - Items from `list_items` table
   - Collaborators from `collaborators` table
6. Returns formatted list data

**Code Location:** `lib/CollaborativeListsService.ts::getUserLists()`

---

### 4. **Real-Time Updates**

**Flow:**
1. When list is loaded, system subscribes to real-time changes
2. Subscriptions listen for:
   - `INSERT` on `list_items` → New item added
   - `UPDATE` on `list_items` → Item modified
   - `DELETE` on `list_items` → Item removed
   - `INSERT` on `activities` → New activity logged
3. When change detected, UI updates automatically
4. Subscriptions cleaned up when component unmounts

**Code Location:** 
- `lib/CollaborativeListsService.ts::subscribeToList()`
- `lib/CollaborativeListsContext.tsx::subscribeToList()`

---

## 🗄️ Database Schema

### Tables

**`lists`**
- `id` (UUID, primary key)
- `name` (TEXT)
- `description` (TEXT, nullable)
- `icon` (TEXT)
- `color` (TEXT)
- `owner_id` (UUID, foreign key to `users.id`)
- `share_code` (TEXT, unique)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**`list_items`**
- `id` (UUID, primary key)
- `list_id` (UUID, foreign key to `lists.id`)
- `name` (TEXT)
- `category` (TEXT)
- `quantity` (TEXT)
- `notes` (TEXT, nullable)
- `completed` (BOOLEAN)
- `added_by` (UUID, foreign key to `users.id`)
- `added_by_name` (TEXT)
- `added_date` (DATE)
- `completed_by` (UUID, nullable)
- `completed_by_name` (TEXT, nullable)
- `completed_date` (DATE, nullable)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**`collaborators`**
- `id` (UUID, primary key)
- `list_id` (UUID, foreign key to `lists.id`)
- `user_id` (UUID, foreign key to `users.id`)
- `role` (TEXT: 'owner' | 'editor' | 'viewer')
- `added_by` (UUID, foreign key to `users.id`)
- `added_at` (TIMESTAMP)
- `accepted` (BOOLEAN)

**`activities`**
- `id` (UUID, primary key)
- `list_id` (UUID, foreign key to `lists.id`)
- `user_id` (UUID, foreign key to `users.id`)
- `user_name` (TEXT)
- `action` (TEXT)
- `item_name` (TEXT, nullable)
- `details` (TEXT, nullable)
- `created_at` (TIMESTAMP)

---

## 🔐 Security (RLS Policies)

### Lists Table
- Users can view lists they own
- Users can view lists they collaborate on (accepted collaborators)
- Users can create lists (they become owner)
- Users can update/delete their own lists
- **Special:** RPC function `get_list_by_share_code` bypasses RLS to allow joining

### List Items Table
- Users can view items in lists they own or collaborate on
- Users can add/update/delete items in lists they have access to

### Collaborators Table
- Users can view collaborators on lists they have access to
- List owners can add/remove collaborators
- Users can update their own collaborator status (e.g., accept invitation)

---

## 🔧 SQL Functions

### `get_list_by_share_code(share_code TEXT)`

**Purpose:** Find a list by share code, bypassing RLS

**Implementation:**
```sql
CREATE OR REPLACE FUNCTION get_list_by_share_code(share_code TEXT)
RETURNS TABLE (...)
LANGUAGE plpgsql
SECURITY DEFINER  -- Bypasses RLS
AS $$
BEGIN
  RETURN QUERY
  SELECT ... FROM public.lists l
  WHERE UPPER(TRIM(l.share_code)) = UPPER(TRIM($1));
END;
$$;
```

**Key Features:**
- `SECURITY DEFINER` allows bypassing RLS
- Case-insensitive search
- Trims whitespace
- Returns full list data

**File:** `create-share-code-function.sql`

---

## 🐛 Common Issues & Solutions

### Issue: "List not found with this share code"

**Possible Causes:**
1. **RPC function not deployed** - Run `create-share-code-function.sql` in Supabase
2. **Share code mismatch** - Check console logs for normalized code vs database
3. **RLS blocking direct query** - RPC function should work, but check RLS policies
4. **Case sensitivity** - SQL function now handles this, but verify

**Debug Steps:**
1. Check console logs for:
   - `🔍 Joining list with share code: ...`
   - `🔍 Normalized to: ...`
   - `🔍 Trying candidates: ...`
   - `✅ Found list via RPC` or `❌ RPC error`
2. Verify RPC function exists in Supabase:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'get_list_by_share_code';
   ```
3. Test RPC function directly:
   ```sql
   SELECT * FROM get_list_by_share_code('SAVR-H9DQXW');
   ```

### Issue: Lists not showing after joining

**Possible Causes:**
1. **Not reloading lists** - Context should reload after join
2. **RLS blocking** - User might not have access to view list
3. **Collaborator not added** - Check `collaborators` table

**Solution:**
- Check `lib/CollaborativeListsContext.tsx::joinListByCode()` - it calls `loadLists()` after successful join

---

## 📱 UI Components

### Join List Screen
- **File:** `app/join-list.tsx`
- User enters share code
- Calls `joinListByCode()` from context
- Shows success/error message

### Lists Screen
- **File:** `app/(tabs)/lists.tsx`
- Shows all user's lists (owned + collaborated)
- Can create new list
- Can join list by code

### List Detail Screen
- **File:** `app/list-detail.tsx`
- Shows list items, collaborators, share code
- Can add/edit/delete items
- Can toggle item completion
- Shows activity feed

---

## 🔄 Data Flow

```
User Action → Context → Service → Supabase → Database
                ↓
            Real-time Updates
                ↓
            UI Updates Automatically
```

**Example: Adding Item**
1. User adds item → `addItemToList()`
2. Context does optimistic update (immediate UI)
3. Service calls `addItem()` → Supabase insert
4. Real-time subscription fires → UI updates
5. Other collaborators see update in real-time

---

## ✅ Testing Checklist

- [ ] Create a new list → Verify share code generated
- [ ] Join list with share code → Verify list appears
- [ ] Add item to list → Verify appears for all collaborators
- [ ] Toggle item completion → Verify updates in real-time
- [ ] Delete item → Verify removed for all collaborators
- [ ] View collaborators → Verify all collaborators shown
- [ ] Test with invalid share code → Verify error message

---

## 🚀 Next Steps

1. **Verify RPC function is deployed** in Supabase
2. **Test with real share codes** from database
3. **Check console logs** for detailed debugging info
4. **Verify RLS policies** allow necessary operations

