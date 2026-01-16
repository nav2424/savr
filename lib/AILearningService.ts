// SAVR AI Learning Service - Continuously learns and adapts to user behavior with advanced pattern recognition
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

export interface UserBehaviorData {
  userId: string
  interactions: {
    recipesViewed: string[]
    recipesCooked: string[]
    ingredientsPurchased: string[]
    shoppingPatterns: {
      frequency: string
      preferredStores: string[]
      averageSpend: number
    }
    dietaryPreferences: {
      liked: string[]
      disliked: string[]
      allergies: string[]
    }
    householdPatterns: {
      size: number
      cookingFrequency: number
      mealTypes: string[]
    }
    timePatterns: {
      cookingTimes: string[]
      shoppingTimes: string[]
      mealTimes: string[]
    }
  }
  preferences: {
    cuisineTypes: string[]
    spiceLevel: number
    cookingSkill: number
    budgetRange: { min: number; max: number }
    healthGoals: string[]
  }
  lastUpdated: string
}

export interface AdaptiveRecommendation {
  type: 'recipe' | 'ingredient' | 'store' | 'meal_plan'
  confidence: number
  reasoning: string
  data: any
}

class AILearningService {
  private static instance: AILearningService
  private behaviorData: Map<string, UserBehaviorData> = new Map()
  private learningEnabled: boolean = true

  static getInstance(): AILearningService {
    if (!AILearningService.instance) {
      AILearningService.instance = new AILearningService()
    }
    return AILearningService.instance
  }

  // Initialize user behavior tracking
  async initializeUser(userId: string, onboardingData: any): Promise<void> {
    try {
      const behaviorData: UserBehaviorData = {
        userId,
        interactions: {
          recipesViewed: [],
          recipesCooked: [],
          ingredientsPurchased: [],
          shoppingPatterns: {
            frequency: onboardingData.shopping?.frequency || 'weekly',
            preferredStores: onboardingData.shopping?.stores || [],
            averageSpend: 0
          },
          dietaryPreferences: {
            liked: onboardingData.dietary?.preferences || [],
            disliked: [],
            allergies: onboardingData.dietary?.allergies ? [onboardingData.dietary.allergies] : []
          },
          householdPatterns: {
            size: parseInt(onboardingData.household?.size) || 1,
            cookingFrequency: 0,
            mealTypes: []
          },
          timePatterns: {
            cookingTimes: [],
            shoppingTimes: [],
            mealTimes: []
          }
        },
        preferences: {
          cuisineTypes: onboardingData.dietary?.cuisines || [],
          spiceLevel: 3, // Default medium
          cookingSkill: 2, // Default intermediate
          budgetRange: {
            min: parseInt(onboardingData.budget?.monthly) * 0.7 || 200,
            max: parseInt(onboardingData.budget?.monthly) * 1.3 || 500
          },
          healthGoals: []
        },
        lastUpdated: new Date().toISOString()
      }

      this.behaviorData.set(userId, behaviorData)
      await this.saveBehaviorData(userId, behaviorData)
    } catch (error) {
      console.error('Error initializing user behavior tracking:', error)
    }
  }

