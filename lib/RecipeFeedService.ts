// Recipe Feed Service - Smart Surfacing System
// Implements the 4 feed types: Daily Matches, Smart Suggestions, Weekly Plan, Surprise Me

import { recipeRemixService } from './RecipeRemixService'
import { supabase } from './supabase'
import { recipeEmbeddingService } from './RecipeEmbeddingService'
import type { Recipe } from './supabase'
import type { RemixedRecipe } from './RecipeRemixService'

interface FeedContext {
  userId: string
  pantryItems: Array<{ name: string; qty?: string; unit?: string; category?: string }>
  allergies: string[]
  dietaryPreferences: string[]
  householdSize: number
  cuisinePreferences?: string[]
  flavorPreferences?: string[]
}

export type FeedType = 'daily_matches' | 'smart_suggestions' | 'weekly_plan' | 'surprise_me'

interface FeedRecipe extends RemixedRecipe {
  feedType: FeedType
  feedReason?: string
  unlockIngredient?: string // For smart suggestions
}

class RecipeFeedService {
  private static instance: RecipeFeedService
  private dailyCache: Map<string, FeedRecipe[]> = new Map() // userId -> recipes
  private weeklyCache: Map<string, FeedRecipe[]> = new Map() // userId -> recipes

  static getInstance(): RecipeFeedService {
    if (!RecipeFeedService.instance) {
      RecipeFeedService.instance = new RecipeFeedService()
    }
    return RecipeFeedService.instance
  }

  /**
   * Get recently cooked recipe IDs to exclude
   */
  private async getRecentlyCookedIds(userId: string, days: number = 7): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('saved_recipes')
        .select('recipe_id')
        .eq('user_id', userId)
        .gte('last_cooked', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())

