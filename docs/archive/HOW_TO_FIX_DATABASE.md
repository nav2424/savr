# How to Fix the Database Infinite Recursion Error

## The Problem

You're seeing this error:
```
ERROR  Error loading lists: {"code": "42P17", "details": null, "hint": null, "message": "infinite recursion detected in policy for relation \"lists\""}
```

This is a **database-level issue** with your Supabase Row Level Security (RLS) policies, not a code issue.

## The Solution (5 minutes)

### Step 1: Open Supabase Dashboard

1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Open your SAVR project

### Step 2: Open SQL Editor

1. In the left sidebar, click **"SQL Editor"**
2. Click **"New query"** button

### Step 3: Run the Fix

1. Open the file **`CRITICAL_DATABASE_FIX.sql`** in your project
2. **Copy the ENTIRE contents** of that file
3. **Paste it** into the Supabase SQL Editor
4. Click **"Run"** (or press Cmd/Ctrl + Enter)

### Step 4: Verify Success

You should see a message like:
```
Success. No rows returned
```

This means the policies were updated successfully.

### Step 5: Test Your App

1. Restart your Expo development server:
   ```bash
   npx expo start --clear
   ```

2. The error should be gone and lists should load properly!

---

## What This Fix Does

The SQL script:
- ✅ Removes the circular RLS policies causing infinite recursion
- ✅ Creates new, simpler policies that don't reference each other
- ✅ Maintains the same security (users can only see their own lists)
- ✅ Enables collaborative lists to work properly

---

## Visual Guide

### Where to Find SQL Editor

```
Supabase Dashboard
├── Your Project Name
│   ├── Database
│   │   ├── Tables
│   │   └── → SQL Editor ← (Click here)
│   ├── Authentication
│   └── Storage
```

### What You'll See

```sql
-- The SQL Editor will look like this:
[New query button]

┌─────────────────────────────────────┐
│ -- Paste the SQL here              │
│ BEGIN;                              │
│ DROP POLICY IF EXISTS ...           │
│ ...                                 │
│ COMMIT;                             │
└─────────────────────────────────────┘

[Run button] (green button at the bottom right)
```

---

## Troubleshooting

### If you see "permission denied" error:
- Make sure you're the project owner
- Check that you're logged in to the correct Supabase account

### If the error persists after running SQL:
1. Wait 10-30 seconds for Supabase to apply changes
2. Clear your app cache: `npx expo start --clear`
3. Make sure the SQL ran successfully (check for error messages)

### If you're unsure if it worked:
Run this test query in SQL Editor:
```sql
SELECT * FROM lists LIMIT 1;
```

If it returns without errors, the fix worked!

---

## Why This Happened

The original RLS policies had a circular dependency:
- The `lists` policy checked the `collaborators` table
- The `collaborators` policy checked the `lists` table
- This created an infinite loop ♾️

The fix splits these into multiple independent policies that don't reference each other.

---

## Need Help?

If you're still having issues:
1. Take a screenshot of any error messages
2. Confirm you ran the entire SQL script
3. Check that you're in the correct Supabase project

The fix is straightforward and should work immediately once the SQL is run!

🎯 **Bottom line:** Copy `CRITICAL_DATABASE_FIX.sql` → Paste in Supabase SQL Editor → Click Run → Done!

