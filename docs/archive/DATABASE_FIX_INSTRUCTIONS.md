# 🔧 Database Fix Instructions

## Errors Found

1. ❌ **Missing `scanned_products` table** - Barcode scanning can't save products
2. ❌ **Push tokens RLS policy issue** - Can't save notification tokens

## Quick Fix (Run This Now)

### Option 1: Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `fix-barcode-and-push-tokens.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

### Option 2: Command Line

```bash
# If you have Supabase CLI installed
supabase db execute < fix-barcode-and-push-tokens.sql

# Or push to your remote project
supabase db push
```

### Option 3: Manual SQL Execution

Copy this SQL and run it in your Supabase SQL editor:

```sql
-- See fix-barcode-and-push-tokens.sql file
```

## What This Fixes

### 1. Barcode Scanning Database
✅ Creates `scanned_products` table for your proprietary product database
✅ Creates `user_scanned_history` table for tracking scans
✅ Sets up proper RLS policies (anyone can read, authenticated can insert)
✅ Adds indexes for fast lookups
✅ Creates automatic timestamp updates

### 2. Push Notifications
✅ Fixes RLS policies on `push_tokens` table
✅ Allows users to save their own notification tokens
✅ Maintains security (users can only access their own tokens)

## Verify It Worked

After running the SQL, test:

1. **Barcode Scanning**: Scan a product → should save without errors
2. **Push Tokens**: App should start without push token errors

Check the logs - you should see:
- ✅ No more "Could not find the table 'scanned_products'" errors
- ✅ No more "row violates row-level security policy" errors for push_tokens

## Understanding the Error

### Error 1: Missing Table
```
Could not find the table 'public.scanned_products' in the schema cache
```
**Cause**: The database migration wasn't run when setting up barcode scanning
**Fix**: The SQL creates the table with proper structure

### Error 2: RLS Policy
```
new row violates row-level security policy (USING expression) for table "push_tokens"
```
**Cause**: The RLS policy was too restrictive or incorrectly configured
**Fix**: Updated policies to allow authenticated users to manage their own tokens

## Database Schema Created

### `scanned_products` Table
```sql
barcode          TEXT (unique)     -- Product barcode
product_data     JSONB            -- All product info (nutrition, etc.)
name             TEXT             -- Product name
brand            TEXT             -- Brand name
category         TEXT             -- Category (Produce, Dairy, etc.)
created_at       TIMESTAMP        -- When first scanned
updated_at       TIMESTAMP        -- Last update
```

**Purpose**: Your proprietary product database that grows with usage

### `user_scanned_history` Table
```sql
user_id          UUID             -- Which user scanned
barcode          TEXT             -- What they scanned
product_name     TEXT             -- Product name
scanned_at       TIMESTAMP        -- When they scanned
added_to_pantry  BOOLEAN         -- Did they add it to pantry
```

**Purpose**: Track user scanning behavior and build your database

## Security (RLS Policies)

✅ **scanned_products**: 
- Anyone can READ (community-shared products)
- Authenticated users can INSERT/UPDATE (contribute products)

✅ **user_scanned_history**:
- Users can only access their own scan history
- Maintains privacy while building database

✅ **push_tokens**:
- Users can only manage their own tokens
- Secure notification delivery

## After Running the Fix

Your app will now:
1. ✅ Save scanned products to YOUR database
2. ✅ Build proprietary product database automatically
3. ✅ Handle push notifications correctly
4. ✅ Track user scanning behavior

## Monitoring Database Growth

Check your database growth with:

```sql
-- Total products in YOUR database
SELECT COUNT(*) as total_products FROM scanned_products;

-- Products added today
SELECT COUNT(*) as today_products 
FROM scanned_products 
WHERE created_at >= CURRENT_DATE;

-- Most scanned products
SELECT 
  sp.name, 
  sp.brand,
  COUNT(ush.id) as scan_count
FROM scanned_products sp
JOIN user_scanned_history ush ON sp.barcode = ush.barcode
GROUP BY sp.id, sp.name, sp.brand
ORDER BY scan_count DESC
LIMIT 10;

-- User contribution stats
SELECT 
  user_id,
  COUNT(*) as products_scanned,
  COUNT(DISTINCT barcode) as unique_products
FROM user_scanned_history
GROUP BY user_id
ORDER BY products_scanned DESC;
```

## Troubleshooting

**Still seeing errors after running SQL?**

1. **Refresh Supabase schema cache**:
   - In Supabase dashboard, go to Database > Tables
   - Click refresh icon
   - Restart your app

2. **Check if tables exist**:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('scanned_products', 'user_scanned_history', 'push_tokens');
   ```

3. **Verify RLS policies**:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename IN ('scanned_products', 'user_scanned_history', 'push_tokens');
   ```

**App still crashing?**
- Clear app cache and restart
- Uninstall and reinstall app
- Check Supabase logs for specific errors

## What Happens Next

Once fixed, your barcode scanning will:

1. **Scan product** → Check YOUR database first (instant)
2. **Not found?** → Check Open Food Facts API (~500ms)
3. **Found via API?** → Save to YOUR database automatically
4. **Next scan** → Instant lookup from YOUR database!

Within weeks, you'll have thousands of products in YOUR proprietary database, and most scans will be instant! 🚀

