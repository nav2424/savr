# 🔧 Fix: SQL Migration Error

## ❌ Error You Saw

```
ERROR: 42710: policy "Users can view own recipe interactions" 
for table "recipe_interactions" already exists
```

## ✅ Solution

The table was partially created before. Use the **safe version** instead:

---

## 🚀 Run This Instead

### Step 1: Go to Supabase SQL Editor

### Step 2: Run This Safe Version

**File:** `docs/sql/add-recipe-interactions-table-safe.sql`

This version:
- ✅ Uses `IF NOT EXISTS` for table/indexes
- ✅ Drops existing policies before recreating
- ✅ Won't error if already partially exists

---

## 📋 What It Does

1. Creates table (only if missing)
2. Creates indexes (only if missing)
3. Drops old policies (if any)
4. Creates fresh policies
5. Sets permissions

---

## ✅ Expected Result

You should see:

```
Recipe interactions table setup complete! ✅
```

---

## 🎯 After Running

The personalized recipe system will work! The app will:
- ✅ Track recipe interactions
- ✅ Learn your preferences
- ✅ Generate pantry-based recipes
- ✅ Show personalized suggestions

---

## 🔍 Verify It Worked

Check in Supabase:
1. Go to **Table Editor**
2. Look for **recipe_interactions** table
3. Should have columns: id, user_id, recipe_id, action, rating, etc.

---

## 🆘 Still Having Issues?

If you still see errors, you can manually verify/fix:

### Check if table exists:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'recipe_interactions'
);
```

### Check RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'recipe_interactions';
```

### Check policies exist:
```sql
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'recipe_interactions';
```

You should see 4 policies (view, insert, update, delete).

---

## ✨ You're All Set!

Once the safe SQL runs successfully, your personalized recipe system is ready to learn! 🎉

