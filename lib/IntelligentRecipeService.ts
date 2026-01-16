// SAVR Intelligent Recipe Service - Auto-scales and personalizes recipes
import { aiLearningService } from './AILearningService'
import { userPreferencesService } from './UserPreferencesService'

export interface IntelligentRecipe {
  id: string
  title: string
  description: string
  image: string
  serves: number
  originalServes: number
  cookTime: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  ingredients: IntelligentIngredient[]
  instructions: string[]
  nutrition: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
    sugar?: number
  }
  dietaryTags: string[]
  cuisineType: string
  // AI-enhanced properties
  householdScaled: boolean
  personalizedFor: string
  confidence: number
  reasoning: string
  // Subtle health hints (no pressure, no tracking)
  gentleHealthHints: {
    proteinLevel: 'high' | 'moderate' | 'low'
    carbLevel: 'high' | 'moderate' | 'low'
    fiberLevel: 'high' | 'moderate' | 'low'
    healthTags: string[]
    gentleSuggestion?: string
  }
}

export interface IntelligentIngredient {
  name: string
  amount: number
  unit: string
  originalAmount: number
  scaled: boolean
  category: string
  substitutions?: string[]
  notes?: string
}

class IntelligentRecipeService {
  private static instance: IntelligentRecipeService
  private baseRecipes: any[] = []

  static getInstance(): IntelligentRecipeService {
    if (!IntelligentRecipeService.instance) {
      IntelligentRecipeService.instance = new IntelligentRecipeService()
    }
    return IntelligentRecipeService.instance
  }