      return (data || []).map(r => r.recipe_id)
    } catch (error) {
      console.error('Error getting recently cooked:', error)
      return []
    }
  }

  /**
   * Feed Type 1: Daily Matches
   * 5-10 recipes that use maximum pantry overlap
   */
  async getDailyMatches(
    context: FeedContext,
    count: number = 8
  ): Promise<FeedRecipe[]> {
    try {
      const cacheKey = `${context.userId}_${new Date().toDateString()}`
      
      // Check cache (daily matches refresh once per day)
      if (this.dailyCache.has(cacheKey)) {
        console.log('📦 Using cached daily matches')
        return this.dailyCache.get(cacheKey)!
      }

      console.log(`🍽️ Generating ${count} daily matches for user ${context.userId}`)

      const recentlyCooked = await this.getRecentlyCookedIds(context.userId, 7)

      // Use remix service to find recipes with max pantry overlap
      const remixed = await recipeRemixService.remixRecipes(
        {
          ...context,
          recentlyCooked,
        },
        count
      )

      // Sort by pantry match score (highest first)
      remixed.sort((a, b) => {
        const scoreA = a.pantryMatchScore || 0
        const scoreB = b.pantryMatchScore || 0
        return scoreB - scoreA
      })

      const feedRecipes: FeedRecipe[] = remixed.slice(0, count).map(recipe => ({
        ...recipe,
        feedType: 'daily_matches',
        feedReason: `Uses ${Math.round((recipe.pantryMatchScore || 0) * 100)}% of your pantry`,
      }))

      // Cache for the day
      this.dailyCache.set(cacheKey, feedRecipes)

      console.log(`✅ Generated ${feedRecipes.length} daily matches`)
      return feedRecipes
    } catch (error) {
      console.error('❌ Error generating daily matches:', error)
      return []
    }
  }

  /**
   * Feed Type 2: Smart Suggestions
   * "Add 1 ingredient to unlock these recipes"
   */
  async getSmartSuggestions(
    context: FeedContext,
    count: number = 5
  ): Promise<FeedRecipe[]> {
    try {
      console.log(`💡 Generating ${count} smart suggestions for user ${context.userId}`)

      const pantryNames = context.pantryItems.map(item => item.name.toLowerCase())

      // Search for recipes that are close matches but missing 1-2 ingredients
      const searchQuery = context.pantryItems
        .slice(0, 8)
        .map(item => item.name)
        .join(', ')

      const candidates = await recipeEmbeddingService.searchRecipesByQuery(searchQuery, {
        limit: count * 3,
        threshold: 0.65,
        allergies: context.allergies,
        dietary: context.dietaryPreferences,
      })

      const suggestions: FeedRecipe[] = []

      for (const recipe of candidates) {
        if (suggestions.length >= count) break

        // Find missing ingredients
        const missing: string[] = []
        if (recipe.ingredients) {
          for (const ing of recipe.ingredients) {
            const ingName = (ing as any).name?.toLowerCase() || ''
            if (!ingName) continue

            // Check if ingredient is in pantry
            let found = false
            for (const pantryName of pantryNames) {
              // Simple check - could use IngredientMatchingService for better matching
              if (ingName.includes(pantryName) || pantryName.includes(ingName)) {
                found = true
                break
              }
            }

            if (!found && ingName.length > 2) {
              missing.push(ingName)
            }
          }
        }

        // Only include recipes with 1-2 missing ingredients
        if (missing.length >= 1 && missing.length <= 2) {
          const remixed = await recipeRemixService.remixRecipeById(recipe.id, {
            ...context,
            recentlyCooked: [],
          })

          if (remixed) {
            suggestions.push({
              ...remixed,
              feedType: 'smart_suggestions',
              feedReason: `Add ${missing[0]} to unlock this recipe`,
              unlockIngredient: missing[0],
            })
          }
        }
      }

      console.log(`✅ Generated ${suggestions.length} smart suggestions`)
      return suggestions.slice(0, count)
    } catch (error) {
      console.error('❌ Error generating smart suggestions:', error)
      return []
    }
  }

  /**
   * Feed Type 3: Weekly Plan
   * 7 balanced meals per week (one per day)
   */
  async getWeeklyPlan(context: FeedContext): Promise<FeedRecipe[]> {
    try {
      const cacheKey = `${context.userId}_week_${this.getWeekNumber()}`
      
      // Check cache (weekly plan refreshes once per week)
      if (this.weeklyCache.has(cacheKey)) {
        console.log('📦 Using cached weekly plan')
        return this.weeklyCache.get(cacheKey)!
      }

      console.log(`📅 Generating weekly plan for user ${context.userId}`)

      const mealTypes = ['breakfast', 'lunch', 'dinner', 'dinner', 'dinner', 'dinner', 'dinner']
      const weeklyPlan: FeedRecipe[] = []
      const recentlyCooked = await this.getRecentlyCookedIds(context.userId, 14)

      for (let i = 0; i < 7; i++) {
        const mealType = mealTypes[i]

        // Get 3 candidates for this meal type
        const candidates = await recipeEmbeddingService.searchRecipesByQuery(
          `${mealType} ${context.pantryItems.slice(0, 5).map(i => i.name).join(' ')}`,
          {
            limit: 3,
            threshold: 0.6,
            mealType,
            allergies: context.allergies,
            dietary: context.dietaryPreferences,
          }
        )

        // Filter out already selected recipes
        const filtered = candidates.filter(
          c => !weeklyPlan.some(wp => wp.originalRecipeId === c.id)
        )

        if (filtered.length > 0) {
          const remixed = await recipeRemixService.remixRecipeById(filtered[0].id, {
            ...context,
            recentlyCooked: [...recentlyCooked, ...weeklyPlan.map(wp => wp.id || '')],
          })

          if (remixed) {
            weeklyPlan.push({
              ...remixed,
              feedType: 'weekly_plan',
              feedReason: `${mealType} for day ${i + 1}`,
            })
          }
        }
      }

      // Cache for the week
      this.weeklyCache.set(cacheKey, weeklyPlan)

      console.log(`✅ Generated ${weeklyPlan.length} weekly plan recipes`)
      return weeklyPlan
    } catch (error) {
      console.error('❌ Error generating weekly plan:', error)
      return []
    }
  }

  /**
   * Feed Type 4: Surprise Me
   * AI-generated creative fusion recipes
   */
  async getSurpriseMe(
    context: FeedContext,
    count: number = 3
  ): Promise<FeedRecipe[]> {
    try {
      console.log(`🎲 Generating ${count} surprise recipes for user ${context.userId}`)

      // Build creative query with fusion elements
      const cuisines = context.cuisinePreferences || ['Italian', 'Mexican', 'Asian', 'Mediterranean']
      const randomCuisine1 = cuisines[Math.floor(Math.random() * cuisines.length)]
      const randomCuisine2 = cuisines[Math.floor(Math.random() * cuisines.length)]

      const fusionQuery = `${randomCuisine1} ${randomCuisine2} fusion ${context.pantryItems.slice(0, 3).map(i => i.name).join(' ')}`

      // Search for creative matches
      const candidates = await recipeEmbeddingService.searchRecipesByQuery(fusionQuery, {
        limit: count * 2,
        threshold: 0.5, // Lower threshold for creative matches
        allergies: context.allergies,
        dietary: context.dietaryPreferences,
      })

      const surprises: FeedRecipe[] = []

      for (const recipe of candidates.slice(0, count)) {
        const remixed = await recipeRemixService.remixRecipeById(recipe.id, {
          ...context,
          recentlyCooked: [],
        })

        if (remixed) {
          surprises.push({
            ...remixed,
            feedType: 'surprise_me',
            feedReason: `Creative ${randomCuisine1}-${randomCuisine2} fusion recipe`,
          })
        }
      }

      // If not enough, generate from scratch using AI
      if (surprises.length < count) {
        // This would call DynamicRecipeAIService to generate creative recipes
        // For now, we'll return what we have
      }

      console.log(`✅ Generated ${surprises.length} surprise recipes`)
      return surprises
    } catch (error) {
      console.error('❌ Error generating surprise recipes:', error)
      return []
    }
  }

  /**
   * Get all feeds for a user
   */
  async getAllFeeds(context: FeedContext): Promise<{
    dailyMatches: FeedRecipe[]
    smartSuggestions: FeedRecipe[]
    weeklyPlan: FeedRecipe[]
    surpriseMe: FeedRecipe[]
  }> {
    const [dailyMatches, smartSuggestions, weeklyPlan, surpriseMe] = await Promise.all([
      this.getDailyMatches(context, 8),
      this.getSmartSuggestions(context, 5),
      this.getWeeklyPlan(context),
      this.getSurpriseMe(context, 3),
    ])

    return {
      dailyMatches,
      smartSuggestions,
      weeklyPlan,
      surpriseMe,
    }
  }

  /**
   * Get week number for caching
   */
  private getWeekNumber(): number {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    return Math.ceil((days + start.getDay() + 1) / 7)
  }

  /**
   * Clear caches (useful for testing or manual refresh)
   */
  clearCaches(userId: string) {
    const keysToDelete: string[] = []
    for (const key of this.dailyCache.keys()) {
      if (key.startsWith(userId)) keysToDelete.push(key)
    }
    for (const key of this.weeklyCache.keys()) {
      if (key.startsWith(userId)) keysToDelete.push(key)
    }
    keysToDelete.forEach(key => {
      this.dailyCache.delete(key)
      this.weeklyCache.delete(key)
    })
  }
}

export const recipeFeedService = RecipeFeedService.getInstance()
export default recipeFeedService

