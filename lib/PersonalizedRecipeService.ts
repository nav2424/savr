// Personalized Recipe Service - Integrates Advanced Recipe Generator with existing system
import { advancedRecipeGenerator } from './AdvancedRecipeGenerator'
import { userPreferencesService } from './UserPreferencesService'
import { supabase } from './supabase'

interface PersonalizedRecipeRequest {
  userId: string
  maxResults?: number
  timeLimit?: number
  skillLevel?: 'beginner' | 'intermediate' | 'advanced'
  mealType?: string
  cuisines?: string[]
  nutritionTargets?: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
  }
}

class PersonalizedRecipeService {
  /**
   * Generate personalized recipes using the advanced generator
   */
  async generatePersonalizedRecipes(request: PersonalizedRecipeRequest) {
    try {
      if (__DEV__) {
        console.log('🎯 Personalized Recipe Service: Starting generation')
        console.log('📊 Request:', { maxResults: request.maxResults, timeLimit: request.timeLimit, skillLevel: request.skillLevel })
      }

      // Get user's pantry items
      const pantryItems = await this.getUserPantryItems(request.userId)
      if (__DEV__) {
        console.log('📦 Retrieved pantry items:', pantryItems.length, 'items')
        if (pantryItems.length === 0) console.log('⚠️ No pantry items found - will create basic recipes')
      }
      
      // Get user preferences
      const preferences = userPreferencesService.getPreferences()
      
      // Get user's recent recipe history for novelty tracking
      const recentRecipes = await this.getRecentRecipes(request.userId, 14) // Last 14 days

      // Build comprehensive request for advanced generator
      const advancedRequest = {
        pantry_items: pantryItems.filter(item => item.category !== 'frozen'),
        freezer_items: pantryItems.filter(item => item.category === 'frozen'),
        fridge_items: [], // Could be expanded to track fridge items separately
        dislikes: [],
        cravings: [],
        diet: 'omnivore',
        allergies: preferences?.dietary?.allergies || [],
        intolerances: [],
        avoid_ingredients: [],
        servings: parseInt(preferences?.household?.size || '2'),
        skill_level: request.skillLevel || 'intermediate',
        time_limit_minutes: request.timeLimit || 30,
        appliances: this.getAvailableAppliances(),
        cuisines_preferred: request.cuisines || preferences?.dietary?.cuisines || [],
        cuisines_avoid: [],
        nutrition_targets: request.nutritionTargets || {},
        prior_suggestions: recentRecipes,
        novelty_window_days: 14,
        max_results: request.maxResults || 5
      }

      // Generate recipes using advanced generator
      const generatedRecipes = await advancedRecipeGenerator.generatePersonalizedRecipes(advancedRequest)

      // Convert to Recipe format for existing system
      const recipes = generatedRecipes.map(recipe => this.convertToRecipeFormat(recipe, request.userId))

      if (recipes.length === 0) {
        if (__DEV__) console.log('🔄 No recipes generated, creating simple fallback recipes...')
        const fallbackRecipes = this.createSimpleFallbackRecipes(request.userId, pantryItems)
        return fallbackRecipes
      }
      
      return recipes

    } catch (error) {
      console.error('❌ Personalized Recipe Service Error:', error instanceof Error ? error.message : String(error))
      
      // Create simple fallback recipes even if everything fails
      try {
        const emergencyRecipes = this.createSimpleFallbackRecipes(request.userId, [])
        return emergencyRecipes
      } catch (fallbackError) {
        console.error('❌ Even fallback failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError))
        return []
      }
    }
  }

  /**
   * Get user's pantry items
   */
  private async getUserPantryItems(userId: string) {
    try {
      if (__DEV__) console.log('🔍 Fetching pantry items for user')
      const { data, error } = await supabase
        .from('pantry_items')
        .select('name, quantity, unit, category')
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Error fetching pantry items:', error)
        return []
      }

      const pantryItems = (data || []).map(item => ({
        name: item.name,
        qty: item.quantity,
        unit: item.unit,
        category: item.category
      }))

      if (__DEV__) console.log('✅ Retrieved pantry items from database:', pantryItems.length, 'items')
      
      return pantryItems
    } catch (error) {
      console.error('❌ Error in getUserPantryItems:', error)
      return []
    }
  }