  // Get personalized recipes for user
  async getPersonalizedRecipes(userId: string, context: {
    timeOfDay?: string
    pantryItems?: string[]
    occasion?: string
    maxCookTime?: number
  }): Promise<IntelligentRecipe[]> {
    try {
      // Get user preferences and behavior data
      const preferences = await userPreferencesService.loadPreferences(userId)
      const householdSize = preferences?.household?.size ? parseInt(preferences.household.size) : 1
      
      // Get base recipes (this would come from your recipe database)
      const baseRecipes = await this.getBaseRecipes(context)
      
      // Transform each recipe for the user
      const personalizedRecipes: IntelligentRecipe[] = []
      
      for (const recipe of baseRecipes) {
        const intelligentRecipe = await this.personalizeRecipe(recipe, userId, householdSize, preferences)
        if (intelligentRecipe) {
          personalizedRecipes.push(intelligentRecipe)
        }
      }

      // Sort by confidence and relevance
      return personalizedRecipes
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10) // Return top 10 most relevant recipes
    } catch (error) {
      console.error('Error getting personalized recipes:', error)
      return []
    }
  }

  // Personalize a single recipe for the user
  private async personalizeRecipe(
    baseRecipe: any, 
    userId: string, 
    householdSize: number, 
    preferences: any
  ): Promise<IntelligentRecipe | null> {
    try {
      // Scale recipe for household size
      const scaledRecipe = this.scaleRecipeForHousehold(baseRecipe, householdSize)
      
      // Apply dietary preferences
      const dietaryFiltered = this.applyDietaryPreferences(scaledRecipe, preferences)
      if (!dietaryFiltered) return null

      // Calculate confidence score
      const confidence = this.calculateConfidenceScore(dietaryFiltered, preferences, userId)

      // Generate reasoning
      const reasoning = this.generateReasoning(dietaryFiltered, preferences, householdSize)

      // Generate gentle health hints
      const gentleHealthHints = this.generateGentleHealthHints(dietaryFiltered)

      return {
        ...dietaryFiltered,
        householdScaled: true,
        personalizedFor: preferences?.household?.size ? `${preferences.household.size} people` : '1 person',
        confidence,
        reasoning,
        gentleHealthHints
      }
    } catch (error) {
      console.error('Error personalizing recipe:', error)
      return null
    }
  }

  // Scale recipe ingredients and nutrition for household size
  private scaleRecipeForHousehold(recipe: any, householdSize: number): any {
    const originalServes = recipe.serves || 1
    const scaleFactor = householdSize / originalServes

    return {
      ...recipe,
      serves: householdSize,
      originalServes,
      ingredients: recipe.ingredients?.map((ingredient: any) => ({
        ...ingredient,
        amount: Math.round(ingredient.amount * scaleFactor * 10) / 10,
        originalAmount: ingredient.amount,
        scaled: true,
        unit: ingredient.unit,
        category: ingredient.category || 'Other',
        substitutions: ingredient.substitutions || [],
        notes: ingredient.notes || ''
      })) || [],
      nutrition: recipe.nutrition ? {
        calories: Math.round(recipe.nutrition.calories * scaleFactor),
        protein: Math.round(recipe.nutrition.protein * scaleFactor * 10) / 10,
        carbs: Math.round(recipe.nutrition.carbs * scaleFactor * 10) / 10,
        fat: Math.round(recipe.nutrition.fat * scaleFactor * 10) / 10
      } : null,
      cookTime: Math.round(recipe.cookTime * (1 + (scaleFactor - 1) * 0.1)), // Slightly longer for larger portions
    }
  }

  // Apply dietary preferences and restrictions
  private applyDietaryPreferences(recipe: any, preferences: any): any | null {
    if (!preferences?.dietary) return recipe

    const dietaryPrefs = preferences.dietary.preferences || []
    const allergies = preferences.dietary.allergies || ''

    // Check for dietary restrictions
    if (dietaryPrefs.includes('Vegetarian')) {
      if (this.containsMeat(recipe)) {
        return null // Filter out meat recipes
      }
    }

    if (dietaryPrefs.includes('Vegan')) {
      if (this.containsAnimalProducts(recipe)) {
        return null // Filter out animal product recipes
      }
    }

    if (dietaryPrefs.includes('Gluten-Free')) {
      if (this.containsGluten(recipe)) {
        // Try to substitute gluten ingredients
        recipe = this.substituteGlutenIngredients(recipe)
      }
    }

    // Check for allergies
    if (allergies && this.containsAllergen(recipe, allergies)) {
      return null
    }

    return recipe
  }

  // Calculate confidence score for recipe relevance
  private calculateConfidenceScore(recipe: any, preferences: any, userId: string): number {
    let confidence = 0.5 // Base confidence

    // Boost confidence based on dietary preferences match
    if (preferences?.dietary?.preferences) {
      const dietaryMatch = this.calculateDietaryMatch(recipe, preferences.dietary.preferences)
      confidence += dietaryMatch * 0.3
    }

    // Boost confidence based on cuisine preferences
    if (preferences?.dietary?.cuisines) {
      const cuisineMatch = preferences.dietary.cuisines.includes(recipe.cuisineType)
      if (cuisineMatch) confidence += 0.2
    }

    // Boost confidence based on cooking time preferences
    if (preferences?.shopping?.frequency === 'daily' && recipe.cookTime <= 15) {
      confidence += 0.1 // Quick recipes for frequent shoppers
    }

    return Math.min(confidence, 1.0) // Cap at 1.0
  }

  // Generate reasoning for why this recipe was recommended
  private generateReasoning(recipe: any, preferences: any, householdSize: number): string {
    const reasons: string[] = []

    // Household size reasoning
    if (householdSize > 1) {
      reasons.push(`Scaled for ${householdSize} people`)
    }

    // Dietary preferences reasoning
    if (preferences?.dietary?.preferences) {
      const dietaryMatches = this.getDietaryMatches(recipe, preferences.dietary.preferences)
      if (dietaryMatches.length > 0) {
        reasons.push(`Matches your ${dietaryMatches.join(', ')} preferences`)
      }
    }

    // Cuisine reasoning
    if (preferences?.dietary?.cuisines?.includes(recipe.cuisineType)) {
      reasons.push(`From your preferred ${recipe.cuisineType} cuisine`)
    }

    // Time reasoning
    if (recipe.cookTime <= 15) {
      reasons.push('Quick to prepare')
    } else if (recipe.cookTime <= 30) {
      reasons.push('Moderate cooking time')
    }

    return reasons.length > 0 ? reasons.join(' • ') : 'Recommended based on your preferences'
  }

  // Helper methods for dietary filtering
  private containsMeat(recipe: any): boolean {
    const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'meat']
    return this.containsKeywords(recipe, meatKeywords)
  }

  private containsAnimalProducts(recipe: any): boolean {
    const animalKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'meat', 'dairy', 'milk', 'cheese', 'butter', 'eggs']
    return this.containsKeywords(recipe, animalKeywords)
  }

  private containsGluten(recipe: any): boolean {
    const glutenKeywords = ['flour', 'bread', 'pasta', 'wheat', 'barley', 'rye', 'oats']
    return this.containsKeywords(recipe, glutenKeywords)
  }

  private containsAllergen(recipe: any, allergies: string): boolean {
    if (!allergies || typeof allergies !== 'string') return false
    const allergenKeywords = allergies.toLowerCase().split(',').map(a => a.trim())
    return this.containsKeywords(recipe, allergenKeywords)
  }

  private containsKeywords(recipe: any, keywords: string[]): boolean {
    const text = `${recipe.title} ${recipe.description} ${recipe.ingredients?.map((i: any) => i.name).join(' ')}`.toLowerCase()
    return keywords.some(keyword => text.includes(keyword))
  }

  private calculateDietaryMatch(recipe: any, dietaryPrefs: string[]): number {
    let matches = 0
    const total = dietaryPrefs.length

    dietaryPrefs.forEach(pref => {
      if (pref === 'Vegetarian' && !this.containsMeat(recipe)) matches++
      if (pref === 'Vegan' && !this.containsAnimalProducts(recipe)) matches++
      if (pref === 'Gluten-Free' && !this.containsGluten(recipe)) matches++
      if (pref === 'Keto' && recipe.nutrition?.carbs < 20) matches++
    })

    return total > 0 ? matches / total : 0
  }

  private getDietaryMatches(recipe: any, dietaryPrefs: string[]): string[] {
    const matches: string[] = []
    
    dietaryPrefs.forEach(pref => {
      if (pref === 'Vegetarian' && !this.containsMeat(recipe)) matches.push('vegetarian')
      if (pref === 'Vegan' && !this.containsAnimalProducts(recipe)) matches.push('vegan')
      if (pref === 'Gluten-Free' && !this.containsGluten(recipe)) matches.push('gluten-free')
      if (pref === 'Keto' && recipe.nutrition?.carbs < 20) matches.push('keto')
    })

    return matches
  }

  private substituteGlutenIngredients(recipe: any): any {
    // Simple gluten substitution logic
    const substitutions: { [key: string]: string } = {
      'flour': 'gluten-free flour',
      'bread': 'gluten-free bread',
      'pasta': 'gluten-free pasta'
    }

    recipe.ingredients = recipe.ingredients?.map((ingredient: any) => {
      const substitute = substitutions[ingredient.name.toLowerCase()]
      if (substitute) {
        return {
          ...ingredient,
          name: substitute,
          substitutions: [ingredient.name]
        }
      }
      return ingredient
    })

    return recipe
  }

  // Get base recipes (this would integrate with your recipe database)
  private async getBaseRecipes(context: any): Promise<any[]> {
    // Mock data - replace with actual database query
    return [
      {
        id: '1',
        title: 'Avocado Toast',
        description: 'Simple and nutritious breakfast',
        image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400&h=300&fit=crop&q=80',
        serves: 1,
        cookTime: 5,
        difficulty: 'Easy',
        ingredients: [
          { name: 'bread', amount: 2, unit: 'slices', category: 'Grains' },
          { name: 'avocado', amount: 1, unit: 'medium', category: 'Produce' },
          { name: 'salt', amount: 1, unit: 'pinch', category: 'Condiments' }
        ],
        nutrition: { calories: 320, protein: 12, carbs: 35, fat: 18 },
        dietaryTags: ['Vegetarian', 'Vegan'],
        cuisineType: 'American'
      },
      {
        id: '2',
        title: 'Chicken Stir-Fry',
        description: 'Quick and healthy dinner',
        image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop&q=80',
        serves: 2,
        cookTime: 15,
        difficulty: 'Medium',
        ingredients: [
          { name: 'chicken breast', amount: 1, unit: 'lb', category: 'Meat' },
          { name: 'bell peppers', amount: 2, unit: 'medium', category: 'Produce' },
          { name: 'soy sauce', amount: 2, unit: 'tbsp', category: 'Condiments' }
        ],
        nutrition: { calories: 420, protein: 28, carbs: 25, fat: 22 },
        dietaryTags: ['Gluten-Free'],
        cuisineType: 'Asian'
      }
    ]
  }

  // Generate gentle health hints (no pressure, no tracking)
  private generateGentleHealthHints(recipe: any): any {
    const nutrition = recipe.nutrition
    if (!nutrition) {
      return {
        proteinLevel: 'moderate' as const,
        carbLevel: 'moderate' as const,
        fiberLevel: 'moderate' as const,
        healthTags: [],
        gentleSuggestion: undefined
      }
    }

    // Determine protein level
    let proteinLevel: 'high' | 'moderate' | 'low' = 'moderate'
    if (nutrition.protein > 25) proteinLevel = 'high'
    else if (nutrition.protein < 10) proteinLevel = 'low'

    // Determine carb level
    let carbLevel: 'high' | 'moderate' | 'low' = 'moderate'
    if (nutrition.carbs > 50) carbLevel = 'high'
    else if (nutrition.carbs < 20) carbLevel = 'low'

    // Determine fiber level
    let fiberLevel: 'high' | 'moderate' | 'low' = 'moderate'
    const fiber = nutrition.fiber || 0
    if (fiber > 8) fiberLevel = 'high'
    else if (fiber < 3) fiberLevel = 'low'

    // Generate health tags
    const healthTags: string[] = []
    if (proteinLevel === 'high') healthTags.push('High Protein')
    if (carbLevel === 'low') healthTags.push('Low Carb')
    if (fiberLevel === 'high') healthTags.push('High Fiber')
    if (nutrition.calories < 400) healthTags.push('Light')
    if (nutrition.calories > 600) healthTags.push('Hearty')

    // Generate gentle suggestion (only if there's something notable)
    let gentleSuggestion: string | undefined
    if (proteinLevel === 'high' && healthTags.length === 1) {
      gentleSuggestion = 'Great source of protein'
    } else if (fiberLevel === 'high' && healthTags.length === 1) {
      gentleSuggestion = 'Rich in fiber'
    } else if (nutrition.calories < 300) {
      gentleSuggestion = 'Light and nutritious'
    }

    return {
      proteinLevel,
      carbLevel,
      fiberLevel,
      healthTags,
      gentleSuggestion
    }
  }

  // Track recipe interactions for learning
  async trackRecipeInteraction(userId: string, recipeId: string, action: 'viewed' | 'cooked' | 'saved'): Promise<void> {
    await aiLearningService.trackInteraction(userId, {
      type: action === 'cooked' ? 'recipe_cooked' : 'recipe_viewed',
      data: { recipeId, action }
    })
  }
}

export const intelligentRecipeService = IntelligentRecipeService.getInstance()
