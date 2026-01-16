# 🖼️ Fix Recipe Images - Quick Guide

## Problem
Some recipes (Homemade Hummus, Garlic Butter Shrimp Pasta) show no images on the dashboard.

## Solution

### Option 1: Run SQL Script (Recommended - 1 minute)

**In Supabase Dashboard:**
1. Go to **SQL Editor**
2. Open `fix-recipe-images.sql`
3. Copy all contents
4. Click **Run**

This will:
- ✅ Add images to Homemade Hummus
- ✅ Add images to Garlic Butter Shrimp Pasta
- ✅ Add images to any other recipes missing them
- ✅ Set category-based default images (salad, pasta, chicken, etc.)
- ✅ Add generic food image for any remaining recipes

### Option 2: Manual Fix (2 minutes)

Run these two commands in Supabase SQL Editor:

```sql
-- Fix Garlic Butter Shrimp Pasta
UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80'
WHERE title = 'Garlic Butter Shrimp Pasta';

-- Fix Homemade Hummus
UPDATE recipes 
SET image_url = 'https://images.unsplash.com/photo-1571490004784-ddd2f34055bf?w=800&q=80'
WHERE title = 'Homemade Hummus with Veggie Sticks';
```

### Option 3: Check If Recipes Exist

If the above doesn't work, the recipes might not be in the database yet. Check with:

```sql
SELECT title, image_url FROM recipes 
WHERE title IN ('Garlic Butter Shrimp Pasta', 'Homemade Hummus with Veggie Sticks');
```

If they don't exist, run the recipe import SQL:
```bash
# Run these in order:
supabase db execute < add-dinner-recipes.sql
supabase db execute < add-snacks-desserts.sql
```

## What Gets Fixed

The SQL script adds high-quality Unsplash images for:

- 🍤 **Garlic Butter Shrimp Pasta** → Shrimp pasta image
- 🥕 **Homemade Hummus** → Hummus with veggies image
- 🥗 **Salads** → Fresh salad images
- 🍔 **Burgers** → Burger images
- 🍕 **Pizza** → Pizza images
- 🥞 **Pancakes** → Pancake images
- 🍞 **Toast** → Toast images
- 🥦 **Vegetable dishes** → Veggie images
- 🌯 **Burritos/Tacos** → Mexican food images
- 🍜 **Stir-fry** → Asian cuisine images
- 🍲 **Soups** → Soup images
- 🍝 **Pasta** → Pasta images
- 🍗 **Chicken** → Chicken dish images
- 🐟 **Salmon/Fish** → Seafood images
- 🍫 **Brownies/Chocolate** → Chocolate desserts
- 🍪 **Cookies** → Cookie images
- 🍳 **Breakfast** → Breakfast images
- 🍽️ **Other recipes** → Generic food image

## Verify It Worked

After running the SQL:

1. **Refresh the app** (pull down on dashboard)
2. **Check dashboard** - all recipe cards should show images
3. **No more food emoji fallbacks** - only real images

## Why This Happened

The recipes were added to the database but the `image_url` column was:
- Empty string (`''`)
- NULL value
- Not properly imported

The fix script updates all recipes to ensure they have valid image URLs.

## Alternative: Use Recipe Import Scripts

If you haven't imported recipes yet, they come with images already:

```bash
# These scripts include image URLs:
supabase db execute < add-breakfast-recipes.sql
supabase db execute < add-lunch-recipes.sql
supabase db execute < add-dinner-recipes.sql
supabase db execute < add-snacks-desserts.sql
supabase db execute < add-more-recipes.sql
```

Each recipe in these files has a pre-defined Unsplash image URL.

## Quick Check Query

See which recipes are missing images:

```sql
SELECT title, image_url 
FROM recipes 
WHERE image_url IS NULL OR image_url = ''
ORDER BY title;
```

Run the fix script and this should return 0 rows!

---

**TL;DR:** Run `fix-recipe-images.sql` in Supabase SQL Editor → All recipes will have images → No more food emoji fallbacks! 🎉

