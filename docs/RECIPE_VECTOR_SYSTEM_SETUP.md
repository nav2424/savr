# 🚀 Recipe Vector Embeddings & Smart Surfacing System

Complete setup guide for the modern recipe recommendation system using vector embeddings and adaptive curation.

---

## 📋 Overview

This system implements the **Modern Approach: Dynamic AI + Smart Base Dataset**:

1. **Vector Embeddings** - Semantic search for recipe matching
2. **Recipe Remix Service** - AI-powered recipe adaptation
3. **Smart Surfacing Feeds** - 4 feed types for different use cases
4. **Base Dataset Import** - Tools to import curated recipes

---

## 🗄️ Step 1: Database Setup (Vector Embeddings)

### Run SQL Migration

1. Open **Supabase Dashboard**: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Open `docs/sql/recipes-vector-embeddings.sql`
4. Copy and paste the SQL code
5. Click **Run**

This will:
- ✅ Enable `pgvector` extension
- ✅ Add `embedding` column to `recipes` table
- ✅ Create vector similarity index
- ✅ Add semantic search functions

### Verify Setup

```sql
-- Check if extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check if embedding column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recipes' AND column_name = 'embedding';
```

---

## 📦 Step 2: Generate Embeddings for Existing Recipes

### Option A: Update Existing Recipes (Recommended)

```typescript
import { recipeImportService } from './lib/RecipeImportService'

// Update embeddings for recipes that don't have them
await recipeImportService.updateMissingEmbeddings(100)
```

### Option B: Use Import Script

```bash
# Update embeddings for existing recipes
npx ts-node scripts/import-recipes.ts embeddings 100
```

---

## 🎨 Step 3: Import Base Dataset

### Option A: Import Sample Recipes (For Testing)

```typescript
import { recipeImportService } from './lib/RecipeImportService'

// Generate and import 50 sample recipes
const samples = recipeImportService.generateSampleRecipes(50)
await recipeImportService.importRecipes(samples, userId, {
  generateEmbeddings: true,
  batchSize: 10,
})
```

### Option B: Import from JSON File

