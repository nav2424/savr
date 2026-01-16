# 🍳 Quick Recipe Setup - Easy Version!

Since the large `add-more-recipes.sql` file is hard to open, I've broken it into **4 smaller, easy-to-use files**!

---

## 📁 Smaller Files Created

Instead of one big file, you now have:

1. ✅ `add-breakfast-recipes.sql` - 2 breakfast recipes
2. ✅ `add-lunch-recipes.sql` - 4 lunch recipes  
3. ✅ `add-dinner-recipes.sql` - 5 dinner recipes
4. ✅ `add-snacks-desserts.sql` - 4 snacks & desserts

**Total: 15 new recipes** (same as the big file, just split up!)

---

## 🚀 How to Add Recipes (3 Easy Steps)

### Step 1: Open Supabase
1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Run Each File
For each of the 4 files, do this:

1. Open the file (much smaller now!)
2. Copy all the SQL code
3. Paste into Supabase SQL Editor
4. Click **Run** button

Repeat for all 4 files:
- ✅ Run `add-breakfast-recipes.sql`
- ✅ Run `add-lunch-recipes.sql`
- ✅ Run `add-dinner-recipes.sql`
- ✅ Run `add-snacks-desserts.sql`

### Step 3: Done!
You now have **18 recipes total** (3 original + 15 new)!

---

## 📋 What You'll Get

### Breakfast (2 recipes):
- 🍞 Avocado Toast with Poached Egg
- 🥣 Greek Yogurt Parfait

### Lunch (4 recipes):
- 🥗 Quinoa Buddha Bowl
- 🥪 Caprese Sandwich
- 🌯 Vegetarian Quesadilla
- 🍣 Ahi Tuna Poke Bowl

### Dinner (5 recipes):
- 🍗 Lemon Herb Baked Chicken
- 🍤 Garlic Butter Shrimp Pasta
- 🍛 Coconut Vegetable Curry
- 🍕 Classic Margherita Pizza
- 🍜 Pad Thai Noodles

### Snacks & Desserts (4 recipes):
- 🥕 Homemade Hummus with Veggie Sticks
- 🍫 No-Bake Energy Balls
- 🍫 Fudgy Chocolate Brownies
- 🍓 Refreshing Summer Fruit Salad

---

## ⚡ Even Faster: Run All at Once

If you want to run everything in one go:

### Option A: Copy-Paste Method
1. Open Supabase SQL Editor
2. Copy ALL the content from one of these files
3. Paste and run
4. Repeat for the other 3 files

### Option B: Direct SQL (All in One)
If the smaller files still don't open, I can give you a simple SQL command to run all 15 at once. Just let me know!

---

## ✅ Verify It Worked

After running the files, check in Supabase:

```sql
-- Run this to count recipes:
SELECT COUNT(*) FROM recipes;
-- Should show: 18

-- See all recipe titles:
SELECT title, meal_type FROM recipes ORDER BY meal_type;
```

---

## 🎉 Success!

Your recipe database now has:
- 3 original recipes (from initial setup)
- 15 new recipes (from these 4 files)
- **18 total recipes** ready to use!

---

## 💡 Tip

You can also:
- Run just the breakfast file if you only want those
- Pick and choose which types you want
- Run them all for the full collection!

Each file is independent and can be run separately.

---

**Need help?** If the files still won't open, just ask and I can provide an even simpler solution!