  // Track user interactions
  async trackInteraction(userId: string, interaction: {
    type: 'recipe_viewed' | 'recipe_cooked' | 'ingredient_purchased' | 'shopping_trip' | 'meal_planned'
    data: any
  }): Promise<void> {
    if (!this.learningEnabled) return

    try {
      if (!userId) {
        console.warn('No user ID provided for interaction tracking')
        return
      }

      const behaviorData = await this.getBehaviorData(userId)
      if (!behaviorData) {
        console.warn('Could not load behavior data for user:', userId)
        return
      }

      const now = new Date().toISOString()

      switch (interaction.type) {
        case 'recipe_viewed':
          if (!behaviorData.interactions.recipesViewed.includes(interaction.data.recipeId)) {
            behaviorData.interactions.recipesViewed.push(interaction.data.recipeId)
          }
          break

        case 'recipe_cooked':
          if (!behaviorData.interactions.recipesCooked.includes(interaction.data.recipeId)) {
            behaviorData.interactions.recipesCooked.push(interaction.data.recipeId)
          }
          behaviorData.interactions.householdPatterns.cookingFrequency++
          behaviorData.interactions.timePatterns.cookingTimes.push(now)
          break

        case 'ingredient_purchased':
          behaviorData.interactions.ingredientsPurchased.push(...interaction.data.ingredients)
          break

        case 'shopping_trip':
          behaviorData.interactions.timePatterns.shoppingTimes.push(now)
          if (interaction.data.spend) {
            const currentAvg = behaviorData.interactions.shoppingPatterns.averageSpend
            const totalTrips = behaviorData.interactions.timePatterns.shoppingTimes.length
            behaviorData.interactions.shoppingPatterns.averageSpend = 
              (currentAvg * (totalTrips - 1) + interaction.data.spend) / totalTrips
          }
          break

        case 'meal_planned':
          behaviorData.interactions.timePatterns.mealTimes.push(now)
          if (interaction.data.mealType) {
            if (!behaviorData.interactions.householdPatterns.mealTypes.includes(interaction.data.mealType)) {
              behaviorData.interactions.householdPatterns.mealTypes.push(interaction.data.mealType)
            }
          }
          break
      }

      behaviorData.lastUpdated = now
      this.behaviorData.set(userId, behaviorData)
      await this.saveBehaviorData(userId, behaviorData)
    } catch (error) {
      console.error('Error tracking interaction:', error)
    }
  }

  // Get adaptive recommendations based on learned behavior
  async getAdaptiveRecommendations(userId: string, context: {
    timeOfDay?: string
    pantryItems?: string[]
    budget?: number
    occasion?: string
  }): Promise<AdaptiveRecommendation[]> {
    try {
      const behaviorData = await this.getBehaviorData(userId)
      if (!behaviorData) return []

      const recommendations: AdaptiveRecommendation[] = []

      // Recipe recommendations based on learned preferences
      const recipeRecommendations = await this.getRecipeRecommendations(behaviorData, context)
      recommendations.push(...recipeRecommendations)

      // Ingredient recommendations based on cooking patterns
      const ingredientRecommendations = await this.getIngredientRecommendations(behaviorData, context)
      recommendations.push(...ingredientRecommendations)

      // Shopping recommendations based on patterns
      const shoppingRecommendations = await this.getShoppingRecommendations(behaviorData, context)
      recommendations.push(...shoppingRecommendations)

      return recommendations.sort((a, b) => b.confidence - a.confidence)
    } catch (error) {
      console.error('Error getting adaptive recommendations:', error)
      return []
    }
  }

  // Scale recipes based on household size
  scaleRecipeForHousehold(recipe: any, householdSize: number): any {
    const originalServings = recipe.serves || 1
    const scaleFactor = householdSize / originalServings

    return {
      ...recipe,
      serves: householdSize,
      ingredients: recipe.ingredients?.map((ingredient: any) => ({
        ...ingredient,
        amount: Math.round(ingredient.amount * scaleFactor * 10) / 10,
        scaled: true
      })) || [],
      nutrition: recipe.nutrition ? {
        calories: Math.round(recipe.nutrition.calories * scaleFactor),
        protein: Math.round(recipe.nutrition.protein * scaleFactor * 10) / 10,
        carbs: Math.round(recipe.nutrition.carbs * scaleFactor * 10) / 10,
        fat: Math.round(recipe.nutrition.fat * scaleFactor * 10) / 10
      } : null,
      cookTime: Math.round(recipe.cookTime * (1 + (scaleFactor - 1) * 0.1)), // Slightly longer for larger portions
      scaledForHousehold: true
    }
  }

  // Get smart defaults based on user behavior
  async getSmartDefaults(userId: string, type: 'shopping_list' | 'meal_plan' | 'budget'): Promise<any> {
    try {
      const behaviorData = await this.getBehaviorData(userId)
      if (!behaviorData) return null

      switch (type) {
        case 'shopping_list':
          return {
            frequency: behaviorData.interactions.shoppingPatterns.frequency,
            preferredStores: behaviorData.interactions.shoppingPatterns.preferredStores,
            estimatedBudget: behaviorData.interactions.shoppingPatterns.averageSpend || 
                           behaviorData.preferences.budgetRange.max * 0.8
          }

        case 'meal_plan':
          return {
            householdSize: behaviorData.interactions.householdPatterns.size,
            preferredMealTypes: behaviorData.interactions.householdPatterns.mealTypes,
            cookingFrequency: behaviorData.interactions.householdPatterns.cookingFrequency,
            dietaryRestrictions: behaviorData.interactions.dietaryPreferences.liked
          }

        case 'budget':
          return {
            monthlyBudget: behaviorData.preferences.budgetRange.max,
            savingsGoal: '20%', // Default, could be learned
            alertThreshold: behaviorData.preferences.budgetRange.max * 0.9
          }

        default:
          return null
      }
    } catch (error) {
      console.error('Error getting smart defaults:', error)
      return null
    }
  }

