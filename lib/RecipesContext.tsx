// SAVR Recipes Context - Real-time recipe management with Supabase
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase, Recipe, SavedRecipe, RecipeIngredient, RecipeInstruction } from './supabase'
import { useAuth } from './AuthContext'
import { usePantry } from './PantryContext'
import { ingredientMatchingService, IngredientMatch } from './IngredientMatchingService'
import { ingredientUnitService } from './IngredientUnitService'
import { improvedRecipePersonalizationService } from './ImprovedRecipePersonalizationService'
import { recipePreferenceLearningService } from './RecipePreferenceLearningService'
import { userPreferencesService } from './UserPreferencesService'
import { debounce, runAsync } from './PerformanceOptimizer'
import { aiRecipeGenerator } from './AIRecipeGenerator'
import { pantryNormalizationService, getNormalizedPantry, normName, isStaple } from './PantryNormalizationService'
import { matchIngredient as simpleMatchIngredient, scoreRecipe as simpleScoreRecipe } from './SimpleIngredientMatcher'
import { nutritionCalculatorService } from './NutritionCalculatorService'

// Recipe cache storage keys
const RECIPE_CACHE_KEY = 'savr_cached_recipes'
const RECIPE_CACHE_METADATA_KEY = 'savr_cached_recipes_metadata'

interface RecipeCacheMetadata {
  pantryHash: string
  timestamp: number
  userId: string
}

// Helper function to save recipes to cache
async function saveRecipesToCache(recipes: Recipe[], pantryHash: string, userId: string): Promise<void> {
  try {
    if (recipes.length > 0) {
      const metadata: RecipeCacheMetadata = {
        pantryHash,
        timestamp: Date.now(),
        userId
      }
      await Promise.all([
        AsyncStorage.setItem(RECIPE_CACHE_KEY, JSON.stringify(recipes)),
        AsyncStorage.setItem(RECIPE_CACHE_METADATA_KEY, JSON.stringify(metadata))
      ])
      console.log(`💾 Saved ${recipes.length} recipes to cache (pantry hash: ${pantryHash.substring(0, 20)}...)`)
    }
  } catch (error) {
    console.error('❌ Error saving recipes to cache:', error)
    // Don't throw - caching is non-critical
  }
}

// Helper function to load recipes from cache
async function loadRecipesFromCache(userId: string): Promise<{ recipes: Recipe[]; metadata: RecipeCacheMetadata } | null> {
  try {
    const [cachedRecipesJson, metadataJson] = await Promise.all([
      AsyncStorage.getItem(RECIPE_CACHE_KEY),
      AsyncStorage.getItem(RECIPE_CACHE_METADATA_KEY)
    ])
    
    if (cachedRecipesJson && metadataJson) {
      const cachedRecipes: Recipe[] = JSON.parse(cachedRecipesJson)
      const metadata: RecipeCacheMetadata = JSON.parse(metadataJson)
      
      // Only return cached recipes if they're for the same user
      if (metadata.userId === userId && cachedRecipes.length > 0) {
        return { recipes: cachedRecipes, metadata }
      }
    }
  } catch (error) {
    console.error('❌ Error loading cached recipes:', error)
  }
  
  return null
}

// Helper to check if a unit is an inventory unit (not a recipe unit)
function isInventoryUnit(unit: string): boolean {
  if (!unit) return false
  const unitLower = unit.toLowerCase().trim()
  const inventoryUnits = [
    'bottle', 'bottles',
    'bag', 'bags',
    'container', 'containers',
    'box', 'boxes',
    'pack', 'packs',
    'package', 'packages',
    'jar', 'jars',
    'can', 'cans',
    'carton', 'cartons',
    'tube', 'tubes',
    'roll', 'rolls'
  ]
  return inventoryUnits.includes(unitLower)
}
// import { dynamicRecipeAIService } from './DynamicRecipeAIService' // DISABLED: Using DynamicPantryRecipeGenerator instead
// import { personalizedRecipeService } from './PersonalizedRecipeService' // DISABLED: Using DynamicPantryRecipeGenerator instead

interface RecipesContextType {
  // Recipes
  recipes: Recipe[]
  savedRecipes: SavedRecipe[]
  loading: boolean
  error: string | null
  
  // Recipe operations
  getRecipeById: (id: string) => Promise<Recipe | null>
  searchRecipes: (query: string) => Recipe[]
  filterRecipes: (filters: RecipeFilters) => Recipe[]
  
  // Saved recipe operations
  saveRecipe: (recipeId: string) => Promise<boolean>
  unsaveRecipe: (recipeId: string) => Promise<boolean>
  updateSavedRecipe: (recipeId: string, updates: Partial<SavedRecipe>) => Promise<boolean>
  rateRecipe: (recipeId: string, rating: number) => Promise<boolean>
  markRecipeCooked: (recipeId: string) => Promise<boolean>
  toggleFavorite: (recipeId: string) => Promise<boolean>
  
  // Recipe creation
  createRecipe: (recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => Promise<Recipe | null>
  updateRecipe: (recipeId: string, updates: Partial<Recipe>) => Promise<boolean>
  deleteRecipe: (recipeId: string) => Promise<boolean>
  
  // AI Generation
  generateRecipeFromPantry: (preferences?: {
    mealType?: string
    difficulty?: string
    dietaryRestrictions?: string[]
    servings?: number
  }) => Promise<Recipe | null>
  
  // Helper functions
  calculateIngredientMatch: (recipe: Recipe) => number
  getMissingIngredients: (recipe: Recipe) => string[]
  getRecipesByMealType: (mealType: string) => Recipe[]
  getRecipesByDifficulty: (difficulty: string) => Recipe[]
  getFavoriteRecipes: () => SavedRecipe[]
  getCookedRecipes: () => SavedRecipe[] // Returns recipes that have been cooked (times_cooked > 0)
  getSuggestedRecipes: () => Recipe[] // Returns recipes sorted by match percentage for dashboard/recipes sync
  
  // Refresh
  refreshRecipes: () => Promise<void>
  regenerateAIRecipes: () => Promise<void>
  clearAndRegenerateRecipes: () => Promise<void>
}

interface RecipeFilters {
  mealType?: string
  difficulty?: string
  maxTime?: number
  tags?: string[]
  minIngredientMatch?: number
}

const RecipesContext = createContext<RecipesContextType | undefined>(undefined)

const RECIPE_GENERATION_COOLDOWN_MS = 2 * 60 * 1000 // 2 minutes

// Validation function to filter out unrealistic recipes
function isRealisticRecipe(recipe: Recipe): boolean {
  if (!recipe.title || !recipe.ingredients || recipe.ingredients.length === 0) {
    return false
  }

  const titleLower = recipe.title.toLowerCase()
  const ingredientsLower = recipe.ingredients.map(ing => ing.name.toLowerCase())
  const allText = `${titleLower} ${ingredientsLower.join(' ')}`

  // Blacklist of unrealistic combinations
  const unrealisticPatterns = [
    // Sweet potato in smoothies/bowls with berries (not a real combination)
    /sweet potato.*(smoothie|smoothie bowl|berry|berries|raspberry|strawberry|blueberry)/i,
    /(smoothie|smoothie bowl).*sweet potato/i,
    
    // Other nonsensical combinations
    /tofu.*smoothie/i,
    /chocolate.*marinara/i,
    /(smoothie|smoothie bowl).*potato/i,
    /potato.*(smoothie|smoothie bowl)/i,
    /(smoothie|smoothie bowl).*chicken/i,
    /chicken.*(smoothie|smoothie bowl)/i,
    /(smoothie|smoothie bowl).*beef/i,
    /beef.*(smoothie|smoothie bowl)/i,
    /(smoothie|smoothie bowl).*fish/i,
    /fish.*(smoothie|smoothie bowl)/i,
    /(smoothie|smoothie bowl).*salmon/i,
    /salmon.*(smoothie|smoothie bowl)/i,
    
    // Savory ingredients in sweet contexts
    /(smoothie|smoothie bowl|dessert|pudding|ice cream).*(garlic|onion|salt|pepper|soy sauce|vinegar)/i,
    
    // Sweet ingredients in savory contexts (some exceptions allowed)
    /(chocolate|sugar|candy).*(pasta|rice|chicken|beef|fish|salmon)/i,
  ]

  // Check against blacklist
  for (const pattern of unrealisticPatterns) {
    if (pattern.test(allText)) {
      console.warn(`❌ Rejecting unrealistic recipe: "${recipe.title}" - matches pattern: ${pattern}`)
      return false
    }
  }

  // Additional validation: smoothie bowls should have appropriate ingredients
  if (titleLower.includes('smoothie') || titleLower.includes('smoothie bowl')) {
    const hasFruit = ingredientsLower.some(ing => 
      ing.includes('berry') || ing.includes('banana') || ing.includes('mango') || 
      ing.includes('apple') || ing.includes('peach') || ing.includes('pineapple') ||
      ing.includes('strawberry') || ing.includes('blueberry') || ing.includes('raspberry')
    )
    const hasInappropriate = ingredientsLower.some(ing =>
      ing.includes('potato') || ing.includes('sweet potato') || ing.includes('chicken') ||
      ing.includes('beef') || ing.includes('fish') || ing.includes('salmon') ||
      ing.includes('garlic') || ing.includes('onion')
    )
    
    if (hasInappropriate || !hasFruit) {
      console.warn(`❌ Rejecting unrealistic smoothie recipe: "${recipe.title}" - inappropriate ingredients`)
      return false
    }
  }

  // Ensure recipe has reasonable structure
  if (recipe.ingredients.length < 2) {
    console.warn(`❌ Rejecting recipe with too few ingredients: "${recipe.title}"`)
    return false
  }

  return true
}

// Helper function to determine ingredient importance for weighted matching
function getIngredientImportance(ingredientName: string): 'critical' | 'important' | 'optional' {
  // CRITICAL: Main proteins and carbs (can't make dish without these) - Weight: 3x
  const criticalKeywords = [
    'chicken', 'beef', 'pork', 'salmon', 'fish', 'shrimp', 'turkey', 'lamb', 'duck',
    'pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine',
    'rice', 'noodles', 'ramen', 'udon',
    'tortilla', 'bread', 'bun', 'roll',
    'quinoa', 'couscous', 'bulgur',
    'eggs', 'tofu', 'tempeh'
  ]
  
  // IMPORTANT: Flavor builders, vegetables, dairy (makes the dish what it is) - Weight: 2x
  const importantKeywords = [
    'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta',
    'sauce', 'salsa', 'pesto', 'marinara',
    'broth', 'stock',
    'onion', 'garlic', 'ginger', 'shallot',
    'tomato', 'pepper', 'bell pepper', 'jalapeño',
    'mushroom', 'zucchini', 'eggplant', 'squash',
    'lettuce', 'spinach', 'kale', 'cabbage', 'arugula',
    'butter', 'oil', 'olive oil', 'coconut oil',
    'milk', 'cream', 'yogurt', 'sour cream',
    'beans', 'chickpeas', 'lentils'
  ]
  
  // Check critical first
  if (criticalKeywords.some(keyword => ingredientName.includes(keyword))) {
    return 'critical'
  }
  
  // Check important
  if (importantKeywords.some(keyword => ingredientName.includes(keyword))) {
    return 'important'
  }
  
  // Everything else is optional (seasonings, garnishes) - Weight: 1x
  // salt, pepper, cumin, paprika, cilantro, lime, lemon, etc.
  return 'optional'
}

export function RecipesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { items: pantryItems } = usePantry()
  
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([])
  const [loading, setLoading] = useState(false) // Start as false - we'll load cached recipes first
  const [error, setError] = useState<string | null>(null)

