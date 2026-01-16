// SAVR Recipe Preference Learning Service
// Learns from user behavior to personalize recipe suggestions
import { supabase } from './supabase'
import { MemoryCache } from './PerformanceOptimizer'

interface RecipeInteraction {
  recipe_id: string
  recipe_title: string
  action: 'viewed' | 'saved' | 'cooked' | 'rated' | 'unsaved'
  rating?: number
  ingredients: string[]
  cuisine_type?: string
  meal_type?: string
  timestamp: string
}

interface UserRecipePreferences {
  favoriteIngredients: Map<string, number> // ingredient -> frequency score
  favoriteCuisines: Map<string, number> // cuisine -> frequency score
  favoriteMealTypes: Map<string, number> // meal_type -> frequency score
  cookedRecipes: Set<string> // recipe IDs
  savedRecipes: Set<string>
  dislikedRecipes: Set<string> // low ratings
}

class RecipePreferenceLearningService {
  private static instance: RecipePreferenceLearningService
  private userPreferencesCache: Map<string, UserRecipePreferences> = new Map()
  private interactionsCache = new MemoryCache<any[]>() // Cache DB results for 5 min

  static getInstance(): RecipePreferenceLearningService {
    if (!RecipePreferenceLearningService.instance) {
      RecipePreferenceLearningService.instance = new RecipePreferenceLearningService()
    }
    return RecipePreferenceLearningService.instance
  }

  /**
   * Track user interaction with a recipe
   */
  async trackInteraction(
    userId: string,
    recipeId: string,
    recipeTitle: string,
    action: RecipeInteraction['action'],
    metadata?: {
      rating?: number
      ingredients?: string[]
      cuisine_type?: string
      meal_type?: string
    }
  ): Promise<void> {
    try {
      // Store interaction in database
      await supabase.from('recipe_interactions').insert({
        user_id: userId,
        recipe_id: recipeId,
        recipe_title: recipeTitle,
        action,
        rating: metadata?.rating,
        ingredients: metadata?.ingredients,
        cuisine_type: metadata?.cuisine_type,
        meal_type: metadata?.meal_type,
        timestamp: new Date().toISOString()
      })

      // Clear caches to force refresh on next load
      this.invalidateCache(userId)
      this.interactionsCache.delete(`interactions_${userId}`)
      
      console.log(`📊 Tracked ${action} for recipe: ${recipeTitle}`)
    } catch (error) {
      console.error('Error tracking recipe interaction:', error)
    }
  }

  /**
   * Load user preferences from historical interactions
   * OPTIMIZED: With caching to prevent excessive DB calls
   */
  async loadUserPreferences(userId: string): Promise<UserRecipePreferences> {
    // Check memory cache first (instant)
    if (this.userPreferencesCache.has(userId)) {
      return this.userPreferencesCache.get(userId)!
    }

    try {
      // Check if we have cached DB results (5 min TTL)
      let interactions = this.interactionsCache.get(`interactions_${userId}`)
      
      if (!interactions) {
        // Only hit DB if cache expired
        const { data, error } = await supabase
          .from('recipe_interactions')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(200) // Reduced from 500 to 200 for speed

        if (error) throw error
        
        interactions = data || []
        
        // Cache DB results for 5 minutes
        this.interactionsCache.set(`interactions_${userId}`, interactions, 300000)
      }

      const preferences: UserRecipePreferences = {
        favoriteIngredients: new Map(),
        favoriteCuisines: new Map(),
        favoriteMealTypes: new Map(),
        cookedRecipes: new Set(),
        savedRecipes: new Set(),
        dislikedRecipes: new Set()
      }

      if (!interactions || interactions.length === 0) {
        this.userPreferencesCache.set(userId, preferences)
        return preferences
      }

      // Process interactions to build preferences (OPTIMIZED)
      interactions.forEach((interaction: any) => {
        const recipeId = interaction.recipe_id
        
        // Track cooked recipes
        if (interaction.action === 'cooked') {
          preferences.cookedRecipes.add(recipeId)
          
          // Ingredients from cooked recipes get higher weight
          if (interaction.ingredients) {
            interaction.ingredients.forEach((ing: string) => {
              const current = preferences.favoriteIngredients.get(ing) || 0
              preferences.favoriteIngredients.set(ing, current + 3) // 3x weight for cooked
            })
          }
          
          // Cuisine preference from cooked recipes
          if (interaction.cuisine_type) {
            const current = preferences.favoriteCuisines.get(interaction.cuisine_type) || 0
            preferences.favoriteCuisines.set(interaction.cuisine_type, current + 3)
          }
          
          // Meal type preference
          if (interaction.meal_type) {
            const current = preferences.favoriteMealTypes.get(interaction.meal_type) || 0
            preferences.favoriteMealTypes.set(interaction.meal_type, current + 3)
          }
        }
        
        // Track saved recipes
        if (interaction.action === 'saved') {
          preferences.savedRecipes.add(recipeId)
          
          // Ingredients from saved recipes get medium weight
          if (interaction.ingredients) {
            interaction.ingredients.forEach((ing: string) => {
              const current = preferences.favoriteIngredients.get(ing) || 0
              preferences.favoriteIngredients.set(ing, current + 1.5)
            })
          }
          
          if (interaction.cuisine_type) {
            const current = preferences.favoriteCuisines.get(interaction.cuisine_type) || 0
            preferences.favoriteCuisines.set(interaction.cuisine_type, current + 1.5)
          }
        }
        
        // Track low-rated recipes (disliked)
        if (interaction.action === 'rated' && interaction.rating && interaction.rating <= 2) {
          preferences.dislikedRecipes.add(recipeId)
        }
      })

      // Cache the results
      this.userPreferencesCache.set(userId, preferences)
      
      console.log(`📚 Loaded preferences for user ${userId}:`)
      console.log(`   - ${preferences.cookedRecipes.size} cooked recipes`)
      console.log(`   - ${preferences.savedRecipes.size} saved recipes`)
      console.log(`   - ${preferences.favoriteIngredients.size} favorite ingredients`)
      console.log(`   - Top 3 ingredients: ${Array.from(preferences.favoriteIngredients.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([ing]) => ing)
        .join(', ')}`)

      return preferences
    } catch (error) {
      console.error('Error loading user preferences:', error)
      return {
        favoriteIngredients: new Map(),
        favoriteCuisines: new Map(),
        favoriteMealTypes: new Map(),
        cookedRecipes: new Set(),
        savedRecipes: new Set(),
        dislikedRecipes: new Set()
      }
    }
  }