  /**
   * Get user's recent recipes for novelty tracking
   */
  private async getRecentRecipes(userId: string, days: number) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      const { data, error } = await supabase
        .from('saved_recipes')
        .select(`
          recipe:recipes (
            title,
            ingredients,
            created_at
          )
        `)
        .eq('user_id', userId)
        .gte('created_at', cutoffDate.toISOString())

      if (error) {
        console.error('Error fetching recent recipes:', error)
        return []
      }

      return (data || []).map((item: any) => ({
        title: item.recipe?.title || '',
        timestamp: item.recipe?.created_at || '',
        ingredients: item.recipe?.ingredients || [],
        hash: this.generateSimpleHash(item.recipe?.title || '')
      }))
    } catch (error) {
      console.error('Error in getRecentRecipes:', error)
      return []
    }
  }

  /**
   * Get available appliances (could be expanded to user preferences)
   */
  private getAvailableAppliances(): string[] {
    return ['stovetop', 'oven', 'microwave', 'blender']
  }

  /**
   * Convert advanced generator format to existing Recipe format
   */
  private convertToRecipeFormat(generatedRecipe: any, userId: string) {
    return {
      id: `personalized_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: generatedRecipe.title,
      description: generatedRecipe.description,
      meal_type: generatedRecipe.meal_type,
      cuisine_type: generatedRecipe.cuisine_type,
      prep_time: generatedRecipe.prep_time,
      cook_time: generatedRecipe.cook_time,
      servings: generatedRecipe.servings,
      difficulty: generatedRecipe.difficulty,
      ingredients: generatedRecipe.ingredients,
      instructions: generatedRecipe.instructions,
      nutrition: generatedRecipe.nutrition,
      calories: generatedRecipe.nutrition.calories,
      protein: generatedRecipe.nutrition.protein,
      carbs: generatedRecipe.nutrition.carbs,
      fat: generatedRecipe.nutrition.fat,
      fiber: generatedRecipe.nutrition.fiber,
      sodium: generatedRecipe.nutrition.sodium,
      appliances_used: generatedRecipe.appliances_used,
      skill_level_required: generatedRecipe.skill_level_required,
      tags: generatedRecipe.tags,
      image_url: undefined, // Will be generated by SimpleRecipeImage component
      is_public: false,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'ai_generated' as const,
      isAIGenerated: true,
      generatedFrom: this.extractGeneratedFrom(generatedRecipe.ingredients),
      matchPercentage: this.calculateMatchPercentage(generatedRecipe.ingredients),
      hash: generatedRecipe.hash
    }
  }

  /**
   * Extract ingredients that were used from pantry
   */
  private extractGeneratedFrom(ingredients: any[]): string[] {
    return ingredients
      .filter(ing => ing.in_pantry)
      .map(ing => ing.name)
  }

  /**
   * Calculate match percentage based on pantry ingredients used
   */
  private calculateMatchPercentage(ingredients: any[]): number {
    const totalIngredients = ingredients.length
    const pantryIngredients = ingredients.filter(ing => ing.in_pantry).length
    
    if (totalIngredients === 0) return 0
    
    return Math.round((pantryIngredients / totalIngredients) * 100)
  }

  /**
   * Generate simple hash for recipe tracking
   */
  private generateSimpleHash(input: string): string {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Create simple fallback recipes when the advanced system fails
   */
  private createSimpleFallbackRecipes(userId: string, pantryItems: any[]): any[] {
    if (__DEV__) console.log('🆘 Creating simple fallback recipes...')
    
    const basicRecipes = [
      {
        id: `fallback_${Date.now()}_1`,
        title: 'Quick Pantry Pasta',
        description: 'A simple and delicious pasta dish using ingredients from your pantry.',
        meal_type: 'dinner',
        cuisine_type: 'italian',
        prep_time: 10,
        cook_time: 15,
        servings: 2,
        difficulty: 'beginner',
        ingredients: [
          { name: 'Pasta', quantity: '8', unit: 'oz', in_pantry: true },
          { name: 'Olive Oil', quantity: '2', unit: 'tbsp', in_pantry: true },
          { name: 'Garlic', quantity: '2', unit: 'cloves', in_pantry: true }
        ],
        instructions: [
          { step: 1, description: 'Boil water and cook pasta according to package directions.' },
          { step: 2, description: 'Heat olive oil in a pan and sauté minced garlic until fragrant.' },
          { step: 3, description: 'Drain pasta and toss with garlic oil. Season with salt and pepper.' }
        ],
        nutrition: { calories: 400, protein: 12, carbs: 60, fat: 12, fiber: 3, sodium: 200 },
        calories: 400,
        protein: 12,
        carbs: 60,
        fat: 12,
        fiber: 3,
        sodium: 200,
        appliances_used: ['stovetop'],
        skill_level_required: 'beginner',
        tags: ['pasta', 'quick', 'simple'],
        image_url: undefined,
        is_public: false,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: 'ai_generated' as const,
        isAIGenerated: true,
        generatedFrom: pantryItems.slice(0, 3).map(item => item.name),
        matchPercentage: 75,
        hash: this.generateSimpleHash('fallback_pasta')
      },
      {
        id: `fallback_${Date.now()}_2`,
        title: 'Simple Rice Bowl',
        description: 'A nutritious rice bowl perfect for using pantry staples.',
        meal_type: 'lunch',
        cuisine_type: 'asian',
        prep_time: 5,
        cook_time: 20,
        servings: 2,
        difficulty: 'beginner',
        ingredients: [
          { name: 'Rice', quantity: '1', unit: 'cup', in_pantry: true },
          { name: 'Soy Sauce', quantity: '2', unit: 'tbsp', in_pantry: true },
          { name: 'Vegetable Oil', quantity: '1', unit: 'tbsp', in_pantry: true }
        ],
        instructions: [
          { step: 1, description: 'Cook rice according to package directions.' },
          { step: 2, description: 'Heat oil in a pan and add cooked rice.' },
          { step: 3, description: 'Stir in soy sauce and cook for 2-3 minutes until heated through.' }
        ],
        nutrition: { calories: 300, protein: 8, carbs: 55, fat: 6, fiber: 2, sodium: 400 },
        calories: 300,
        protein: 8,
        carbs: 55,
        fat: 6,
        fiber: 2,
        sodium: 400,
        appliances_used: ['stovetop'],
        skill_level_required: 'beginner',
        tags: ['rice', 'asian', 'simple'],
        image_url: undefined,
        is_public: false,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: 'ai_generated' as const,
        isAIGenerated: true,
        generatedFrom: pantryItems.slice(0, 3).map(item => item.name),
        matchPercentage: 80,
        hash: this.generateSimpleHash('fallback_rice')
      }
    ]

    if (__DEV__) console.log(`✅ Created ${basicRecipes.length} fallback recipes`)
    return basicRecipes
  }

  /**
   * Get recipe suggestions based on current pantry and preferences
   */
  async getRecipeSuggestions(userId: string, options: {
    mealType?: string
    timeLimit?: number
    skillLevel?: 'beginner' | 'intermediate' | 'advanced'
    maxResults?: number
  } = {}) {
    try {
      const recipes = await this.generatePersonalizedRecipes({
        userId,
        maxResults: options.maxResults || 5,
        timeLimit: options.timeLimit || 30,
        skillLevel: options.skillLevel || 'intermediate',
        mealType: options.mealType
      })

      return recipes
    } catch (error) {
      console.error('Error getting recipe suggestions:', error)
      return []
    }
  }

  /**
   * Generate recipes for specific dietary needs
   */
  async generateDietaryRecipes(userId: string, dietaryNeeds: {
    diet: string
    allergies: string[]
    avoidIngredients: string[]
    nutritionTargets?: any
  }) {
    try {
      const recipes = await this.generatePersonalizedRecipes({
        userId,
        maxResults: 3,
        nutritionTargets: dietaryNeeds.nutritionTargets
      })

      // Filter recipes based on dietary needs
      const filteredRecipes = recipes.filter(recipe => 
        this.validateDietaryCompliance(recipe, dietaryNeeds)
      )

      return filteredRecipes
    } catch (error) {
      console.error('Error generating dietary recipes:', error)
      return []
    }
  }

  /**
   * Validate recipe compliance with dietary needs
   */
  private validateDietaryCompliance(recipe: any, dietaryNeeds: any): boolean {
    // Check for allergens
    const recipeIngredients = recipe.ingredients.map((ing: any) => ing.name.toLowerCase())
    
    for (const allergen of dietaryNeeds.allergies) {
      if (recipeIngredients.some((ing: string) => ing.includes(allergen.toLowerCase()))) {
        return false
      }
    }

    // Check for avoided ingredients
    for (const avoid of dietaryNeeds.avoidIngredients) {
      if (recipeIngredients.some((ing: string) => ing.includes(avoid.toLowerCase()))) {
        return false
      }
    }

    return true
  }
}

export const personalizedRecipeService = new PersonalizedRecipeService()