  const generationLockRef = useRef(false)
  const currentRunIdRef = useRef<string | null>(null)
  const lastGenerationAtRef = useRef<number>(0)
  const lastRunAtRef = useRef<number>(0)
  const pendingRetryRef = useRef<NodeJS.Timeout | null>(null)
  const loadRecipesRef = useRef<((options?: { force?: boolean; reason?: string }) => Promise<void>) | null>(null)
  const COOLDOWN_MS = 2000 // 2 second cooldown between runs

  // Helper function to calculate match for generated recipes
  // CRITICAL: Uses normalized pantry at match time (single source of truth)
  const calculateIngredientMatchForGeneratedRecipe = (ingredientNames: string[], pantryItems: PantryItem[]): number => {
    if (!ingredientNames || ingredientNames.length === 0) {
      console.warn('⚠️ No ingredients provided for match calculation')
      return 0
    }
    if (!pantryItems || pantryItems.length === 0) {
      console.warn('⚠️ No pantry items available for match calculation')
      return 0
    }

    // CRITICAL: Normalize pantry at match time, not earlier
    const normalizedPantry = getNormalizedPantry(pantryItems)
    
    // De-duplicate ingredients by normalized name
    const seenIngredients = new Set<string>()
    const uniqueIngredients: string[] = []
    for (const ing of ingredientNames) {
      const normalized = normName(ing)
      if (!seenIngredients.has(normalized)) {
        seenIngredients.add(normalized)
        uniqueIngredients.push(ing)
      }
    }

    // Filter out staples - they don't count as required
    const requiredIngredients = uniqueIngredients
      .map(normName)
      .filter(ing => !isStaple(ing))

    if (requiredIngredients.length === 0) {
      // All ingredients are staples - consider it 100% match
      return 100
    }

    console.log(`🔍 Calculating match for generated recipe:`)
    console.log(`   Recipe ingredients (required): ${requiredIngredients.join(', ')}`)
    console.log(`   Pantry items (normalized, qty>0): ${normalizedPantry.map(i => `${i.name} (${i.quantity})`).join(', ')}`)
    
    let matchedCount = 0
    let matchesFound: string[] = []
    let missesFound: string[] = []

    for (const ingredientName of requiredIngredients) {
      const match = simpleMatchIngredient(ingredientName, normalizedPantry)
      
      if (match.type === 'staple') {
        // Shouldn't happen since we filtered, but handle it
        continue
      } else if (match.type === 'missing') {
        missesFound.push(`${ingredientName} (no match found)`)
      } else {
        matchedCount++
        const matchDesc = match.type === 'exact' 
          ? `${ingredientName} → ${match.item.name} (exact)`
          : match.type === 'alias'
          ? `${ingredientName} → ${match.item.name} (alias: ${match.from})`
          : `${ingredientName} → ${match.item.name} (${Math.round(match.score * 100)}% fuzzy)`
        matchesFound.push(matchDesc)
      }
    }

    // Score = matched_required / total_required (integer %, no partial credit)
    const matchPercentage = Math.round((matchedCount / requiredIngredients.length) * 100)
    
    console.log(`📊 Match result: ${matchedCount}/${requiredIngredients.length} = ${matchPercentage}%`)
    if (matchesFound.length > 0) {
      console.log(`✅ Matches:`, matchesFound)
    }
    if (missesFound.length > 0) {
      console.warn(`❌ Misses:`, missesFound)
    }
    
    return matchPercentage
  }

  // CRITICAL: Load cached recipes IMMEDIATELY on mount (before anything else)
  // This ensures recipes appear instantly, even before checking for updates
  useEffect(() => {
    const loadCachedRecipes = async () => {
      if (!user) return
      
      try {
        // Load cached recipes and metadata
        const [cachedRecipesJson, metadataJson] = await Promise.all([
          AsyncStorage.getItem(RECIPE_CACHE_KEY),
          AsyncStorage.getItem(RECIPE_CACHE_METADATA_KEY)
        ])
        
        if (cachedRecipesJson && metadataJson) {
          const cachedRecipes: Recipe[] = JSON.parse(cachedRecipesJson)
          const metadata: RecipeCacheMetadata = JSON.parse(metadataJson)
          
          // Only use cached recipes if they're for the same user
          if (metadata.userId === user.id && cachedRecipes.length > 0) {
            console.log(`📦 Loaded ${cachedRecipes.length} cached recipes (from ${new Date(metadata.timestamp).toLocaleString()})`)
            setRecipes(cachedRecipes)
            setLastPantryHash(metadata.pantryHash)
            hasRecipesRef.current = true
            setLoading(false) // Recipes are ready - no loading state needed
            return // Recipes are loaded, we're done for now
          }
        }
      } catch (error) {
        console.error('❌ Error loading cached recipes:', error)
        // Continue to normal load if cache fails
      }
      
      // If no cached recipes, proceed with normal load
      console.log('📦 No cached recipes found - will generate new ones')
    }
    
    loadCachedRecipes()
  }, [user])
  