  /**
   * Get ingredient score based on user preferences
   */
  getIngredientScore(userId: string, ingredient: string): number {
    const preferences = this.userPreferencesCache.get(userId)
    if (!preferences) return 0
    
    const lowerIng = ingredient.toLowerCase()
    let maxScore = 0
    
    // Check all favorite ingredients for partial matches
    preferences.favoriteIngredients.forEach((score, favIng) => {
      const lowerFav = favIng.toLowerCase()
      if (lowerIng.includes(lowerFav) || lowerFav.includes(lowerIng)) {
        maxScore = Math.max(maxScore, score)
      }
    })
    
    return maxScore
  }

  /**
   * Get cuisine score based on user preferences
   */
  getCuisineScore(userId: string, cuisine?: string): number {
    if (!cuisine) return 0
    
    const preferences = this.userPreferencesCache.get(userId)
    if (!preferences) return 0
    
    return preferences.favoriteCuisines.get(cuisine) || 0
  }

  /**
   * Check if recipe was recently cooked (avoid repetition)
   */
  wasRecentlyCooked(userId: string, recipeId: string): boolean {
    const preferences = this.userPreferencesCache.get(userId)
    if (!preferences) return false
    
    return preferences.cookedRecipes.has(recipeId)
  }

  /**
   * Check if recipe is disliked
   */
  isDisliked(userId: string, recipeId: string): boolean {
    const preferences = this.userPreferencesCache.get(userId)
    if (!preferences) return false
    
    return preferences.dislikedRecipes.has(recipeId)
  }

  /**
   * Get top favorite ingredients
   */
  getTopIngredients(userId: string, limit: number = 10): string[] {
    const preferences = this.userPreferencesCache.get(userId)
    if (!preferences) return []
    
    return Array.from(preferences.favoriteIngredients.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([ing]) => ing)
  }

  /**
   * Get top favorite cuisines
   */
  getTopCuisines(userId: string, limit: number = 5): string[] {
    const preferences = this.userPreferencesCache.get(userId)
    if (!preferences) return []
    
    return Array.from(preferences.favoriteCuisines.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cuisine]) => cuisine)
  }

  /**
   * Clear cache when preferences change
   */
  private invalidateCache(userId: string): void {
    this.userPreferencesCache.delete(userId)
  }

  /**
   * Get insights for user (for debugging/display)
   */
  async getUserInsights(userId: string): Promise<{
    topIngredients: { name: string; score: number }[]
    topCuisines: { name: string; score: number }[]
    topMealTypes: { name: string; score: number }[]
    totalCooked: number
    totalSaved: number
  }> {
    const prefs = await this.loadUserPreferences(userId)
    
    return {
      topIngredients: Array.from(prefs.favoriteIngredients.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, score]) => ({ name, score })),
      topCuisines: Array.from(prefs.favoriteCuisines.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, score]) => ({ name, score })),
      topMealTypes: Array.from(prefs.favoriteMealTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, score]) => ({ name, score })),
      totalCooked: prefs.cookedRecipes.size,
      totalSaved: prefs.savedRecipes.size
    }
  }
}

export const recipePreferenceLearningService = RecipePreferenceLearningService.getInstance()

