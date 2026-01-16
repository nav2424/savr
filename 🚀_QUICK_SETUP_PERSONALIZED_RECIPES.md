# 🚀 Quick Setup: Personalized Recipe System

## 📋 What Changed

Your recipe system is now **personalized and learning-based** instead of random!

---

## ⚡ Quick Setup (5 minutes)

### Step 1: Run Database Migration ⭐ REQUIRED

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste this file:
   ```
   docs/sql/add-recipe-interactions-table.sql
   ```
3. Click **Run**

**Why?** This creates the table that tracks your recipe interactions for learning.

---

### Step 2: That's It! ✨

The system automatically:
- ✅ Learns from recipes you cook
- ✅ Learns from recipes you save  
- ✅ Generates custom recipes from your pantry
- ✅ Shows stable, personalized suggestions

---

## 🎯 How to Use

### Make It Learn Your Preferences:

1. **Cook recipes** → Mark them as cooked in the app
2. **Save recipes you like** → Tap the save button
3. **Rate recipes** → Give 1-5 stars (low ratings hide recipes)
4. **Add pantry items** → Custom recipes auto-generate

### The System Will:

- Remember your favorite ingredients
- Remember your favorite cuisines
- Create recipes from YOUR pantry
- Hide recipes you don't like
- Keep similar recipes together (weekly rotation, not daily chaos)

---

## 📊 What Gets Tracked

Every time you interact with a recipe, the system learns:

| Action | What It Learns | Weight |
|--------|---------------|--------|
| **Cook recipe** | You LOVE these ingredients/cuisine | 3x (Most Important) |
| **Save recipe** | You're interested in this | 1.5x |
| **Rate 4-5 stars** | More like this please | Boost |
| **Rate 1-2 stars** | Hide this recipe | Hide |
| **Unsave** | Lost interest | Track |

---

## 🔥 Key Features

### 1. Learning-Based Personalization
- Tracks your cooking history
- Builds ingredient preference map
- Identifies favorite cuisines
- Weekly stable ordering (not daily random)

### 2. Pantry-Based Generation
- Creates recipes from YOUR items
- Smart ingredient grouping
- Multiple recipe strategies
- 100% pantry match

### 3. Continuous Improvement
- Gets smarter over time
- Adapts to your tastes
- Filters allergies/preferences
- No manual input needed

---

## 🎬 Example Workflow

### First Week:
```
Day 1: Add pantry items → See custom recipes
Day 2: Cook "Italian Chicken" → System notes you like Italian + chicken
Day 3: Save "Pasta Primavera" → System boosts Italian + pasta recipes
Day 4: Rate "Veggie Curry" 2 stars → Recipe hidden
```

### After 2 Weeks:
```
- Top ingredients: Chicken, Pasta, Tomatoes, Garlic
- Top cuisines: Italian, Mexican, American
- Recipes shown: Mostly Italian/Mexican chicken & pasta dishes
- Recipes hidden: Curry, unfamiliar cuisines you rated low
```

**Result:** Perfectly personalized recipe feed that matches YOUR actual cooking! 🎯

---

## 📁 Technical Details

### New Files Created:
- `lib/RecipePreferenceLearningService.ts` - Tracks interactions
- `lib/ImprovedRecipePersonalizationService.ts` - Stable personalization
- `lib/PantryBasedRecipeGenerator.ts` - Custom recipe generation
- `docs/sql/add-recipe-interactions-table.sql` - Database schema

### Modified Files:
- `lib/RecipesContext.tsx` - Uses learning system
- `app/(tabs)/recipes.tsx` - Generates pantry recipes

### Database:
- New table: `recipe_interactions`
- Stores: user actions, ratings, ingredients, cuisines
- Auto-cleans old data (keeps last 500 per user)

---

## ✅ Checklist

- [ ] Run SQL migration in Supabase
- [ ] Add items to pantry
- [ ] Cook/save a few recipes
- [ ] Watch the system learn!

---

## 🆘 Troubleshooting

**Q: Recipes still seem random?**
- ✅ Did you run the SQL migration?
- ✅ Have you cooked/saved any recipes yet?
- ✅ Check console logs for "Running IMPROVED recipe personalization"

**Q: No custom pantry recipes?**
- ✅ Add at least 3-4 items to pantry
- ✅ Include proteins, vegetables, or carbs
- ✅ Check console for "Generating recipes from your actual pantry"

**Q: Want to see what the system learned?**
- Check console logs for:
  - "User's favorite ingredients: ..."
  - "User's favorite cuisines: ..."
  - "Loaded preferences for user..."

---

## 📈 Expected Results

### After 1 Day:
- Custom recipes from your pantry appear
- System starts tracking your interactions

### After 1 Week:
- 5-10 cooked/saved recipes tracked
- Top 3-5 favorite ingredients identified
- Recipes become noticeably more relevant

### After 1 Month:
- 20+ recipes in history
- Clear cuisine/ingredient preferences
- Highly personalized recipe feed
- Stable weekly rotation

---

## 🎉 You're All Set!

The system is now learning from every recipe interaction. Just use the app normally and watch it get smarter! 🧠

**Read full documentation:** `📚_PERSONALIZED_RECIPES_COMPLETE.md`

