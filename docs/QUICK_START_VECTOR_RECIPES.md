# 🚀 Quick Start: Vector Recipe System

## ✅ You've Run the SQL Migration - What's Next?

---

## Step 1: Generate Embeddings for Existing Recipes

If you already have recipes in your database, generate embeddings for them:

### Option A: Use the Setup Script (Recommended)

```bash
npx ts-node scripts/setup-vector-recipes.ts
```

This will:
- ✅ Check for existing recipes
- ✅ Generate embeddings for recipes that don't have them
- ✅ Import 20 sample recipes if your database is empty
- ✅ Verify everything is set up correctly

### Option B: Manual Update

```typescript
import { recipeImportService } from './lib/RecipeImportService'

// Update embeddings for up to 100 recipes
await recipeImportService.updateMissingEmbeddings(100)
```

---

## Step 2: Import Base Dataset

You need **1,000-2,000 quality recipes** for the system to work optimally.

### Option A: Import Sample Recipes (For Testing)

```bash
npx ts-node scripts/import-recipes.ts samples 50
```

This generates 50 sample recipes. Good for testing, but you'll want real recipes for production.

### Option B: Import from JSON File

1. Create a JSON file with your recipes:

```json
[
  {
    "title": "Classic Pasta Carbonara",
    "description": "Traditional Italian pasta dish",
    "cuisine_type": "Italian",
    "meal_type": "dinner",
    "difficulty": "Medium",
    "prep_time": 10,
    "cook_time": 20,
    "servings": 4,
    "ingredients": [
      { "name": "Spaghetti", "quantity": "1", "unit": "lb" },
      { "name": "Eggs", "quantity": "4", "unit": "pieces" },
      { "name": "Pancetta", "quantity": "8", "unit": "oz" }
    ],
    "instructions": [
      { "step": 1, "description": "Cook pasta until al dente" },
      { "step": 2, "description": "Cook pancetta until crispy" }
    ],
    "calories": 520,
    "protein": 28,
    "carbs": 65,
    "fat": 18,
    "tags": ["italian", "pasta", "dinner"],
    "source": "curated"
  }
]
```

2. Import it:

```bash
npx ts-node scripts/import-recipes.ts file ./recipes.json
```

---

## Step 3: Integrate Feeds in Your App

Add the smart surfacing feeds to your Recipes screen:

```typescript
// In your Recipes screen or component
import { recipeFeedService } from '../lib/RecipeFeedService'
import { useAuth } from '../lib/AuthContext'
import { usePantry } from '../lib/PantryContext'

function RecipesScreen() {
  const { user } = useAuth()
  const { items: pantryItems } = usePantry()
  const [feeds, setFeeds] = useState(null)

  useEffect(() => {
    async function loadFeeds() {
      if (!user) return

      const allFeeds = await recipeFeedService.getAllFeeds({
        userId: user.id,
        pantryItems: pantryItems.map(item => ({
          name: item.name,
          qty: item.qty,
          unit: item.unit,
          category: item.category,
        })),
        allergies: user.preferences?.dietary?.allergies || [],
        dietaryPreferences: user.preferences?.dietary?.preferences || [],
        householdSize: parseInt(user.preferences?.household?.size || '2'),
        cuisinePreferences: user.preferences?.dietary?.cuisines || [],
      })

      setFeeds(allFeeds)
    }

    loadFeeds()
  }, [user, pantryItems])

  // Display feeds
  return (
    <View>
      <Text>Daily Matches ({feeds?.dailyMatches.length || 0})</Text>
      {/* Render dailyMatches */}
      
      <Text>Smart Suggestions ({feeds?.smartSuggestions.length || 0})</Text>
      {/* Render smartSuggestions */}
      
      <Text>Weekly Plan ({feeds?.weeklyPlan.length || 0})</Text>
      {/* Render weeklyPlan */}
    </View>
  )
}
```

---

## ⚡ Quick Commands Reference

```bash
# Setup everything (check + update embeddings + import samples)
npx ts-node scripts/setup-vector-recipes.ts

# Import sample recipes
npx ts-node scripts/import-recipes.ts samples 50

# Import from JSON file
npx ts-node scripts/import-recipes.ts file ./recipes.json

# Update embeddings for existing recipes
npx ts-node scripts/import-recipes.ts embeddings 100
```

---

**🎉 You're all set! Start with the setup script.**