  // Load recipes and saved recipes when user changes
  useEffect(() => {
    // Don't call loadRecipes on initial mount - cached recipes are already loaded above
    // Only call if we need to check for updates
    if (user) {
      loadSavedRecipes()
      
      // Subscribe to realtime changes
      const recipesSubscription = supabase
        .channel('recipes_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'recipes',
            filter: 'is_public=eq.true'
          },
          (payload) => {
            handleRecipeRealtimeUpdate(payload)
          }
        )
        .subscribe()

      const savedSubscription = supabase
        .channel('saved_recipes_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'saved_recipes',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            handleSavedRecipeRealtimeUpdate(payload)
          }
        )
        .subscribe()

      return () => {
        recipesSubscription.unsubscribe()
        savedSubscription.unsubscribe()
      }
    }
  }, [user])

  // 🚀 OPTIMIZED REGENERATION - Only regenerate when pantry actually changes
  const [lastPantryHash, setLastPantryHash] = useState<string>('')
  const hasClearedRef = useRef(false)
  const hasRecipesRef = useRef(false)
  
  // Calculate stable pantry hash - only changes when items are actually added/removed
  // This prevents unnecessary recipe refreshes when the recipes tab is opened
  const pantryHash = useMemo(() => {
    if (!pantryItems || pantryItems.length === 0) {
      return ''
    }
    // Create a stable hash based on sorted item names/quantities/categories
    // This ensures the hash only changes when items are actually added/removed/modified
    return JSON.stringify(
      pantryItems
        .map(item => ({ name: item.name, quantity: item.quantity, category: item.category }))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
  }, [pantryItems])
  
  // Monitor pantry hash changes - ONLY regenerate when hash actually changes
  // This prevents refreshes when recipes tab is opened or component re-renders
  useEffect(() => {
    console.log('🔍 RecipesContext useEffect triggered:', {
      hasUser: !!user,
      pantryItemsCount: pantryItems?.length || 0,
      pantryHash: pantryHash || '(empty)',
      lastPantryHash: lastPantryHash || '(empty)',
      hasRecipes: hasRecipesRef.current,
      hasCleared: hasClearedRef.current
    })

    if (!user) {
      return
    }

    if (!pantryItems || pantryItems.length === 0) {
      console.log('⚠️ No pantry items - clearing recipes if any exist')
      // If no pantry items, clear recipes
      if (hasRecipesRef.current) {
        setRecipes([])
        setLastPantryHash('')
        hasRecipesRef.current = false
      }
      return
    }

    // Check if pantry changed since last generation
    const pantryChanged = pantryHash !== lastPantryHash && pantryHash !== '' && lastPantryHash !== ''
    
    console.log('🔍 Recipe generation check:', {
      pantryHash: pantryHash.substring(0, 20) + '...',
      lastPantryHash: lastPantryHash.substring(0, 20) + '...',
      pantryChanged,
      hasRecipes: hasRecipesRef.current
    })
    
    // CRITICAL: Only regenerate if pantry hash actually changed (items added/removed)
    // If pantry unchanged and recipes exist, keep showing cached recipes
    if (!pantryChanged && hasRecipesRef.current) {
      console.log('✅ Pantry unchanged and recipes exist - keeping cached recipes')
      return
    }
    
    // If pantry changed OR no recipes exist, regenerate in background
    if (pantryChanged || !hasRecipesRef.current) {
      if (pantryChanged) {
        console.log('🔄 Pantry change detected - regenerating recipes in background')
        console.log('📦 Pantry items:', pantryItems.length)
        console.log('📦 Pantry item names:', pantryItems.map(item => item.name))
      } else {
        console.log('⚠️ No recipes exist - generating now')
      }

      setLastPantryHash(pantryHash)

      // Don't set loading=true if we already have recipes (background regeneration)
      // Only show loading if we have no recipes at all
      if (!hasRecipesRef.current) {
        setLoading(true)
        setError(null)
      }

      const reason = pantryChanged ? 'pantry-change' : 'initial-load'

      console.log('🚀 Calling loadRecipes with reason:', reason, '(background:', hasRecipesRef.current, ')')
      // Use ref to access loadRecipes (defined below)
      if (loadRecipesRef.current) {
        loadRecipesRef.current({ force: true, reason }).catch(error => {
          console.error('❌ Error in loadRecipes:', error)
          setError(error.message || 'Failed to load recipes')
          setLoading(false)
          generationLockRef.current = false
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantryHash, user, lastPantryHash, pantryItems])
  
  // Track when recipes are set
  useEffect(() => {
    hasRecipesRef.current = recipes.length > 0
  }, [recipes.length])

  const loadRecipes = useCallback(async (options: { force?: boolean; reason?: string } = {}) => {
    const { force = false, reason = 'unspecified' } = options
    const now = Date.now()

    // Single-flight guard: if active run exists, return early
    if (generationLockRef.current) {
      console.log(
        `⏳ Skipping recipe generation (${reason}) - another run is in progress (runId=${currentRunIdRef.current ?? 'n/a'})`
      )
      
      // If recipes are still empty, queue a single retry after cooldown
      if (recipes.length === 0 && !pendingRetryRef.current) {
        const timeSinceLastRun = now - lastRunAtRef.current
        if (timeSinceLastRun >= COOLDOWN_MS) {
          pendingRetryRef.current = setTimeout(() => {
            pendingRetryRef.current = null
            if (recipes.length === 0) {
              console.log(`🔄 Retrying recipe generation after cooldown (recipes still empty)`)
              loadRecipes({ force: true, reason: 'retry-after-cooldown' })
            }
          }, COOLDOWN_MS)
        }
      }
      return
    }

    // Cooldown check: prevent rapid successive runs
    if (!force && lastRunAtRef.current) {
      const elapsed = now - lastRunAtRef.current
      if (elapsed < COOLDOWN_MS) {
        const remainingMs = COOLDOWN_MS - elapsed
        console.log(
          `⏭️ Skipping recipe generation (${reason}) - cooldown active (${Math.ceil(remainingMs / 1000)}s remaining)`
        )
        
        // If recipes are empty, queue retry after cooldown
        if (recipes.length === 0 && !pendingRetryRef.current) {
          pendingRetryRef.current = setTimeout(() => {
            pendingRetryRef.current = null
            if (recipes.length === 0) {
              console.log(`🔄 Retrying recipe generation after cooldown`)
              loadRecipes({ force: true, reason: 'retry-after-cooldown' })
            }
          }, remainingMs)
        }
        return
      }
    }

    // Clear any pending retry
    if (pendingRetryRef.current) {
      clearTimeout(pendingRetryRef.current)
      pendingRetryRef.current = null
    }

    generationLockRef.current = true
    lastRunAtRef.current = now
    const runId = `gen_${now}_${Math.random().toString(36).slice(2, 8)}`
    currentRunIdRef.current = runId

    console.log(`🚀 [${runId}] Starting recipe generation (${reason})`)

    try {
      setLoading(true)
      setError(null)
      
      console.log(`[${runId}] 🔄 Starting recipe loading process...`)
      console.log(`[${runId}] 👤 User:`, user ? 'Authenticated' : 'Not authenticated')
      console.log(`[${runId}] 📦 Pantry items:`, pantryItems?.length || 0)
      
      // 🚀 SIMPLIFIED RECIPE GENERATION - Use local generator for reliability
      if (user && pantryItems && pantryItems.length > 0) {
        console.log(`[${runId}] 🤖 Generating recipes based on pantry items...`)
        console.log(`[${runId}] 📦 Current pantry items:`, pantryItems.map(item => item.name))
        console.log(`[${runId}] 📦 Pantry count:`, pantryItems.length)
        
        try {
          // Load user preferences for generation
          const preferences = await userPreferencesService.loadPreferences(user.id)
          
          console.log(`[${runId}] 👤 User context:`, {
            pantryItems: pantryItems.length,
            allergies: preferences?.dietary?.allergies?.length || 0,
            dietary: preferences?.dietary?.preferences?.length || 0,
            cuisines: preferences?.dietary?.cuisines?.length || 0,
            household: preferences?.household?.size || '2'
          })

          // ✨ PRIMARY PATH: Try LLM-backed recipe generation first
          try {
            console.log(`[${runId}] 🧠 Attempting OpenAI recipe generation from pantry inventory...`)
            const normalizedPantry = pantryItems.map(item => ({
              name: item.name,
              category: item.category || 'uncategorized'
            }))

            const llmRecipes = await aiRecipeGenerator.generateRecipesFromPantry(
              normalizedPantry,
              user.id,
              12
            )

            if (llmRecipes.length > 0) {
              console.log(`[${runId}] 🧠 OpenAI returned ${llmRecipes.length} pantry-driven recipes`)
              const timestamp = Date.now()

              const recipes = llmRecipes.map((recipe, index) => {
                const ingredientNames =
                  recipe.ingredients?.map(ing => ing.name).filter(Boolean) || []

                const matchPercentage = ingredientNames.length > 0
                  ? calculateIngredientMatchForGeneratedRecipe(ingredientNames, pantryItems)
                  : recipe.matchPercentage || 0

                // CRITICAL: Convert all ingredients to use RECIPE units (tbsp, g, ml, cups, pieces)
                // NEVER use inventory units (bottle, bag, container, "unit")
                // ALWAYS use realistic recipe quantities from IngredientUnitService
                // This ensures nutrition calculation uses recipe quantities, not pantry quantities
                // FILTER OUT WATER - it does nothing helpful and ruins flavor/texture
                const mapIngredients = (recipe.ingredients || [])
                  .filter(ing => {
                    const name = (ing.name || '').toLowerCase().trim()
                    return name !== 'water' && !name.includes(' water')
                  })
                  .map(ing => {
                    const ingredientName = ing.name || ''
                    const servings = recipe.servings || parseInt(preferences?.household?.size || '2')
                    
                    // Use IngredientUnitService to get proper recipe units and REALISTIC quantities
                    // This converts "unit" or inventory units to recipe units (tbsp, g, ml, cups, pieces)
                    // CRITICAL: Always use the realistic quantity from IngredientUnitService, not LLM quantities
                    // The LLM might provide "1g" for chicken, which is wrong - we need 200g per serving
                    const unitResult = ingredientUnitService.getIngredientUnit(
                      ingredientName,
                      pantryItems, // Pass pantry to check if in pantry
                      servings
                      // Don't pass baseQuantity - let it calculate realistic defaults
                    )
                    
                    // CRITICAL: ALWAYS use realistic recipe quantities from IngredientUnitService
                    // NEVER use LLM quantities - they might be wrong (e.g., "1g" for chicken, "1g" for rice)
                    // The IngredientUnitService calculates proper recipe quantities:
                    // - Chicken: 200g per serving (not 1g!)
                    // - Rice: 75g per serving (not 1g!)
                    // - Oil: 1 tbsp per recipe
                    // These are realistic cooking quantities, not pantry storage quantities
                    
                    // Always use the quantity and unit from IngredientUnitService
                    // It has already calculated realistic recipe quantities based on ingredient type and servings
                    // Example: "marinated chicken" → 200g per serving (not 1g from pantry)
                    
                    return {
                      name: ingredientName,
                      quantity: unitResult.quantity, // Always realistic from IngredientUnitService
                      unit: unitResult.unit // Always recipe unit from IngredientUnitService
                    }
                  })

                const mapInstructions = recipe.instructions?.map((inst, idx) => ({
                  step: inst.step || idx + 1,
                  description: inst.description
                })) || []

                return {
                  id: recipe.id || `llm_${timestamp}_${index}_${Math.random().toString(36).slice(2, 8)}`,
                  title: recipe.title,
                  description: recipe.description,
                  meal_type: recipe.meal_type || (recipe as any).mealType || 'Dinner',
                  cuisine_type: recipe.cuisine_type || 'Fusion',
                  prep_time: recipe.prep_time,
                  cook_time: recipe.cook_time,
                  servings: recipe.servings || parseInt(preferences?.household?.size || '2'),
                  difficulty: (recipe.difficulty as 'Easy' | 'Medium' | 'Hard') || 'Easy',
                  ingredients: mapIngredients,
                  instructions: mapInstructions,
                  calories: recipe.calories,
                  protein: recipe.protein,
                  carbs: recipe.carbs,
                  fat: recipe.fat,
                  tags: Array.isArray(recipe.tags) ? recipe.tags : [],
                  image_url: '',
                  is_public: false,
                  created_by: user.id,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  source: 'ai_generated' as const,
                  isAIGenerated: true,
                  matchPercentage,
                  generatedFrom: recipe.generatedFrom || (recipe as any).generated_from || [],
                  ingredientsAvailable: recipe.ingredientsAvailable,
                  ingredientsMissing: recipe.ingredientsMissing
                }
              })

              console.log(`[${runId}] ✨ Generated ${recipes.length} recipes using OpenAI`)
              
              // Filter out unrealistic recipes
              const realisticRecipes = recipes.filter(isRealisticRecipe)
              const filteredCount = recipes.length - realisticRecipes.length
              
              if (filteredCount > 0) {
                console.warn(`[${runId}] ⚠️ Filtered out ${filteredCount} unrealistic recipe(s)`)
              }
              
              if (realisticRecipes.length === 0) {
                console.warn(`[${runId}] ⚠️ All recipes were filtered out as unrealistic, falling back to local generator`)
                // Fall through to local generator
              } else {
              console.log(`[${runId}] ✅ Keeping ${realisticRecipes.length} realistic recipes`)
              
              // Sort by match percentage (descending) before setting state
              const sortedRecipes = [...realisticRecipes].sort((a, b) => {
                const matchA = a.matchPercentage ?? 0
                const matchB = b.matchPercentage ?? 0
                const result = matchB - matchA // Descending order (highest first)
                return result
              })
              
              console.log(`[${runId}] 📊 Recipes sorted by match %:`, sortedRecipes.map((r, i) => `${i + 1}. ${r.title}: ${r.matchPercentage}%`))
              
              // Keep old recipes until new ones are ready - no flicker
              setRecipes(sortedRecipes)
              
              // CRITICAL: Save recipes to cache immediately after generation
              saveRecipesToCache(sortedRecipes, pantryHash, user.id).catch(err => {
                console.error('Failed to save recipes to cache:', err)
              })
              
              console.log(`[${runId}] ✅ Recipes state updated with LLM results (sorted by match % descending)`)
              return
              }
            } else {
              console.log(`[${runId}] ℹ️ OpenAI returned no recipes - falling back to deterministic generator`)
            }
          } catch (llmError) {
            console.error(`[${runId}] ❌ OpenAI recipe generation failed, falling back to local generator:`, llmError)
          }
          
          // Use the realistic recipe generator that creates proper, cookable recipes
          const { realisticRecipeGenerator } = await import('./RealisticRecipeGenerator')
          
          // FORCE FRESH GENERATION: Reset generator and clear caches
          realisticRecipeGenerator.reset()
          console.log(`[${runId}] 🔄 Generating fresh recipes from pantry items...`)
          console.log(`[${runId}] 📦 Using pantry items:`, pantryItems.map(item => item.name).join(', '))
          
          const generatedRecipes = await realisticRecipeGenerator.generateRecipesFromPantry(pantryItems, {
            allergies: preferences?.dietary?.allergies || [],
            dietaryPreferences: preferences?.dietary?.preferences || [],
            householdSize: parseInt(preferences?.household?.size || '2'),
            count: 12
          })
          
          console.log(`[${runId}] 🤖 Local generation completed, received:`, generatedRecipes.length, 'recipes')
          console.log(`[${runId}] 📋 Generated recipe titles:`, generatedRecipes.map(r => r.title))
          console.log(
            `[${runId}] 📋 Generated recipe ingredients:`,
            generatedRecipes.map(r => [...r.baseIngredients, ...r.optionalIngredients].join(', '))
          )
          
          if (generatedRecipes.length > 0) {
            // Convert to Recipe format and calculate match percentage
            // Use timestamp in ID to ensure unique recipes each time
            const timestamp = Date.now()
            const recipes = generatedRecipes.map((recipe, index) => {
              const allIngredients = [...recipe.baseIngredients, ...recipe.optionalIngredients]
              
              // Deduplicate ingredients BEFORE processing (merge "salt" and "sea salt", etc.)
              const deduplicateIngredientNames = (ingredientNames: string[]): string[] => {
                const getDedupeKey = (name: string): string => {
                  if (!name || typeof name !== 'string') return ''
                  let key = name.toLowerCase()
                    .trim()
                    .replace(/sea\s+/g, '')
                    .replace(/table\s+/g, '')
                    .replace(/ground\s+/g, '')
                    .replace(/freshly\s+/g, '')
                    .replace(/black\s+/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                  
                  // Normalize salt variants
                  if (key === 'salt' || key === 'sea salt' || key === 'table salt') {
                    key = 'salt'
                  }
                  
                  return key
                }
                
                const seen = new Map<string, string>()
                for (const ing of ingredientNames) {
                  const key = getDedupeKey(ing)
                  if (!key) continue
                  
                  if (!seen.has(key)) {
                    seen.set(key, ing)
                  } else {
                    // Keep the more descriptive name (prefer "sea salt" over "salt")
                    const existing = seen.get(key)!
                    const ingLower = ing.toLowerCase()
                    const existingLower = existing.toLowerCase()
                    if (ingLower.includes('sea') && !existingLower.includes('sea')) {
                      seen.set(key, ing)
                    }
                  }
                }
                
                return Array.from(seen.values())
              }
              
              const deduplicatedIngredientNames = deduplicateIngredientNames(allIngredients)
              
              // FILTER OUT WATER - it does nothing helpful and ruins flavor/texture
              const filteredIngredientNames = deduplicatedIngredientNames.filter(ing => {
                const nameLower = ing.toLowerCase().trim()
                return nameLower !== 'water' && !nameLower.includes(' water')
              })
              
              // Calculate match percentage - should be 100% since recipes use pantry ingredients
              // But do it properly to ensure accuracy
              const matchPercentage = calculateIngredientMatchForGeneratedRecipe(filteredIngredientNames, pantryItems)
              
              // Log each recipe for debugging
              console.log(`[${runId}] 📝 Recipe ${index + 1}: "${recipe.title}"`)
              console.log(`[${runId}]    Original ingredients: ${allIngredients.join(', ')}`)
              console.log(`[${runId}]    Deduplicated ingredients: ${deduplicatedIngredientNames.join(', ')}`)
              console.log(`[${runId}]    Filtered ingredients (water removed): ${filteredIngredientNames.join(', ')}`)
              console.log(`[${runId}]    Match: ${matchPercentage}%`)
              
              const householdSize = parseInt(preferences?.household?.size || '2')
              
              return {
                id: `local_${timestamp}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                title: recipe.title,
                description: recipe.description,
                meal_type: recipe.mealType,
                cuisine_type: recipe.cuisine,
                prep_time: recipe.prepTime,
                cook_time: recipe.cookTime,
                servings: householdSize,
                difficulty: recipe.difficulty as 'Easy' | 'Medium' | 'Hard',
                ingredients: filteredIngredientNames.map(ing => {
                  // Use ingredient unit service to get proper units and check pantry
                  // Don't pass baseQuantity - let it use realistic defaults (200g pasta, 1 tbsp oil, etc.)
                  const unitResult = ingredientUnitService.getIngredientUnit(ing, pantryItems, householdSize)
                  
                  return {
                    name: ing,
                    quantity: unitResult.quantity,
                    unit: unitResult.unit,
                    inPantry: unitResult.inPantry
                  }
                }),
                instructions: recipe.instructions.map((inst, idx) => ({
                  step: idx + 1,
                  description: inst
                })),
                // Calculate accurate nutrition based on actual ingredients
                ...(() => {
                  const calculatedNutrition = nutritionCalculatorService.calculateRecipeNutrition(
                    deduplicatedIngredientNames.map(ing => {
                      const unitResult = ingredientUnitService.getIngredientUnit(ing, pantryItems, householdSize)
                      return {
                        name: ing,
                        quantity: unitResult.quantity,
                        unit: unitResult.unit
                      }
                    }),
                    householdSize
                  )
                  return {
                    calories: calculatedNutrition.calories || recipe.calories || 0,
                    protein: calculatedNutrition.protein || recipe.protein || 0,
                    carbs: calculatedNutrition.carbs || recipe.carbs || 0,
                    fat: calculatedNutrition.fat || recipe.fat || 0
                  }
                })(),
                tags: recipe.tags,
                image_url: undefined, // Will be generated by SimpleRecipeImage - force fresh
                is_public: false,
                created_by: user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                source: 'ai_generated' as const,
                isAIGenerated: true,
                matchPercentage // Pre-calculate match percentage
              }
            })
            
            console.log(`[${runId}] ✨ Generated ${recipes.length} fresh recipes using local generator!`)
            
            // Filter out unrealistic recipes
            const realisticRecipes = recipes.filter(isRealisticRecipe)
            const filteredCount = recipes.length - realisticRecipes.length
            
            if (filteredCount > 0) {
              console.warn(`[${runId}] ⚠️ Filtered out ${filteredCount} unrealistic recipe(s) from local generator`)
            }
            
            console.log(`[${runId}] 📋 Recipe summary:`)
            realisticRecipes.forEach((r, i) => {
              console.log(`[${runId}]    ${i + 1}. "${r.title}" - ${r.matchPercentage}% match - ${r.ingredients.length} ingredients`)
            })
            
            if (realisticRecipes.length === 0) {
              console.warn(`[${runId}] ⚠️ All local recipes were filtered out, will use fallback`)
              // Fall through to fallback
            } else {
              // Sort by match percentage (descending) before setting state
              const sortedRecipes = [...realisticRecipes].sort((a, b) => {
                const matchA = a.matchPercentage ?? 0
                const matchB = b.matchPercentage ?? 0
                const result = matchB - matchA // Descending order (highest first)
                return result
              })
              
              console.log(`[${runId}] 📊 Recipes sorted by match %:`, sortedRecipes.map((r, i) => `${i + 1}. ${r.title}: ${r.matchPercentage}%`))
              
              // Update recipes directly - keep old recipes until new ones arrive (no flicker)
              setRecipes(sortedRecipes)
              
              // CRITICAL: Save recipes to cache immediately after generation
              saveRecipesToCache(sortedRecipes, pantryHash, user.id).catch(err => {
                console.error('Failed to save recipes to cache:', err)
              })
              
              console.log(`[${runId}] ✅ Recipes state updated (sorted by match % descending) - should trigger re-render`)
              return
            }
          } else {
            console.warn(`[${runId}] ⚠️ No recipes generated from local generator`)
          }
        } catch (aiError: any) {
          console.error(`[${runId}] ❌ Error generating recipes:`, aiError)
          console.error(`[${runId}] ❌ Error details:`, aiError.message)
          // Continue with fallback
        }
      } else if (!user) {
        console.log(`[${runId}] 👤 No user authenticated`)
      } else if (!pantryItems || pantryItems.length === 0) {
        console.log(`[${runId}] 📦 No pantry items available`)
      }

      // Fallback: Create simple recipes using available pantry items or basic ingredients
      console.log(`[${runId}] 🔄 Creating fallback recipes...`)
      
      let fallbackRecipes: any[] = []
      
      // Load preferences for fallback recipes
      let preferences = null
      if (user) {
        try {
          preferences = await userPreferencesService.loadPreferences(user.id)
        } catch (error) {
          console.warn('Could not load preferences for fallback recipes:', error)
        }
      }
      
      // If we have some pantry items, try to create recipes with them
      if (pantryItems && pantryItems.length > 0) {
        try {
          const { realisticRecipeGenerator } = await import('./RealisticRecipeGenerator')
          const pantryRecipes = await realisticRecipeGenerator.generateRecipesFromPantry(pantryItems, {
            count: 2
          })
          
          if (pantryRecipes.length > 0) {
            fallbackRecipes = pantryRecipes.map((recipe, index) => ({
              id: `fallback_${Date.now()}_${index}`,
              title: recipe.title,
              description: recipe.description,
              meal_type: recipe.mealType,
              cuisine_type: recipe.cuisine,
              prep_time: recipe.prepTime,
              cook_time: recipe.cookTime,
              servings: parseInt(preferences?.household?.size || '2'),
              difficulty: recipe.difficulty as 'Easy' | 'Medium' | 'Hard',
              ingredients: recipe.baseIngredients
                .filter(ing => {
                  // FILTER OUT WATER - it does nothing helpful and ruins flavor/texture
                  const name = (ing || '').toLowerCase().trim()
                  return name !== 'water' && !name.includes(' water')
                })
                .map(ing => {
                  // Use ingredient unit service to get proper units and check pantry
                  // Don't pass baseQuantity - let it use realistic defaults (200g pasta, 1 tbsp oil, etc.)
                  const householdSize = parseInt(preferences?.household?.size || '2')
                  const unitResult = ingredientUnitService.getIngredientUnit(ing, pantryItems, householdSize)
                  
                  return {
                    name: ing,
                    quantity: unitResult.quantity,
                    unit: unitResult.unit,
                    inPantry: unitResult.inPantry
                  }
                }),
              instructions: recipe.instructions.map((inst, idx) => ({
                step: idx + 1,
                description: inst
              })),
              calories: recipe.calories,
              protein: recipe.protein,
              carbs: recipe.carbs,
              fat: recipe.fat,
              tags: recipe.tags,
              image_url: undefined,
              is_public: false,
              created_by: user?.id || 'anonymous',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              source: 'ai_generated' as const,
              isAIGenerated: true
            }))
          }
        } catch (error) {
          console.error('Error creating pantry-based fallback recipes:', error)
        }
      }
      
      // If no pantry-based recipes, use generic fallbacks
      if (fallbackRecipes.length === 0) {
        fallbackRecipes = [
          {
            id: `fallback_${Date.now()}_1`,
            title: 'Quick Pasta with Garlic',
            description: 'Simple and delicious pasta with garlic and olive oil',
            meal_type: 'dinner',
            cuisine_type: 'Italian',
            prep_time: 5,
            cook_time: 15,
            servings: 2,
            difficulty: 'Easy' as 'Easy' | 'Medium' | 'Hard',
            ingredients: [
              { name: 'Pasta', quantity: '8', unit: 'oz' },
              { name: 'Garlic', quantity: '3', unit: 'cloves' },
              { name: 'Olive Oil', quantity: '3', unit: 'tbsp' },
              { name: 'Red Pepper Flakes', quantity: '1', unit: 'tsp' }
            ],
            instructions: [
              { step: 1, description: 'Cook pasta in salted water until al dente' },
              { step: 2, description: 'Meanwhile, sauté minced garlic in olive oil' },
              { step: 3, description: 'Add red pepper flakes and cook until fragrant' },
              { step: 4, description: 'Toss drained pasta with garlic oil' },
              { step: 5, description: 'Season with salt and serve immediately' }
            ],
            calories: 420,
            protein: 12,
            carbs: 58,
            fat: 18,
            tags: ['pasta', 'italian', 'quick', 'vegetarian'],
            image_url: undefined,
            is_public: false,
            created_by: user?.id || 'anonymous',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            source: 'ai_generated' as const,
            isAIGenerated: true
          },
          {
            id: `fallback_${Date.now()}_2`,
            title: 'Simple Fried Rice',
            description: 'Classic fried rice with eggs and vegetables',
            meal_type: 'dinner',
            cuisine_type: 'Asian',
            prep_time: 10,
            cook_time: 12,
            servings: 2,
            difficulty: 'Easy' as 'Easy' | 'Medium' | 'Hard',
            ingredients: [
              { name: 'Rice', quantity: '2', unit: 'cups' },
              { name: 'Eggs', quantity: '2', unit: 'large' },
              { name: 'Soy Sauce', quantity: '2', unit: 'tbsp' },
              { name: 'Vegetable Oil', quantity: '2', unit: 'tbsp' }
            ],
            instructions: [
              { step: 1, description: 'Use day-old rice for best texture' },
              { step: 2, description: 'Scramble eggs and set aside' },
              { step: 3, description: 'Heat oil in a large pan or wok' },
              { step: 4, description: 'Add rice and break up clumps' },
              { step: 5, description: 'Season with soy sauce and mix in eggs' }
            ],
            calories: 340,
            protein: 12,
            carbs: 58,
            fat: 8,
            tags: ['rice', 'asian', 'quick', 'eggs'],
            image_url: undefined,
            is_public: false,
            created_by: user?.id || 'anonymous',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            source: 'ai_generated' as const,
            isAIGenerated: true
          }
        ]
      }
      
      console.log(`✨ Generated ${fallbackRecipes.length} fallback recipes`)
      
      // Sort fallback recipes by match percentage (descending)
      const sortedFallback = fallbackRecipes
        .map(recipe => ({
          ...recipe,
          matchPercentage: recipe.matchPercentage ?? calculateIngredientMatch(recipe)
        }))
        .sort((a, b) => {
          const matchA = a.matchPercentage ?? 0
          const matchB = b.matchPercentage ?? 0
          return matchB - matchA // Descending order
        })
      
      setRecipes(sortedFallback)
      
    } catch (err: any) {
      console.error(`[${runId}] ❌ Error loading recipes:`, err)
      setError(err.message || 'Failed to load recipes')
      // Set empty array as final fallback
      setRecipes([])
    } finally {
      lastGenerationAtRef.current = Date.now()
      generationLockRef.current = false
      if (currentRunIdRef.current === runId) {
        currentRunIdRef.current = null
      }
      console.log(`✅ [${runId}] Recipe generation finished`)
      setLoading(false)
    }
  }, [user, pantryItems])

  // Store loadRecipes in ref so it can be accessed in useEffect above
  useEffect(() => {
    loadRecipesRef.current = loadRecipes
  }, [loadRecipes])

  const loadSavedRecipes = async () => {
    if (!user) {
      setSavedRecipes([])
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('saved_recipes')
        .select(`
          *,
          recipe:recipes(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setSavedRecipes(data || [])
    } catch (err: any) {
      console.error('Error loading saved recipes:', err)
    }
  }

  const handleRecipeRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload

    switch (eventType) {
      case 'INSERT':
        setRecipes(prev => {
          const updated = [newRecord as Recipe, ...prev]
          // Sort by match percentage (descending)
          return updated
            .map(recipe => ({
              ...recipe,
              matchPercentage: recipe.matchPercentage ?? calculateIngredientMatch(recipe)
            }))
            .sort((a, b) => (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0))
        })
        break
      case 'UPDATE':
        setRecipes(prev => {
          const updated = prev.map(recipe => 
            recipe.id === newRecord.id ? newRecord as Recipe : recipe
          )
          // Sort by match percentage (descending)
          return updated
            .map(recipe => ({
              ...recipe,
              matchPercentage: recipe.matchPercentage ?? calculateIngredientMatch(recipe)
            }))
            .sort((a, b) => (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0))
        })
        break
      case 'DELETE':
        setRecipes(prev => {
          const filtered = prev.filter(recipe => recipe.id !== oldRecord.id)
          // Maintain sort order after deletion
          return filtered
            .map(recipe => ({
              ...recipe,
              matchPercentage: recipe.matchPercentage ?? calculateIngredientMatch(recipe)
            }))
            .sort((a, b) => (b.matchPercentage ?? 0) - (a.matchPercentage ?? 0))
        })
        break
    }
  }

  const handleSavedRecipeRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload

    switch (eventType) {
      case 'INSERT':
        loadSavedRecipes() // Reload to get joined recipe data
        break
      case 'UPDATE':
        setSavedRecipes(prev => prev.map(saved => 
          saved.id === newRecord.id ? { ...saved, ...newRecord } : saved
        ))
        break
      case 'DELETE':
        setSavedRecipes(prev => prev.filter(saved => saved.id !== oldRecord.id))
        break
    }
  }

  const getRecipeById = async (id: string): Promise<Recipe | null> => {
    try {
      // CRITICAL FIX: AI-generated recipes (local_*, fallback_*, regenerated_*)
      // exist only in memory, not in the database. Check local recipes first.
      const localRecipe = recipes.find(r => r.id === id)
      if (localRecipe) {
        console.log('✅ Found recipe in local recipes:', localRecipe.title)
        // Deduplicate ingredients before returning
        return deduplicateRecipeIngredients(localRecipe)
      }

      // If not found locally, query the database (for saved/public recipes)
      const { data, error: fetchError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      // Deduplicate ingredients from database recipes too
      return deduplicateRecipeIngredients(data as Recipe)
    } catch (err: any) {
      console.error('Error fetching recipe:', err)
      return null
    }
  }

  // Helper function to deduplicate recipe ingredients
  const deduplicateRecipeIngredients = (recipe: Recipe): Recipe => {
    if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) {
      return recipe
    }

    const getDedupeKey = (name: string): string => {
      if (!name || typeof name !== 'string') return ''
      let key = name.toLowerCase()
        .trim()
        .replace(/sea\s+/g, '')
        .replace(/table\s+/g, '')
        .replace(/ground\s+/g, '')
        .replace(/freshly\s+/g, '')
        .replace(/black\s+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      
      // Normalize salt variants
      if (key === 'salt' || key === 'sea salt' || key === 'table salt') {
        key = 'salt'
      }
      
      return key
    }

    const merged = new Map<string, any>()
    
    for (const ing of recipe.ingredients) {
      if (!ing || !ing.name) continue
      
      const key = getDedupeKey(ing.name)
      if (!key) continue
      
      const existing = merged.get(key)
      
      if (existing) {
        // Keep more descriptive name (prefer "sea salt" over "salt")
        const ingNameLower = String(ing.name).toLowerCase()
        const existingNameLower = String(existing.name).toLowerCase()
        
        if (ingNameLower.includes('sea') && !existingNameLower.includes('sea')) {
          existing.name = ing.name
        }
        
        // Merge quantities if same unit
        if (existing.unit === ing.unit && existing.unit !== '' && ing.unit !== '') {
          const existingQty = parseFloat(String(existing.quantity)) || 0
          const newQty = parseFloat(String(ing.quantity)) || 0
          existing.quantity = (existingQty + newQty).toString()
        }
        // Skip adding duplicate
        continue
      } else {
        merged.set(key, { ...ing })
      }
    }
    
    return {
      ...recipe,
      ingredients: Array.from(merged.values())
    }
  }

  const searchRecipes = (query: string): Recipe[] => {
    if (!query.trim()) return recipes
    
    const lowerQuery = query.toLowerCase()
    return recipes.filter(recipe =>
      recipe.title.toLowerCase().includes(lowerQuery) ||
      recipe.description?.toLowerCase().includes(lowerQuery) ||
      recipe.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  const filterRecipes = (filters: RecipeFilters): Recipe[] => {
    let filtered = [...recipes]

    if (filters.mealType) {
      filtered = filtered.filter(r => r.meal_type === filters.mealType)
    }

    if (filters.difficulty) {
      filtered = filtered.filter(r => r.difficulty === filters.difficulty)
    }

    if (filters.maxTime) {
      filtered = filtered.filter(r => 
        (r.prep_time || 0) + (r.cook_time || 0) <= filters.maxTime!
      )
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(r =>
        filters.tags!.some(tag => r.tags.includes(tag))
      )
    }

    if (filters.minIngredientMatch) {
      filtered = filtered.filter(r =>
        calculateIngredientMatch(r) >= filters.minIngredientMatch!
      )
    }

    return filtered
  }

  const saveRecipe = async (recipeId: string): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated')
      return false
    }

    try {
      // Check if this is an AI-generated recipe (not in database)
      const localRecipe = recipes.find(r => r.id === recipeId)
      const isAIRecipe = localRecipe && (
        localRecipe.isAIGenerated ||
        recipeId.startsWith('local_') ||
        recipeId.startsWith('fallback_') ||
        recipeId.startsWith('regenerated_') ||
        recipeId.startsWith('ai_gen_')
      )

      let finalRecipeId = recipeId

      // If it's an AI-generated recipe, create it in the database first
      if (isAIRecipe && localRecipe) {
        console.log('💾 Saving AI-generated recipe to database first...')
        const createdRecipe = await createRecipe({
          title: localRecipe.title,
          description: localRecipe.description,
          image_url: undefined, // Don't save image URL - always generate fresh images
          prep_time: localRecipe.prep_time,
          cook_time: localRecipe.cook_time,
          servings: localRecipe.servings,
          difficulty: localRecipe.difficulty,
          cuisine_type: localRecipe.cuisine_type,
          meal_type: localRecipe.meal_type,
          ingredients: localRecipe.ingredients,
          instructions: localRecipe.instructions,
          calories: localRecipe.calories,
          protein: localRecipe.protein,
          carbs: localRecipe.carbs,
          fat: localRecipe.fat,
          fiber: localRecipe.fiber,
          tags: localRecipe.tags,
          source: 'ai_generated',
          is_public: false // Keep user's AI recipes private
        })

        if (!createdRecipe) {
          setError('Failed to save AI-generated recipe to database')
          return false
        }

        finalRecipeId = createdRecipe.id
        console.log('✅ AI recipe saved to database with ID:', finalRecipeId)
      }

      // Now save to saved_recipes table
      const { error: insertError } = await supabase
        .from('saved_recipes')
        .insert({
          user_id: user.id,
          recipe_id: finalRecipeId,
          times_cooked: 0,
          is_favorite: true // Default to favorite when saved
        })

      if (insertError) throw insertError

      // Update local state immediately for instant UI feedback
      const recipe = recipes.find(r => r.id === recipeId) || (isAIRecipe && localRecipe ? await getRecipeById(finalRecipeId) : null)
      if (recipe) {
        const newSavedRecipe: SavedRecipe = {
          id: `temp_${Date.now()}`, // Temporary ID until we get the real one
          user_id: user.id,
          recipe_id: finalRecipeId,
          times_cooked: 0,
          is_favorite: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        setSavedRecipes(prev => [newSavedRecipe, ...prev])
        
        // Track this interaction for learning
        await recipePreferenceLearningService.trackInteraction(
          user.id,
          finalRecipeId,
          recipe.title,
          'saved',
          {
            ingredients: recipe.ingredients?.map((ing: any) => ing.name) || [],
            cuisine_type: recipe.cuisine_type,
            meal_type: recipe.meal_type
          }
        )
      }

      return true
    } catch (err: any) {
      console.error('Error saving recipe:', err)
      setError(err.message || 'Failed to save recipe')
      return false
    }
  }

  const unsaveRecipe = async (recipeId: string): Promise<boolean> => {
    if (!user) return false

    try {
      const { error: deleteError } = await supabase
        .from('saved_recipes')
        .delete()
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId)

      if (deleteError) throw deleteError

      // Track unsave interaction
      const recipe = recipes.find(r => r.id === recipeId)
      if (recipe) {
        await recipePreferenceLearningService.trackInteraction(
          user.id,
          recipeId,
          recipe.title,
          'unsaved'
        )
      }

      return true
    } catch (err: any) {
      console.error('Error unsaving recipe:', err)
      return false
    }
  }

  const updateSavedRecipe = async (recipeId: string, updates: Partial<SavedRecipe>): Promise<boolean> => {
    if (!user) return false

    try {
      // Check if this is an AI-generated recipe ID (not a UUID)
      const isAIRecipeId = recipeId.startsWith('local_') || 
                           recipeId.startsWith('fallback_') || 
                           recipeId.startsWith('regenerated_') || 
                           recipeId.startsWith('ai_gen_') ||
                           recipeId.startsWith('llm_')
      
      let finalRecipeId = recipeId
      
      // If it's an AI-generated ID, find the corresponding UUID from savedRecipes
      if (isAIRecipeId) {
        // Find the saved recipe that references this AI recipe
        // We need to match by the recipe object's ID, not the saved_recipes.recipe_id
        let savedRecipe = savedRecipes.find(sr => {
          // Check if the saved recipe's recipe object has the matching AI ID
          return sr.recipe?.id === recipeId || sr.recipe_id === recipeId
        })
        
        if (!savedRecipe) {
          console.warn(`⚠️ Cannot update saved recipe: No saved recipe found for AI recipe ID: ${recipeId}`)
          // Reload saved recipes in case it was just saved
          await loadSavedRecipes()
          savedRecipe = savedRecipes.find(sr => 
            sr.recipe?.id === recipeId || sr.recipe_id === recipeId
          )
        }
        
        if (!savedRecipe) {
          // If recipe isn't saved yet, we need to save it first
          console.log(`💾 Recipe not saved yet, saving it first: ${recipeId}`)
          const saveSuccess = await saveRecipe(recipeId)
          if (!saveSuccess) {
            console.error(`❌ Failed to save recipe: ${recipeId}`)
            return false
          }
          // Reload saved recipes to get the new one with UUID
          await loadSavedRecipes()
          const newSavedRecipe = savedRecipes.find(sr => 
            sr.recipe?.id === recipeId || sr.recipe_id === recipeId
          )
          if (!newSavedRecipe) {
            console.error(`❌ Failed to find saved recipe after saving: ${recipeId}`)
            return false
          }
          finalRecipeId = newSavedRecipe.recipe_id
        } else {
          finalRecipeId = savedRecipe.recipe_id
        }
      }

      const { error: updateError } = await supabase
        .from('saved_recipes')
        .update(updates)
        .eq('user_id', user.id)
        .eq('recipe_id', finalRecipeId)

      if (updateError) throw updateError

      // Update local state immediately for instant UI feedback
      // Update by both the original recipeId (for AI recipes) and finalRecipeId (for UUID)
      setSavedRecipes(prev => 
        prev.map(saved => {
          const matches = saved.recipe_id === finalRecipeId || 
                         saved.recipe?.id === recipeId ||
                         saved.recipe_id === recipeId
          return matches ? { ...saved, ...updates } : saved
        })
      )

      return true
    } catch (err: any) {
      console.error('Error updating saved recipe:', err)
      return false
    }
  }

  const rateRecipe = async (recipeId: string, rating: number): Promise<boolean> => {
    const success = await updateSavedRecipe(recipeId, { rating })
    
    // Track rating interaction for learning
    if (success && user) {
      const recipe = recipes.find(r => r.id === recipeId)
      if (recipe) {
        await recipePreferenceLearningService.trackInteraction(
          user.id,
          recipeId,
          recipe.title,
          'rated',
          {
            rating,
            ingredients: recipe.ingredients?.map((ing: any) => ing.name) || [],
            cuisine_type: recipe.cuisine_type,
            meal_type: recipe.meal_type
          }
        )
      }
    }
    
    return success
  }

  const markRecipeCooked = async (recipeId: string): Promise<boolean> => {
    // Find saved recipe by matching either recipe_id (UUID) or recipe.id (AI-generated ID)
    // Note: updateSavedRecipe will handle saving the recipe if it's not saved yet
    const savedRecipe = savedRecipes.find(sr => 
      sr.recipe_id === recipeId || sr.recipe?.id === recipeId
    )
    const timesCooked = (savedRecipe?.times_cooked || 0) + 1
    
    // updateSavedRecipe will handle:
    // 1. Converting AI-generated IDs to UUIDs
    // 2. Saving the recipe if it's not saved yet
    // 3. Reloading saved recipes if needed
    const success = await updateSavedRecipe(recipeId, {
      last_cooked: new Date().toISOString().split('T')[0],
      times_cooked: timesCooked
    })

    // Track cooked interaction for learning (MOST IMPORTANT!)
    if (success && user) {
      const recipe = recipes.find(r => r.id === recipeId)
      if (recipe) {
        await recipePreferenceLearningService.trackInteraction(
          user.id,
          recipeId,
          recipe.title,
          'cooked',
          {
            ingredients: recipe.ingredients?.map((ing: any) => ing.name) || [],
            cuisine_type: recipe.cuisine_type,
            meal_type: recipe.meal_type
          }
        )
      }
    }
    
    return success
  }

  const toggleFavorite = async (recipeId: string): Promise<boolean> => {
    // Find saved recipe by matching either recipe_id (UUID) or recipe.id (AI-generated ID)
    const savedRecipe = savedRecipes.find(sr => 
      sr.recipe_id === recipeId || sr.recipe?.id === recipeId
    )
    return updateSavedRecipe(recipeId, {
      is_favorite: !savedRecipe?.is_favorite
    })
  }

  const createRecipe = async (recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<Recipe | null> => {
    if (!user) {
      setError('User not authenticated')
      return null
    }

    try {
      const { data, error: insertError } = await supabase
        .from('recipes')
        .insert({
          ...recipe,
          image_url: null, // Always set to null - images are generated fresh on display
          created_by: user.id
        })
        .select()
        .single()

      if (insertError) throw insertError

      return data as Recipe
    } catch (err: any) {
      console.error('Error creating recipe:', err)
      setError(err.message || 'Failed to create recipe')
      return null
    }
  }

  const updateRecipe = async (recipeId: string, updates: Partial<Recipe>): Promise<boolean> => {
    if (!user) return false

    try {
      const { error: updateError } = await supabase
        .from('recipes')
        .update(updates)
        .eq('id', recipeId)
        .eq('created_by', user.id)

      if (updateError) throw updateError

      return true
    } catch (err: any) {
      console.error('Error updating recipe:', err)
      return false
    }
  }

  const deleteRecipe = async (recipeId: string): Promise<boolean> => {
    if (!user) return false

    try {
      const { error: deleteError } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('created_by', user.id)

      if (deleteError) throw deleteError

      return true
    } catch (err: any) {
      console.error('Error deleting recipe:', err)
      return false
    }
  }

  const generateRecipeFromPantry = async (preferences?: {
    mealType?: string
    difficulty?: string
    dietaryRestrictions?: string[]
    servings?: number
  }): Promise<Recipe | null> => {
    if (!user) {
      setError('User not authenticated')
      return null
    }

    if (!pantryItems || pantryItems.length === 0) {
      setError('Add items to your pantry first to generate recipes')
      return null
    }

    try {
      setError(null)
      
      // Import the AI function dynamically to avoid circular dependencies
      const { generateRecipeFromPantry: aiGenerate } = await import('./openai')
      
      // Get pantry item names
      const ingredientNames = pantryItems.map(item => item.name)
      
      // Generate recipe using AI
      const aiRecipe = await aiGenerate(ingredientNames, preferences)
      
      if (!aiRecipe) {
        setError('Failed to generate recipe. Please try again.')
        return null
      }

      // Save the generated recipe to database
      const newRecipe = await createRecipe({
        title: aiRecipe.title,
        description: aiRecipe.description,
        prep_time: aiRecipe.prepTime,
        cook_time: aiRecipe.cookTime,
        servings: aiRecipe.servings,
        difficulty: aiRecipe.difficulty,
        meal_type: preferences?.mealType || 'dinner',
        cuisine_type: 'AI Generated',
        ingredients: aiRecipe.ingredients,
        instructions: aiRecipe.instructions,
        calories: aiRecipe.calories,
        protein: aiRecipe.protein,
        carbs: aiRecipe.carbs,
        fat: aiRecipe.fat,
        tags: [...aiRecipe.tags, 'ai-generated'],
        source: 'ai_generated',
        is_public: false // Keep AI recipes private by default
      })

      return newRecipe
    } catch (err: any) {
      console.error('Error generating recipe from pantry:', err)
      setError(err.message || 'Failed to generate recipe')
      return null
    }
  }

  const calculateIngredientMatch = (recipe: Recipe): number => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return 0
    if (!pantryItems || pantryItems.length === 0) return 0

    const pantryNames = pantryItems.map(item => item.name)
    
    // Debug logging for recipe matching
    console.log(`🔍 Calculating match for "${recipe.title}":`)
    console.log(`📦 Recipe ingredients:`, recipe.ingredients.map(ing => ing.name))
    console.log(`🏠 Pantry items:`, pantryNames)
    
    // ENHANCED INTELLIGENT WEIGHTED MATCHING with Smart Matching Service
    // NOW: "chicken breast" matches "chicken", "spaghetti" matches "pasta", etc.
    let totalWeight = 0
    let matchedWeight = 0

    recipe.ingredients.forEach(ingredient => {
      const ingredientName = ingredient.name
      
      // Determine ingredient importance and weight
      const importance = getIngredientImportance(ingredientName)
      const weight = importance === 'critical' ? 3 : 
                    importance === 'important' ? 2 : 1
      totalWeight += weight
      
      // Use smart matching service for better accuracy
      let bestMatchConfidence = 0
      
      for (const pantryItem of pantryNames) {
        const matchResult = ingredientMatchingService.matchIngredient(ingredientName, pantryItem)
        
        if (matchResult.isMatch && matchResult.confidence > bestMatchConfidence) {
          bestMatchConfidence = matchResult.confidence
        }
      }
      
      // If we found a match with sufficient confidence, count it
      // Confidence threshold: 0.70 (70%)
      if (bestMatchConfidence >= 0.70) {
        // Weight the match by confidence
        // E.g., 95% confident match gets 0.95x the weight
        matchedWeight += weight * bestMatchConfidence
      }
    })

    const matchPercentage = Math.round((matchedWeight / totalWeight) * 100)
    console.log(`📊 Match result: ${matchedWeight}/${totalWeight} = ${matchPercentage}%`)
    return matchPercentage
  }

  const getMissingIngredients = (recipe: Recipe): string[] => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return []
    if (!pantryItems || pantryItems.length === 0) {
      return recipe.ingredients.map(ing => ing.name)
    }

    const pantryNames = pantryItems.map(item => item.name)
    const missing: string[] = []

    recipe.ingredients.forEach(ingredient => {
      const ingredientName = ingredient.name
      
      // Use smart matching service for accurate missing ingredient detection
      let hasMatch = false
      
      for (const pantryItem of pantryNames) {
        const matchResult = ingredientMatchingService.matchIngredient(ingredientName, pantryItem)
        
        if (matchResult.isMatch && matchResult.confidence >= 0.70) {
          hasMatch = true
          break
        }
      }
      
      if (!hasMatch) {
        missing.push(ingredient.name)
      }
    })

    return missing
  }

  const getRecipesByMealType = (mealType: string): Recipe[] => {
    return recipes.filter(r => r.meal_type?.toLowerCase() === mealType.toLowerCase())
  }

  const getRecipesByDifficulty = (difficulty: string): Recipe[] => {
    return recipes.filter(r => r.difficulty?.toLowerCase() === difficulty.toLowerCase())
  }

  const getFavoriteRecipes = (): SavedRecipe[] => {
    // Get favorite recipes and sort by match percentage (descending)
    const favorites = savedRecipes.filter(sr => sr.is_favorite)
    
    // Calculate match percentage for each favorite recipe and sort
    return favorites
      .map(savedRecipe => {
        if (!savedRecipe.recipe) return savedRecipe
        const matchPercentage = calculateIngredientMatch(savedRecipe.recipe)
        return {
          ...savedRecipe,
          recipe: {
            ...savedRecipe.recipe,
            matchPercentage
          }
        }
      })
      .sort((a, b) => {
        const matchA = a.recipe?.matchPercentage ?? calculateIngredientMatch(a.recipe!) ?? 0
        const matchB = b.recipe?.matchPercentage ?? calculateIngredientMatch(b.recipe!) ?? 0
        return matchB - matchA // Descending order
      })
  }

  const getCookedRecipes = (): SavedRecipe[] => {
    // Return recipes that have been cooked at least once, sorted by match percentage (descending)
    const cooked = savedRecipes.filter(sr => sr.times_cooked > 0)
    
    // Calculate match percentage for each cooked recipe and sort
    return cooked
      .map(savedRecipe => {
        if (!savedRecipe.recipe) return savedRecipe
        const matchPercentage = calculateIngredientMatch(savedRecipe.recipe)
        return {
          ...savedRecipe,
          recipe: {
            ...savedRecipe.recipe,
            matchPercentage
          }
        }
      })
      .sort((a, b) => {
        const matchA = a.recipe?.matchPercentage ?? calculateIngredientMatch(a.recipe!) ?? 0
        const matchB = b.recipe?.matchPercentage ?? calculateIngredientMatch(b.recipe!) ?? 0
        return matchB - matchA // Descending order by match percentage
      })
  }

  // 🧠 DYNAMIC PERSONALIZED RECIPES - Changes daily based on user preferences, allergies, diet, cooking history
  const getSuggestedRecipes = (): Recipe[] => {
    // 🚀 Use the current recipes array (which contains AI-generated recipes)
    console.log(`🎯 getSuggestedRecipes called with ${recipes.length} total recipes`)
    console.log('📋 Recipe titles:', recipes.map(r => r.title))
    
    // Add match percentages for display (if not already calculated)
    const recipesWithMatch = recipes
      .map(recipe => ({
        ...recipe,
        matchPercentage: recipe.matchPercentage !== undefined 
          ? recipe.matchPercentage 
          : calculateIngredientMatch(recipe)
      }))
      // CRITICAL: Only filter out recipes with 0% match if they're NOT using pantry ingredients
      // Generated recipes should always have match > 0 since they use pantry items
      .filter(recipe => {
        // If it's an AI-generated recipe, it should have match > 0
        // If match is 0, it means matching failed, so show it anyway with a warning
        if (recipe.isAIGenerated && recipe.matchPercentage === 0) {
          console.warn(`⚠️ AI-generated recipe "${recipe.title}" has 0% match - this shouldn't happen!`)
          // Still show it, but log the issue
          return true
        }
        // For non-AI recipes, only show if match > 0
        return recipe.matchPercentage > 0 || recipe.isAIGenerated
      })
    
    // Sort by match percentage (highest first) - descending order
    recipesWithMatch.sort((a, b) => {
      const matchA = a.matchPercentage ?? 0
      const matchB = b.matchPercentage ?? 0
      const result = matchB - matchA // Descending order (highest first)
      return result
    })
    
    console.log(`🎯 getSuggestedRecipes returning ${recipesWithMatch.length} recipes SORTED by match percentage (highest to lowest)`)
    console.log('📊 Match percentages (sorted):', recipesWithMatch.map((r, i) => `${i + 1}. ${r.title}: ${r.matchPercentage}%`))
    
    // Verify sort order
    const isSorted = recipesWithMatch.every((recipe, index) => {
      if (index === 0) return true
      const prevMatch = recipesWithMatch[index - 1].matchPercentage ?? 0
      const currMatch = recipe.matchPercentage ?? 0
      return prevMatch >= currMatch
    })
    
    if (!isSorted) {
      console.error('❌ ERROR: Recipes are NOT sorted correctly!')
    }
    
    return recipesWithMatch
  }

  // 🚀 REAL-TIME RECIPE GENERATION - No need for old personalization logic
  // Recipes are now generated in real-time in loadRecipes() function

  const refreshRecipes = async (): Promise<void> => {
    await Promise.all([
      loadRecipes({ force: true, reason: 'refresh-recipes' }),
      loadSavedRecipes()
    ])
  }

  const clearAndRegenerateRecipes = async (): Promise<void> => {
    if (!user || !pantryItems || pantryItems.length === 0) {
      console.warn('⚠️ Cannot regenerate: no user or pantry items')
      return
    }

    try {
      console.log('🗑️ Clearing all recipes and forcing fresh generation...')
      
      // Reset the cleared flag so we can clear again
      hasClearedRef.current = false
      
      // Clear current recipes
      setRecipes([])
      setLastPantryHash('')
      hasRecipesRef.current = false
      setLoading(true)
      setError(null)
      
      // Clear cache when recipes are manually cleared
      try {
        await Promise.all([
          AsyncStorage.removeItem(RECIPE_CACHE_KEY),
          AsyncStorage.removeItem(RECIPE_CACHE_METADATA_KEY)
        ])
        console.log('🗑️ Cleared recipe cache')
      } catch (error) {
        console.error('Error clearing recipe cache:', error)
      }
      
      // Reset generator to ensure fresh recipes
      const { realisticRecipeGenerator } = await import('./RealisticRecipeGenerator')
      realisticRecipeGenerator.reset()
      console.log('🔄 Recipe generator reset')
      
      // Clear image cache
      const { recipeImageService } = require('./RecipeImageService')
      recipeImageService.clearAllCache()
      console.log('🗑️ Cleared all image caches')
      
      // Reset pantry hash to force regeneration
      setLastPantryHash('')
      ;(window as any).lastRecipeRegen = 0
      
      // Force fresh generation
      await loadRecipes({ force: true, reason: 'clear-and-regenerate' })
      
      console.log('✅ Recipes cleared and regenerated successfully')
    } catch (error) {
      console.error('❌ Error clearing and regenerating recipes:', error)
      setError('Failed to regenerate recipes. Please try again.')
      setLoading(false)
    }
  }

  const regenerateAIRecipes = async (): Promise<void> => {
    if (!user) return
    console.log('🔄 Manual regenerate requested - forcing new recipe generation')
    await loadRecipes({ force: true, reason: 'manual-regenerate' })
  }

  return (
    <RecipesContext.Provider
      value={{
        recipes,
        savedRecipes,
        loading,
        error,
        getRecipeById,
        searchRecipes,
        filterRecipes,
        saveRecipe,
        unsaveRecipe,
        updateSavedRecipe,
        rateRecipe,
        markRecipeCooked,
        toggleFavorite,
        createRecipe,
        updateRecipe,
        deleteRecipe,
        generateRecipeFromPantry,
        calculateIngredientMatch,
        getMissingIngredients,
        getRecipesByMealType,
        getRecipesByDifficulty,
        getFavoriteRecipes,
        getCookedRecipes,
        getSuggestedRecipes,
        refreshRecipes,
        regenerateAIRecipes,
        clearAndRegenerateRecipes,
      }}
    >
      {children}
    </RecipesContext.Provider>
  )
}

export function useRecipes() {
  const context = useContext(RecipesContext)
  if (context === undefined) {
    throw new Error('useRecipes must be used within a RecipesProvider')
  }
  return context
}