Create a JSON file with your curated recipes:

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
      { "name": "Eggs", "quantity": "4", "unit": "pieces" }
    ],
    "instructions": [
      { "step": 1, "description": "Cook pasta until al dente" }
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

Then import:

```bash
npx ts-node scripts/import-recipes.ts file ./recipes.json
```

### Option C: Import from Your Own Source

```typescript
import { recipeImportService } from './lib/RecipeImportService'

const recipes = [
  // Your recipe objects here
]

await recipeImportService.importRecipes(recipes, userId, {
  generateEmbeddings: true,
  batchSize: 10,
})
```

---

## 🎯 Step 4: Use Smart Surfacing Feeds

### Get All Feeds

```typescript
import { recipeFeedService } from './lib/RecipeFeedService'
import { useAuth } from './lib/AuthContext'
import { usePantry } from './lib/PantryContext'

function MyRecipeScreen() {
  const { user } = useAuth()
  const { pantryItems } = usePantry()
  const [feeds, setFeeds] = useState(null)

  useEffect(() => {
    async function loadFeeds() {
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

    if (user) loadFeeds()
  }, [user, pantryItems])

  return (
    <View>
      <Text>Daily Matches: {feeds?.dailyMatches.length}</Text>
      <Text>Smart Suggestions: {feeds?.smartSuggestions.length}</Text>
      <Text>Weekly Plan: {feeds?.weeklyPlan.length}</Text>
      <Text>Surprise Me: {feeds?.surpriseMe.length}</Text>
    </View>
  )
}
```

### Get Individual Feed Types

```typescript
// Daily Matches (5-10 recipes with max pantry overlap)
const dailyMatches = await recipeFeedService.getDailyMatches(context, 8)

// Smart Suggestions ("Add 1 ingredient to unlock")
const suggestions = await recipeFeedService.getSmartSuggestions(context, 5)

// Weekly Plan (7 balanced meals)
const weeklyPlan = await recipeFeedService.getWeeklyPlan(context)

// Surprise Me (creative fusion recipes)
const surprises = await recipeFeedService.getSurpriseMe(context, 3)
```

---

## 🔄 Step 5: Use Recipe Remix Service

### Remix Recipes Based on Context

```typescript
import { recipeRemixService } from './lib/RecipeRemixService'

const remixedRecipes = await recipeRemixService.remixRecipes({
  userId: user.id,
  pantryItems: pantryItems,
  allergies: ['dairy'],
  dietaryPreferences: ['vegetarian'],
  householdSize: 4,
  cuisinePreferences: ['Italian', 'Mediterranean'],
}, 5)

// remixedRecipes will have:
// - Scaled ingredients for household size
// - Substituted ingredients based on pantry
// - Pantry match scores
// - Substitution details
```

### Remix Specific Recipe

```typescript
const remixed = await recipeRemixService.remixRecipeById(
  recipeId,
  context
)
```

---

## 🔍 Step 6: Use Semantic Search

```typescript
import { recipeEmbeddingService } from './lib/RecipeEmbeddingService'

// Search recipes by natural language query
const results = await recipeEmbeddingService.searchRecipesByQuery(
  'quick vegetarian pasta with tomatoes',
  {
    limit: 10,
    threshold: 0.7,
    allergies: ['dairy'],
    dietary: ['vegetarian'],
    mealType: 'dinner',
  }
)
```

---

## 📊 Feed Types Explained

### 1. Daily Matches
- **Frequency**: Every morning
- **Count**: 5-10 recipes
- **Logic**: Maximum pantry overlap
- **Use Case**: "What can I make with what I have?"

### 2. Smart Suggestions
- **Frequency**: Dynamic
- **Count**: 5 recipes
- **Logic**: "Add 1 ingredient to unlock"
- **Use Case**: "Almost there - what's missing?"

### 3. Weekly Plan
- **Frequency**: Every Sunday
- **Count**: 7 recipes (one per day)
- **Logic**: Balanced meals across the week
- **Use Case**: "Plan my week"

### 4. Surprise Me
- **Frequency**: On-demand
- **Count**: 3 recipes
- **Logic**: Creative fusion recipes
- **Use Case**: "I want something new and exciting"

---

## 🎯 Integration with Existing Code

### Update RecipesContext

```typescript
// In lib/RecipesContext.tsx
import { recipeFeedService } from './RecipeFeedService'

// Add method to load feeds
const loadFeeds = async () => {
  const feeds = await recipeFeedService.getAllFeeds({
    userId: user.id,
    pantryItems: pantryItems,
    allergies: preferences.dietary.allergies,
    dietaryPreferences: preferences.dietary.preferences,
    householdSize: parseInt(preferences.household.size || '2'),
  })
  // Use feeds in your UI
}
```

### Update Recipe Screen

```typescript
// In app/(tabs)/recipes.tsx
import { recipeFeedService } from '../../lib/RecipeFeedService'

// Display different feed types
const [feedType, setFeedType] = useState<FeedType>('daily_matches')
const [recipes, setRecipes] = useState([])

useEffect(() => {
  async function loadRecipes() {
    const context = { /* ... */ }
    
    let feedRecipes = []
    switch (feedType) {
      case 'daily_matches':
        feedRecipes = await recipeFeedService.getDailyMatches(context, 8)
        break
      case 'smart_suggestions':
        feedRecipes = await recipeFeedService.getSmartSuggestions(context, 5)
        break
      case 'weekly_plan':
        feedRecipes = await recipeFeedService.getWeeklyPlan(context)
        break
      case 'surprise_me':
        feedRecipes = await recipeFeedService.getSurpriseMe(context, 3)
        break
    }
    
    setRecipes(feedRecipes)
  }
  
  loadRecipes()
}, [feedType])
```

---

## 💰 Cost Considerations

### OpenAI Embeddings API

- **Model**: `text-embedding-3-small`
- **Cost**: ~$0.02 per 1M tokens
- **Per Recipe**: ~500-1000 tokens = $0.00001-0.00002 per recipe
- **1000 Recipes**: ~$0.01-0.02

### Recommendation

- Generate embeddings **once** when importing recipes
- Cache embeddings in database
- Only regenerate if recipe significantly changes

---

## 🚨 Troubleshooting

### "Extension vector does not exist"
- Run the SQL migration in Supabase SQL Editor
- Make sure you're using Supabase (pgvector is built-in)

### "Embedding generation fails"
- Check OpenAI API key in `config.ts`
- Verify API quota/billing
- Check network connectivity

### "No recipes found in search"
- Ensure recipes have embeddings generated
- Lower the `threshold` parameter (try 0.5)
- Check that recipes are marked `is_public = true`

### "Slow performance"
- Increase HNSW index lists parameter (for 1000+ recipes)
- Use batch processing for embeddings
- Cache feed results (already implemented)

---

## ✅ Success Checklist

- [ ] pgvector extension enabled
- [ ] Embedding column added to recipes table
- [ ] Semantic search function created
- [ ] Embeddings generated for existing recipes
- [ ] Base dataset imported (1k-2k recipes recommended)
- [ ] Feed service integrated in UI
- [ ] Remix service working
- [ ] All feed types displaying correctly

---

## 🎉 Next Steps

1. **Curate Base Dataset**: Import 1,000-2,000 quality recipes
2. **Monitor Performance**: Check embedding generation costs
3. **A/B Test Feeds**: See which feed types users engage with most
4. **Self-Expansion**: Save user-remixed recipes to grow the dataset
5. **User Feedback Loop**: Track which recipes users actually cook

---

## 📚 API Reference

### RecipeEmbeddingService
- `generateEmbedding(recipe)` - Generate embedding for recipe
- `searchRecipesByQuery(query, options)` - Semantic search
- `generateAndSaveEmbedding(recipe)` - Generate and save

### RecipeRemixService
- `remixRecipes(context, count)` - Remix multiple recipes
- `remixRecipeById(recipeId, context)` - Remix single recipe

### RecipeFeedService
- `getDailyMatches(context, count)` - Daily feed
- `getSmartSuggestions(context, count)` - Suggestions feed
- `getWeeklyPlan(context)` - Weekly plan
- `getSurpriseMe(context, count)` - Surprise feed
- `getAllFeeds(context)` - All feeds at once

### RecipeImportService
- `importRecipe(recipe, userId, generateEmbedding)` - Import single
- `importRecipes(recipes, userId, options)` - Import batch
- `importFromJSON(jsonData, userId, options)` - Import from JSON
- `updateMissingEmbeddings(limit)` - Update existing recipes

---

**🎯 You're ready to build the modern recipe recommendation system!**

