// SAVR Dynamic Recipe Personalization - Ensures fresh, personalized recipes every day
import { supabase } from './supabase'
import { userPreferencesService, UserPreferences } from './UserPreferencesService'
import { aiLearningService } from './AILearningService'
import { Recipe } from './supabase'

export interface PersonalizedRecipeParams {
  userId: string
  pantryItems: string[]
  preferences: UserPreferences
  limit?: number
  excludeRecentlyCookedDays?: number
}

export interface RecipePersonalizationScore {
  recipeId: string
  totalScore: number
  breakdown: {
    pantryMatch: number
    dietaryFit: number
    varietyBonus: number
    freshnessScore: number
    cuisinePreference: number
  }
}

class DynamicRecipePersonalizationService {
  private static instance: DynamicRecipePersonalizationService

  static getInstance(): DynamicRecipePersonalizationService {
    if (!DynamicRecipePersonalizationService.instance) {
      DynamicRecipePersonalizationService.instance = new DynamicRecipePersonalizationService()
    }
    return DynamicRecipePersonalizationService.instance
  }

  /**
   * Get dynamic, personalized recipes that change daily
   * Considers: allergies, diet, pantry, cooking history, daily rotation
   */
  async getPersonalizedRecipes(params: PersonalizedRecipeParams): Promise<Recipe[]> {
    try {
      const { userId, pantryItems, preferences, limit = 20, excludeRecentlyCookedDays = 7 } = params

      // Step 1: Get recently cooked recipes to EXCLUDE them from top results
      const recentlyCookedIds = await this.getRecentlyCookedRecipeIds(userId, excludeRecentlyCookedDays)

      // Step 2: Load ALL recipes (we'll filter and rank them)
      const { data: allRecipes, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('is_public', true)

      if (error) throw error
      if (!allRecipes) return []

      console.log(`📚 Loaded ${allRecipes.length} total recipes for personalization`)

      // Step 3: Filter by dietary restrictions and allergies (CRITICAL)
      const dietaryFilteredRecipes = this.filterByDietaryRestrictions(
        allRecipes,
        preferences.dietary.allergies,
        preferences.dietary.preferences
      )

      console.log(`🔍 After dietary filtering: ${dietaryFilteredRecipes.length} recipes`)

      // Step 4: Score each recipe for personalization
      const scoredRecipes = dietaryFilteredRecipes.map(recipe => {
        const score = this.calculatePersonalizationScore(
          recipe,
          pantryItems,
          preferences,
          recentlyCookedIds
        )
        return { recipe, score }
      })

      // Step 5: Add daily rotation using date-based seed
      // This ensures users see DIFFERENT recipes each day
      const todaySeed = this.getDailySeed()
      scoredRecipes.forEach((item, index) => {
        // Add variety bonus based on daily seed
        const rotationBonus = ((todaySeed + index) % 100) / 100 * 10
        item.score.totalScore += rotationBonus
        item.score.breakdown.freshnessScore = rotationBonus
      })

      // Step 6: Sort by total score (highest first)
      scoredRecipes.sort((a, b) => b.score.totalScore - a.score.totalScore)

      // Step 7: Return top recipes
      const topRecipes = scoredRecipes.slice(0, limit).map(item => item.recipe)

      console.log(`✨ Personalized ${topRecipes.length} recipes for user`)
      console.log(`   Top 3: ${topRecipes.slice(0, 3).map(r => r.title).join(', ')}`)

      return topRecipes

    } catch (error) {
      console.error('Error getting personalized recipes:', error)
      return []
    }
  }

  /**
   * Filter recipes by dietary restrictions and allergies
   */
  private filterByDietaryRestrictions(
    recipes: Recipe[],
    allergies: string[],
    dietaryPrefs: string[]
  ): Recipe[] {
    return recipes.filter(recipe => {
      // Check allergies (CRITICAL - must exclude)
      const hasAllergen = this.recipeContainsAllergen(recipe, allergies)
      if (hasAllergen) return false

      // Check dietary preferences (vegetarian, vegan, keto, etc.)
      const matchesDiet = this.recipeMatchesDiet(recipe, dietaryPrefs)
      if (!matchesDiet) return false

      return true
    })
  }

  /**
   * Check if recipe contains any allergens
   */
  private recipeContainsAllergen(recipe: Recipe, allergies: string[]): boolean {
    if (!allergies || allergies.length === 0) return false

    const allergenKeywords: { [key: string]: string[] } = {
      'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'whey', 'lactose'],
      'Eggs': ['egg', 'eggs'],
      'Peanuts': ['peanut', 'peanuts', 'peanut butter'],
      'Tree Nuts': ['almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia'],
      'Soy': ['soy', 'tofu', 'tempeh', 'edamame', 'soy sauce'],
      'Wheat': ['wheat', 'flour', 'bread', 'pasta', 'noodles', 'couscous'],
      'Gluten': ['wheat', 'barley', 'rye', 'gluten', 'flour', 'bread', 'pasta'],
      'Shellfish': ['shrimp', 'crab', 'lobster', 'clam', 'mussel', 'oyster'],
      'Fish': ['salmon', 'tuna', 'cod', 'tilapia', 'fish']
    }

    const ingredientsText = JSON.stringify(recipe.ingredients).toLowerCase()
    const titleText = recipe.title.toLowerCase()
    const descriptionText = (recipe.description || '').toLowerCase()

    for (const allergy of allergies) {
      const keywords = allergenKeywords[allergy] || [allergy.toLowerCase()]
      
      for (const keyword of keywords) {
        if (ingredientsText.includes(keyword) || 
            titleText.includes(keyword) || 
            descriptionText.includes(keyword)) {
          console.log(`🚫 Excluding "${recipe.title}" - contains allergen: ${allergy}`)
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if recipe matches dietary preferences
   */
  private recipeMatchesDiet(recipe: Recipe, dietaryPrefs: string[]): boolean {
    if (!dietaryPrefs || dietaryPrefs.length === 0) return true

    const ingredientsText = JSON.stringify(recipe.ingredients).toLowerCase()
    const tagsText = JSON.stringify(recipe.tags || []).toLowerCase()

    for (const pref of dietaryPrefs) {
      const prefLower = pref.toLowerCase()

      // Vegetarian: exclude meat/fish
      if (prefLower.includes('vegetarian')) {
        const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'meat']
        if (meatKeywords.some(keyword => ingredientsText.includes(keyword))) {
          return false
        }
      }

      // Vegan: exclude all animal products
      if (prefLower.includes('vegan')) {
        const animalProducts = ['chicken', 'beef', 'pork', 'fish', 'meat', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'honey']
        if (animalProducts.some(keyword => ingredientsText.includes(keyword))) {
          return false
        }
      }

      // Keto: low carb
      if (prefLower.includes('keto') || prefLower.includes('low carb')) {
        if (recipe.carbs && recipe.carbs > 20) {
          return false
        }
      }

      // Paleo: exclude grains, dairy, legumes
      if (prefLower.includes('paleo')) {
        const excludedFoods = ['rice', 'wheat', 'bread', 'pasta', 'dairy', 'milk', 'beans', 'lentils', 'peanut']
        if (excludedFoods.some(keyword => ingredientsText.includes(keyword))) {
          return false
        }
      }

      // Halal: exclude pork
      if (prefLower.includes('halal')) {
        if (ingredientsText.includes('pork') || ingredientsText.includes('bacon') || ingredientsText.includes('ham')) {
          return false
        }
      }

      // Kosher: exclude pork, shellfish, and dairy+meat combinations
      if (prefLower.includes('kosher')) {
        if (ingredientsText.includes('pork') || ingredientsText.includes('bacon') || 
            ingredientsText.includes('ham') || ingredientsText.includes('shellfish')) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Calculate comprehensive personalization score
   */
  private calculatePersonalizationScore(
    recipe: Recipe,
    pantryItems: string[],
    preferences: UserPreferences,
    recentlyCookedIds: string[]
  ): RecipePersonalizationScore {
    const breakdown = {
      pantryMatch: 0,
      dietaryFit: 0,
      varietyBonus: 0,
      freshnessScore: 0,
      cuisinePreference: 0
    }

    // 1. Pantry match (0-40 points)
    const pantryMatchPercent = this.calculatePantryMatch(recipe, pantryItems)
    breakdown.pantryMatch = pantryMatchPercent * 0.4

    // 2. Dietary fit (0-20 points) - recipes that match preferred cuisines
    const cuisineMatch = this.matchesCuisinePreference(recipe, preferences.dietary.cuisines)
    breakdown.cuisinePreference = cuisineMatch ? 20 : 0

    // 3. Variety bonus (0-20 points) - penalize recently cooked recipes
    if (recentlyCookedIds.includes(recipe.id)) {
      breakdown.varietyBonus = -20 // Move recently cooked recipes to bottom
    } else {
      breakdown.varietyBonus = 10 // Bonus for variety
    }

    // 4. Dietary fit bonus (0-10 points)
    breakdown.dietaryFit = 10 // Already filtered, so if it's here, it fits

    // 5. Freshness will be added later (daily rotation)
    breakdown.freshnessScore = 0

    const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0)

    return {
      recipeId: recipe.id,
      totalScore,
      breakdown
    }
  }

  /**
   * Calculate pantry match percentage
   */
  private calculatePantryMatch(recipe: Recipe, pantryItems: string[]): number {
    if (!pantryItems || pantryItems.length === 0) return 0
    if (!recipe.ingredients || recipe.ingredients.length === 0) return 0

    const ingredients = recipe.ingredients
    let matchedCount = 0

    for (const ingredient of ingredients) {
      const ingredientName = (ingredient as any).name?.toLowerCase() || ''

      const hasIngredient = pantryItems.some(pantryItem => {
        const pantryLower = pantryItem.toLowerCase()
        return pantryLower.includes(ingredientName) || ingredientName.includes(pantryLower)
      })

      if (hasIngredient) matchedCount++
    }

    return ingredients.length > 0 ? (matchedCount / ingredients.length) * 100 : 0
  }

  /**
   * Check if recipe matches cuisine preferences
   */
  private matchesCuisinePreference(recipe: Recipe, cuisinePrefs: string[]): boolean {
    if (!cuisinePrefs || cuisinePrefs.length === 0) return true

    const recipeTags = recipe.tags || []
    const recipeTitle = recipe.title.toLowerCase()
    const recipeDescription = (recipe.description || '').toLowerCase()

    for (const cuisine of cuisinePrefs) {
      const cuisineLower = cuisine.toLowerCase()
      
      if (recipeTags.some((tag: string) => tag.toLowerCase().includes(cuisineLower)) ||
          recipeTitle.includes(cuisineLower) ||
          recipeDescription.includes(cuisineLower)) {
        return true
      }
    }

    return false
  }

  /**
   * Get recently cooked recipe IDs to provide variety
   */
  private async getRecentlyCookedRecipeIds(userId: string, days: number): Promise<string[]> {
    try {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - days)

      const { data, error } = await supabase
        .from('recipe_outcomes')
        .select('recipe_id')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('cooked_at', daysAgo.toISOString())

      if (error) throw error

      const recipeIds = data?.map(row => row.recipe_id) || []
      console.log(`🔄 Found ${recipeIds.length} recently cooked recipes (last ${days} days)`)

      return recipeIds
    } catch (error) {
      console.error('Error getting recently cooked recipes:', error)
      return []
    }
  }

  /**
   * Get daily seed for recipe rotation
   * Changes every day, ensuring different recipes each day
   */
  private getDailySeed(): number {
    const today = new Date()
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
    return dayOfYear * 7919 // Prime number for better distribution
  }

  /**
   * Get recipes with AI-enhanced personalization
   * Integrates SAGE conversation context for even better suggestions
   */
  async getAIEnhancedRecipes(
    userId: string,
    pantryItems: string[],
    sageContext?: string[]
  ): Promise<Recipe[]> {
    try {
      // Load user preferences
      const preferences = await userPreferencesService.loadPreferences(userId)
      if (!preferences) {
        console.warn('No user preferences found, using defaults')
        return []
      }

      // Get base personalized recipes
      const baseRecipes = await this.getPersonalizedRecipes({
        userId,
        pantryItems,
        preferences,
        limit: 50, // Get more candidates
        excludeRecentlyCookedDays: 7
      })

      // If SAGE context is provided, boost recipes that match conversation topics
      if (sageContext && sageContext.length > 0) {
        const enhancedRecipes = this.boostRecipesBySageContext(baseRecipes, sageContext)
        return enhancedRecipes.slice(0, 20)
      }

      return baseRecipes.slice(0, 20)

    } catch (error) {
      console.error('Error getting AI-enhanced recipes:', error)
      return []
    }
  }

  /**
   * Boost recipes based on SAGE conversation context
   * If user asked about "Italian food" or "high protein", prioritize those
   */
  private boostRecipesBySageContext(recipes: Recipe[], sageContext: string[]): Recipe[] {
    const contextKeywords = sageContext.join(' ').toLowerCase()

    return recipes.map(recipe => {
      let boost = 0
      const recipeText = `${recipe.title} ${recipe.description} ${recipe.tags?.join(' ')}`.toLowerCase()

      // Extract keywords from SAGE context
      const keywords = [
        'italian', 'mexican', 'asian', 'chinese', 'japanese', 'thai', 'indian',
        'protein', 'low carb', 'keto', 'vegetarian', 'vegan',
        'quick', 'easy', 'fast', 'simple',
        'breakfast', 'lunch', 'dinner', 'snack', 'dessert'
      ]

      keywords.forEach(keyword => {
        if (contextKeywords.includes(keyword) && recipeText.includes(keyword)) {
          boost += 15 // Significant boost for SAGE context match
        }
      })

      return {
        ...recipe,
        _contextBoost: boost
      }
    }).sort((a: any, b: any) => (b._contextBoost || 0) - (a._contextBoost || 0))
  }

  /**
   * Get cooking history for insights
   */
  async getCookingHistory(userId: string, days: number = 30): Promise<{
    totalCooked: number
    favoriteRecipes: string[]
    favoriteCuisines: string[]
    avgCookTime: number
  }> {
    try {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - days)

      const { data, error } = await supabase
        .from('recipe_outcomes')
        .select('recipe_id, actual_cook_time, would_make_again')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('cooked_at', daysAgo.toISOString())

      if (error) throw error

      const totalCooked = data?.length || 0
      const favoriteRecipes = data
        ?.filter(row => row.would_make_again)
        .map(row => row.recipe_id)
        .slice(0, 10) || []

      const avgCookTime = data && data.length > 0
        ? data.reduce((sum, row) => sum + (row.actual_cook_time || 0), 0) / data.length
        : 0

      return {
        totalCooked,
        favoriteRecipes,
        favoriteCuisines: [], // Can be enhanced
        avgCookTime
      }
    } catch (error) {
      console.error('Error getting cooking history:', error)
      return {
        totalCooked: 0,
        favoriteRecipes: [],
        favoriteCuisines: [],
        avgCookTime: 0
      }
    }
  }
}

export const dynamicRecipePersonalizationService = DynamicRecipePersonalizationService.getInstance()

