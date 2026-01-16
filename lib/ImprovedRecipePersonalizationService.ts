// SAVR Improved Recipe Personalization - Stable, Learning-Based Recommendations
import { supabase, Recipe } from './supabase'
import { userPreferencesService, UserPreferences } from './UserPreferencesService'
import { recipePreferenceLearningService } from './RecipePreferenceLearningService'

export interface PersonalizedRecipeParams {
  userId: string
  pantryItems: string[]
  preferences: UserPreferences
  limit?: number
  stabilityDays?: number // How many days to keep similar ordering
}

export interface RecipeScore {
  recipeId: string
  totalScore: number
  breakdown: {
    pantryMatch: number
    userPreference: number
    dietaryFit: number
    freshnessBonus: number
    varietyPenalty: number
  }
}

class ImprovedRecipePersonalizationService {
  private static instance: ImprovedRecipePersonalizationService

  static getInstance(): ImprovedRecipePersonalizationService {
    if (!ImprovedRecipePersonalizationService.instance) {
      ImprovedRecipePersonalizationService.instance = new ImprovedRecipePersonalizationService()
    }
    return ImprovedRecipePersonalizationService.instance
  }

  /**
   * Get personalized recipes with STABLE ordering (changes weekly, not daily)
   * Learns from user behavior to show recipes they'll actually cook
   */
  async getPersonalizedRecipes(params: PersonalizedRecipeParams): Promise<Recipe[]> {
    try {
      const { userId, pantryItems, preferences, limit = 20, stabilityDays = 7 } = params

      console.log(`🎯 Getting personalized recipes for user ${userId}...`)

      // Load user's cooking preferences from history
      await recipePreferenceLearningService.loadUserPreferences(userId)

      // Step 1: Load all public recipes
      const { data: allRecipes, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('is_public', true)

      if (error) throw error
      if (!allRecipes) return []

      console.log(`📚 Loaded ${allRecipes.length} total recipes`)

      // Step 2: Filter by dietary restrictions and allergies (CRITICAL)
      const dietaryFiltered = this.filterByDietaryRestrictions(
        allRecipes,
        preferences.dietary.allergies,
        preferences.dietary.preferences
      )

      console.log(`🔍 After dietary filtering: ${dietaryFiltered.length} recipes`)

      // Step 3: Filter out disliked recipes
      const nonDisliked = dietaryFiltered.filter(recipe => 
        !recipePreferenceLearningService.isDisliked(userId, recipe.id)
      )

      console.log(`👍 After removing dislikes: ${nonDisliked.length} recipes`)

      // Step 4: Score each recipe based on LEARNED PREFERENCES + pantry
      const scoredRecipes = nonDisliked.map(recipe => {
        const score = this.calculatePersonalizedScore(
          recipe,
          userId,
          pantryItems,
          preferences
        )
        return { recipe, score }
      })

      // Step 5: Apply STABLE weekly rotation (not daily)
      const weeklySeed = this.getWeeklySeed()
      scoredRecipes.forEach((item, index) => {
        // Small rotation bonus that changes weekly, not daily
        const rotationBonus = ((weeklySeed + index) % 50) / 50 * 5 // Max 5 points
        item.score.totalScore += rotationBonus
        item.score.breakdown.freshnessBonus = rotationBonus
      })

      // Step 6: Sort by total score (highest first)
      scoredRecipes.sort((a, b) => b.score.totalScore - a.score.totalScore)

      // Step 7: Return top recipes
      const topRecipes = scoredRecipes.slice(0, limit).map(item => item.recipe)

      console.log(`✨ Personalized ${topRecipes.length} recipes`)
      console.log(`   Top 5: ${topRecipes.slice(0, 5).map(r => r.title).join(', ')}`)

      return topRecipes

    } catch (error) {
      console.error('Error getting personalized recipes:', error)
      return []
    }
  }

  /**
   * Calculate personalized score based on LEARNED user preferences
   */
  private calculatePersonalizedScore(
    recipe: Recipe,
    userId: string,
    pantryItems: string[],
    preferences: UserPreferences
  ): RecipeScore {
    const breakdown = {
      pantryMatch: 0,
      userPreference: 0,
      dietaryFit: 0,
      freshnessBonus: 0,
      varietyPenalty: 0
    }

    // 1. Pantry Match (0-30 points)
    const pantryMatchPercent = this.calculatePantryMatch(recipe, pantryItems)
    breakdown.pantryMatch = pantryMatchPercent * 0.3

    // 2. USER LEARNED PREFERENCE (0-40 points) - MOST IMPORTANT
    // This is what makes it personalized!
    let preferenceScore = 0

    // Score based on favorite ingredients
    if (recipe.ingredients) {
      recipe.ingredients.forEach((ing: any) => {
        const ingScore = recipePreferenceLearningService.getIngredientScore(userId, ing.name || '')
        preferenceScore += ingScore * 2 // 2x multiplier for ingredient preferences
      })
    }

    // Score based on favorite cuisine
    const cuisineScore = recipePreferenceLearningService.getCuisineScore(userId, recipe.cuisine_type || '')
    preferenceScore += cuisineScore * 3 // 3x multiplier for cuisine preferences

    breakdown.userPreference = Math.min(40, preferenceScore) // Cap at 40 points

    // 3. Dietary fit bonus (0-10 points)
    const matchesCuisinePrefs = this.matchesCuisinePreference(recipe, preferences.dietary.cuisines)
    breakdown.dietaryFit = matchesCuisinePrefs ? 10 : 5

    // 4. Variety penalty - penalize recently cooked recipes
    if (recipePreferenceLearningService.wasRecentlyCooked(userId, recipe.id)) {
      breakdown.varietyPenalty = -15 // Move recently cooked recipes down
    }

    // 5. Freshness bonus (added later in main function)
    breakdown.freshnessBonus = 0

    const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0)

    return {
      recipeId: recipe.id,
      totalScore,
      breakdown
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

      // Check dietary preferences
      const matchesDiet = this.recipeMatchesDiet(recipe, dietaryPrefs)
      if (!matchesDiet) return false

      return true
    })
  }

  /**
   * Check if recipe contains allergens
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

    for (const pref of dietaryPrefs) {
      const prefLower = pref.toLowerCase()

      if (prefLower.includes('vegetarian')) {
        const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'meat']
        if (meatKeywords.some(keyword => ingredientsText.includes(keyword))) {
          return false
        }
      }

      if (prefLower.includes('vegan')) {
        const animalProducts = ['chicken', 'beef', 'pork', 'fish', 'meat', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'honey']
        if (animalProducts.some(keyword => ingredientsText.includes(keyword))) {
          return false
        }
      }

      if (prefLower.includes('keto') || prefLower.includes('low carb')) {
        if (recipe.carbs && recipe.carbs > 20) {
          return false
        }
      }

      if (prefLower.includes('halal')) {
        if (ingredientsText.includes('pork') || ingredientsText.includes('bacon') || ingredientsText.includes('ham')) {
          return false
        }
      }
    }

    return true
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
   * Get WEEKLY seed for stability (not daily)
   * This ensures recipes stay in similar order for a week
   */
  private getWeeklySeed(): number {
    const today = new Date()
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000)
    const weekOfYear = Math.floor(dayOfYear / 7)
    
    return weekOfYear * 7919 // Prime number for distribution
  }

  /**
   * Get personalized insights for debugging
   */
  async getPersonalizationInsights(userId: string): Promise<{
    topIngredients: string[]
    topCuisines: string[]
    cookedCount: number
    savedCount: number
  }> {
    const insights = await recipePreferenceLearningService.getUserInsights(userId)
    
    return {
      topIngredients: insights.topIngredients.map(i => i.name),
      topCuisines: insights.topCuisines.map(c => c.name),
      cookedCount: insights.totalCooked,
      savedCount: insights.totalSaved
    }
  }
}

export const improvedRecipePersonalizationService = ImprovedRecipePersonalizationService.getInstance()