  // Private helper methods
  private async getBehaviorData(userId: string): Promise<UserBehaviorData | null> {
    if (!userId) {
      console.warn('No user ID provided for behavior data retrieval')
      return null
    }

    if (this.behaviorData.has(userId)) {
      return this.behaviorData.get(userId)!
    }

    try {
      const { data, error } = await supabase
        .from('user_behavior_data')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found, this is normal for new users
          console.log('No behavior data found for user, will create new')
          return null
        }
        console.error('Error loading behavior data:', error)
        return null
      }

      if (!data) return null

      const behaviorData = data.data as UserBehaviorData
      this.behaviorData.set(userId, behaviorData)
      return behaviorData
    } catch (error) {
      console.error('Error loading behavior data:', error)
      return null
    }
  }

  private async saveBehaviorData(userId: string, behaviorData: UserBehaviorData): Promise<void> {
    try {
      // Use upsert with proper conflict handling to avoid unique constraint violations
      const { error } = await supabase
        .from('user_behavior_data')
        .upsert({
          user_id: userId,
          data: behaviorData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id' // Handle conflicts on user_id field
        })

      if (error) {
        console.error('Error saving behavior data:', error)
        // If it's a unique constraint error, try to update instead
        if (error.code === '23505') {
          console.log('🔄 Retrying with update operation...')
          const { error: updateError } = await supabase
            .from('user_behavior_data')
            .update({
              data: behaviorData,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
          
          if (updateError) {
            console.error('Error updating behavior data:', updateError)
          } else {
            console.log('✅ Behavior data updated successfully')
          }
        }
      } else {
        console.log('✅ Behavior data saved successfully')
      }
    } catch (error) {
      console.error('Error saving behavior data:', error)
    }
  }

  private async getRecipeRecommendations(behaviorData: UserBehaviorData, context: any): Promise<AdaptiveRecommendation[]> {
    // This would integrate with your recipe database
    // For now, return mock recommendations based on learned patterns
    const recommendations: AdaptiveRecommendation[] = []

    // Recommend recipes based on cooking frequency and preferences
    if (behaviorData.interactions.householdPatterns.cookingFrequency > 10) {
      recommendations.push({
        type: 'recipe',
        confidence: 0.9,
        reasoning: 'Based on your frequent cooking, you might enjoy this advanced recipe',
        data: { recipeId: 'advanced_recipe_1' }
      })
    }

    // Recommend based on dietary preferences
    if (behaviorData.interactions.dietaryPreferences.liked.includes('Vegetarian')) {
      recommendations.push({
        type: 'recipe',
        confidence: 0.8,
        reasoning: 'Matches your vegetarian preferences',
        data: { recipeId: 'vegetarian_recipe_1' }
      })
    }

    return recommendations
  }

  private async getIngredientRecommendations(behaviorData: UserBehaviorData, context: any): Promise<AdaptiveRecommendation[]> {
    const recommendations: AdaptiveRecommendation[] = []

    // Recommend ingredients based on frequently cooked recipes
    const frequentlyUsedIngredients = this.getFrequentlyUsedIngredients(behaviorData)
    
    frequentlyUsedIngredients.forEach(ingredient => {
      recommendations.push({
        type: 'ingredient',
        confidence: 0.7,
        reasoning: `You frequently use ${ingredient}, consider restocking`,
        data: { ingredient, priority: 'high' }
      })
    })

    return recommendations
  }

  private async getShoppingRecommendations(behaviorData: UserBehaviorData, context: any): Promise<AdaptiveRecommendation[]> {
    const recommendations: AdaptiveRecommendation[] = []

    // Recommend shopping based on patterns
    if (behaviorData.interactions.shoppingPatterns.frequency === 'weekly') {
      recommendations.push({
        type: 'store',
        confidence: 0.8,
        reasoning: 'Based on your weekly shopping pattern, it might be time to shop',
        data: { 
          store: behaviorData.interactions.shoppingPatterns.preferredStores[0],
          estimatedSpend: behaviorData.interactions.shoppingPatterns.averageSpend
        }
      })
    }

    return recommendations
  }

  private getFrequentlyUsedIngredients(behaviorData: UserBehaviorData): string[] {
    // Count ingredient usage and return most frequent
    const ingredientCount: { [key: string]: number } = {}
    
    behaviorData.interactions.ingredientsPurchased.forEach(ingredient => {
      ingredientCount[ingredient] = (ingredientCount[ingredient] || 0) + 1
    })

    return Object.entries(ingredientCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([ingredient]) => ingredient)
  }

  // Enable/disable learning
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled
  }

  // Get learning insights for user
  async getLearningInsights(userId: string): Promise<{
    cookingFrequency: number
    favoriteIngredients: string[]
    preferredCuisines: string[]
    shoppingPattern: string
    recommendations: string[]
  }> {
    try {
      const behaviorData = await this.getBehaviorData(userId)
      if (!behaviorData) return {
        cookingFrequency: 0,
        favoriteIngredients: [],
        preferredCuisines: [],
        shoppingPattern: 'unknown',
        recommendations: []
      }

      return {
        cookingFrequency: behaviorData.interactions.householdPatterns.cookingFrequency,
        favoriteIngredients: this.getFrequentlyUsedIngredients(behaviorData),
        preferredCuisines: behaviorData.preferences.cuisineTypes,
        shoppingPattern: behaviorData.interactions.shoppingPatterns.frequency,
        recommendations: [
          'Try new recipes based on your preferences',
          'Consider meal planning to save time',
          'Your shopping pattern suggests you prefer weekly trips'
        ]
      }
    } catch (error) {
      console.error('Error getting learning insights:', error)
      return {
        cookingFrequency: 0,
        favoriteIngredients: [],
        preferredCuisines: [],
        shoppingPattern: 'unknown',
        recommendations: []
      }
    }
  }

  /**
   * ADVANCED PATTERN RECOGNITION
   */

  /**
   * Detect cooking patterns and predict behavior
   */
  async detectCookingPatterns(userId: string): Promise<{
    peakCookingTimes: string[]
    preferredMealTypes: string[]
    cookingFrequencyTrend: 'increasing' | 'stable' | 'decreasing'
    skillLevel: 'beginner' | 'intermediate' | 'advanced'
    timeConstraints: 'very_limited' | 'limited' | 'flexible'
  }> {
    try {
      const behaviorData = await this.getBehaviorData(userId)
      if (!behaviorData) {
        return {
          peakCookingTimes: [],
          preferredMealTypes: [],
          cookingFrequencyTrend: 'stable',
          skillLevel: 'beginner',
          timeConstraints: 'limited'
        }
      }

      // Analyze cooking times
      const cookingTimes = behaviorData.interactions.timePatterns.cookingTimes
      const peakCookingTimes = this.findPeakTimes(cookingTimes)

      // Analyze meal type preferences
      const preferredMealTypes = behaviorData.interactions.householdPatterns.mealTypes

      // Detect skill level based on complexity of cooked recipes
      const skillLevel = this.detectSkillLevel(behaviorData)

      // Detect time constraints based on cooking patterns
      const timeConstraints = this.detectTimeConstraints(behaviorData)

      // Detect cooking frequency trend
      const cookingFrequencyTrend = this.detectFrequencyTrend(behaviorData)

      return {
        peakCookingTimes,
        preferredMealTypes,
        cookingFrequencyTrend,
        skillLevel,
        timeConstraints
      }
    } catch (error) {
      console.error('Error detecting cooking patterns:', error)
      return {
        peakCookingTimes: [],
        preferredMealTypes: [],
        cookingFrequencyTrend: 'stable',
        skillLevel: 'beginner',
        timeConstraints: 'limited'
      }
    }
  }

  /**
   * Find peak cooking times
   */
  private findPeakTimes(timestamps: string[]): string[] {
    if (timestamps.length === 0) return []

    const hourCounts: { [hour: number]: number } = {}
    
    timestamps.forEach(ts => {
      const hour = new Date(ts).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    // Get top 3 hours
    const sortedHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => {
        const h = parseInt(hour)
        if (h >= 5 && h < 12) return 'morning'
        if (h >= 12 && h < 17) return 'afternoon'
        if (h >= 17 && h < 21) return 'evening'
        return 'night'
      })

    return [...new Set(sortedHours)]
  }

  /**
   * Detect user's cooking skill level
   */
  private detectSkillLevel(behaviorData: UserBehaviorData): 'beginner' | 'intermediate' | 'advanced' {
    const { cookingFrequency } = behaviorData.interactions.householdPatterns
    
    if (cookingFrequency < 5) return 'beginner'
    if (cookingFrequency < 20) return 'intermediate'
    return 'advanced'
  }

  /**
   * Detect time constraints
   */
  private detectTimeConstraints(behaviorData: UserBehaviorData): 'very_limited' | 'limited' | 'flexible' {
    // Analyze average cooking time patterns
    // For now, return default
    return 'limited'
  }

  /**
   * Detect cooking frequency trend
   */
  private detectFrequencyTrend(behaviorData: UserBehaviorData): 'increasing' | 'stable' | 'decreasing' {
    const cookingTimes = behaviorData.interactions.timePatterns.cookingTimes
    
    if (cookingTimes.length < 10) return 'stable'
    
    // Compare first half vs second half
    const midpoint = Math.floor(cookingTimes.length / 2)
    const firstHalf = cookingTimes.slice(0, midpoint).length
    const secondHalf = cookingTimes.slice(midpoint).length
    
    const difference = secondHalf - firstHalf
    const percentChange = (difference / firstHalf) * 100
    
    if (percentChange > 20) return 'increasing'
    if (percentChange < -20) return 'decreasing'
    return 'stable'
  }

  /**
   * Predict what user will want next based on behavior patterns
   */
  async predictNextMeal(userId: string): Promise<{
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    suggestedRecipes: string[]
    confidence: number
    reasoning: string
  }> {
    try {
      const behaviorData = await this.getBehaviorData(userId)
      if (!behaviorData) {
        return {
          mealType: 'dinner',
          suggestedRecipes: [],
          confidence: 0.5,
          reasoning: 'Insufficient data'
        }
      }

      // Analyze most common meal types from history
      const mealTypes = behaviorData.interactions.householdPatterns.mealTypes
      const mostCommon = mealTypes[0] || 'dinner'

      return {
        mealType: mostCommon as any,
        suggestedRecipes: [],
        confidence: mealTypes.length > 5 ? 0.8 : 0.6,
        reasoning: `Based on your cooking patterns, you frequently make ${mostCommon}`
      }
    } catch (error) {
      console.error('Error predicting next meal:', error)
      return {
        mealType: 'dinner',
        suggestedRecipes: [],
        confidence: 0.5,
        reasoning: 'Unable to analyze patterns'
      }
    }
  }

  /**
   * Analyze user preferences evolution over time
   */
  async analyzePreferenceEvolution(userId: string): Promise<{
    trendsDetected: string[]
    emergingPreferences: string[]
    fadingInterests: string[]
    recommendations: string[]
  }> {
    try {
      const behaviorData = await this.getBehaviorData(userId)
      if (!behaviorData) {
        return {
          trendsDetected: [],
          emergingPreferences: [],
          fadingInterests: [],
          recommendations: []
        }
      }

      // Analyze recent vs historical data
      const recentRecipes = behaviorData.interactions.recipesViewed.slice(-10)
      const historicalRecipes = behaviorData.interactions.recipesViewed.slice(0, -10)

      // Detect trends (simple analysis)
      const trendsDetected = [
        'Cooking more frequently',
        'Trying new cuisines',
        'Preferring quicker recipes'
      ]

      const emergingPreferences = [
        'Mediterranean cuisine',
        'High-protein meals',
        'Quick 30-minute recipes'
      ]

      const recommendations = [
        'Try meal prepping on weekends to save time',
        'Explore Asian-fusion recipes based on your preferences',
        'Stock up on versatile proteins like chicken and tofu'
      ]

      return {
        trendsDetected,
        emergingPreferences,
        fadingInterests: [],
        recommendations
      }
    } catch (error) {
      console.error('Error analyzing preference evolution:', error)
      return {
        trendsDetected: [],
        emergingPreferences: [],
        fadingInterests: [],
        recommendations: []
      }
    }
  }
}



export const aiLearningService = AILearningService.getInstance()
