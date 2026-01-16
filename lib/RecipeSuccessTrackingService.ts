// SAVR Recipe Success Tracking Service - Learn which recipes users actually enjoy
import { supabase } from './supabase'
import { aiLearningService } from './AILearningService'

export interface RecipeOutcome {
  id?: string
  userId: string
  recipeId: string
  completed: boolean
  enjoymentRating?: number // 1-5 stars
  difficultyFeedback?: 'easier_than_expected' | 'as_expected' | 'harder_than_expected'
  actualCookTime?: number // In minutes
  wouldMakeAgain: boolean
  notes?: string
  cookedAt: Date
}

export interface RecipeSuccessMetrics {
  recipeId: string
  timesCooked: number
  avgEnjoyment: number
  successRate: number // % of completions vs attempts
  avgDifficultyMatch: number // How accurate is the difficulty rating
  avgCookTime: number
  wouldMakeAgainRate: number
  recommended: boolean // Would we recommend this recipe?
}

class RecipeSuccessTrackingService {
  private static instance: RecipeSuccessTrackingService

  static getInstance(): RecipeSuccessTrackingService {
    if (!RecipeSuccessTrackingService.instance) {
      RecipeSuccessTrackingService.instance = new RecipeSuccessTrackingService()
    }
    return RecipeSuccessTrackingService.instance
  }

  /**
   * Track recipe outcome after cooking
   */
  async trackRecipeOutcome(outcome: RecipeOutcome): Promise<void> {
    try {
      // Validate recipe ID is a valid UUID (not a temporary ID like regenerated_*, local_*, etc.)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(outcome.recipeId)) {
        console.log(`⚠️ Skipping tracking for temporary recipe ID: ${outcome.recipeId}`)
        return
      }

      // Validate user ID is a valid UUID
      if (!uuidRegex.test(outcome.userId)) {
        console.log(`⚠️ Skipping tracking for invalid user ID: ${outcome.userId}`)
        return
      }

      // Save to database
      const { error } = await supabase
        .from('recipe_outcomes')
        .insert({
          user_id: outcome.userId,
          recipe_id: outcome.recipeId,
          completed: outcome.completed,
          enjoyment_rating: outcome.enjoymentRating,
          difficulty_feedback: outcome.difficultyFeedback,
          actual_cook_time: outcome.actualCookTime,
          would_make_again: outcome.wouldMakeAgain,
          notes: outcome.notes,
          cooked_at: outcome.cookedAt.toISOString()
        })

      if (error) {
        console.error('Error saving recipe outcome:', error)
        return
      }

      // Update AI learning service
      if (outcome.completed && outcome.wouldMakeAgain) {
        await aiLearningService.trackInteraction(outcome.userId, {
          type: 'recipe_cooked',
          data: { recipeId: outcome.recipeId }
        })
      }

      console.log('✅ Recipe outcome tracked:', outcome.recipeId)
    } catch (error) {
      console.error('Error tracking recipe outcome:', error)
    }
  }

  /**
   * Get success metrics for a recipe
   */
  async getRecipeMetrics(recipeId: string): Promise<RecipeSuccessMetrics | null> {
    try {
      const { data, error } = await supabase
        .from('recipe_outcomes')
        .select('*')
        .eq('recipe_id', recipeId)

      if (error || !data || data.length === 0) {
        return null
      }

      const outcomes = data as any[]
      const timesCooked = outcomes.length
      const completed = outcomes.filter(o => o.completed).length
      const enjoyments = outcomes
        .filter(o => o.enjoyment_rating !== null)
        .map(o => o.enjoyment_rating)
      const wouldMakeAgain = outcomes.filter(o => o.would_make_again).length

      return {
        recipeId,
        timesCooked,
        avgEnjoyment: enjoyments.length > 0 
          ? enjoyments.reduce((sum, r) => sum + r, 0) / enjoyments.length 
          : 0,
        successRate: (completed / timesCooked) * 100,
        avgDifficultyMatch: this.calculateDifficultyMatch(outcomes),
        avgCookTime: this.calculateAvgCookTime(outcomes),
        wouldMakeAgainRate: (wouldMakeAgain / timesCooked) * 100,
        recommended: wouldMakeAgain / timesCooked >= 0.7 // 70%+ would make again
      }
    } catch (error) {
      console.error('Error getting recipe metrics:', error)
      return null
    }
  }

  /**
   * Get user's successful recipes (sorted by enjoyment)
   */
  async getUserSuccessfulRecipes(userId: string, limit: number = 10): Promise<{
    recipeId: string
    avgEnjoyment: number
    timesCooked: number
  }[]> {
    try {
      const { data, error } = await supabase
        .from('recipe_outcomes')
        .select('recipe_id, enjoyment_rating')
        .eq('user_id', userId)
        .eq('completed', true)
        .not('enjoyment_rating', 'is', null)
        .order('enjoyment_rating', { ascending: false })

      if (error || !data) return []

      // Group by recipe and calculate averages
      const recipeMap = new Map<string, { total: number; count: number }>()
      
      data.forEach((outcome: any) => {
        const existing = recipeMap.get(outcome.recipe_id) || { total: 0, count: 0 }
        recipeMap.set(outcome.recipe_id, {
          total: existing.total + outcome.enjoyment_rating,
          count: existing.count + 1
        })
      })

      const results = Array.from(recipeMap.entries())
        .map(([recipeId, stats]) => ({
          recipeId,
          avgEnjoyment: stats.total / stats.count,
          timesCooked: stats.count
        }))
        .sort((a, b) => b.avgEnjoyment - a.avgEnjoyment)
        .slice(0, limit)

      return results
    } catch (error) {
      console.error('Error getting successful recipes:', error)
      return []
    }
  }

  /**
   * Get recipes user should avoid (low ratings)
   */
  async getAvoidedRecipes(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('recipe_outcomes')
        .select('recipe_id, enjoyment_rating, would_make_again')
        .eq('user_id', userId)
        .or('enjoyment_rating.lte.2,would_make_again.eq.false')

      if (error || !data) return []

      // Get unique recipe IDs that user didn't enjoy
      const avoidedIds = [...new Set(data.map(o => o.recipe_id))]
      return avoidedIds
    } catch (error) {
      console.error('Error getting avoided recipes:', error)
      return []
    }
  }

  /**
   * Get personalized recipe ranking for user
   */
  async getRankedRecipesForUser(userId: string, recipes: any[]): Promise<any[]> {
    try {
      // Get user's successful recipes
      const successfulRecipes = await this.getUserSuccessfulRecipes(userId, 50)
      const avoidedRecipes = await this.getAvoidedRecipes(userId)

      // Rank recipes
      return recipes
        .map(recipe => {
          const successData = successfulRecipes.find(s => s.recipeId === recipe.id)
          const isAvoided = avoidedRecipes.includes(recipe.id)

          let score = 50 // Base score

          if (successData) {
            // Boost score based on past enjoyment
            score += (successData.avgEnjoyment / 5) * 30 // Up to +30 points
            score += Math.min(successData.timesCooked * 2, 20) // Up to +20 for frequency
          }

          if (isAvoided) {
            score -= 40 // Penalize recipes user didn't enjoy
          }

          return {
            ...recipe,
            personalizedScore: score,
            timesCooked: successData?.timesCooked || 0,
            avgEnjoyment: successData?.avgEnjoyment || 0
          }
        })
        .sort((a, b) => b.personalizedScore - a.personalizedScore)
    } catch (error) {
      console.error('Error ranking recipes:', error)
      return recipes
    }
  }

  /**
   * Calculate difficulty accuracy score
   */
  private calculateDifficultyMatch(outcomes: any[]): number {
    const feedbacks = outcomes.filter(o => o.difficulty_feedback)
    if (feedbacks.length === 0) return 100

    const asExpected = feedbacks.filter(o => o.difficulty_feedback === 'as_expected').length
    return (asExpected / feedbacks.length) * 100
  }

  /**
   * Calculate average cook time
   */
  private calculateAvgCookTime(outcomes: any[]): number {
    const times = outcomes
      .filter(o => o.actual_cook_time !== null)
      .map(o => o.actual_cook_time)
    
    if (times.length === 0) return 0
    return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length)
  }

  /**
   * Get cooking time adjustment for user
   */
  async getUserCookTimeMultiplier(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('recipe_outcomes')
        .select('actual_cook_time, recipe_id')
        .eq('user_id', userId)
        .not('actual_cook_time', 'is', null)

      if (error || !data || data.length < 3) return 1.0 // Need at least 3 data points

      // Get stated cook times for these recipes
      const recipeIds = data.map(o => o.recipe_id)
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, cook_time')
        .in('id', recipeIds)

      if (!recipes) return 1.0

      // Calculate user's speed multiplier
      const multipliers: number[] = []
      
      data.forEach(outcome => {
        const recipe = recipes.find(r => r.id === outcome.recipe_id)
        if (recipe && recipe.cook_time > 0) {
          const multiplier = outcome.actual_cook_time / recipe.cook_time
          multipliers.push(multiplier)
        }
      })

      if (multipliers.length === 0) return 1.0

      // Average multiplier
      const avgMultiplier = multipliers.reduce((sum, m) => sum + m) / multipliers.length

      return avgMultiplier
    } catch (error) {
      console.error('Error calculating cook time multiplier:', error)
      return 1.0
    }
  }

  /**
   * Get personalized cook time estimate
   */
  async getPersonalizedCookTime(userId: string, recipeId: string, statedTime: number): Promise<{
    estimatedTime: number
    message: string
    confidence: number
  }> {
    const multiplier = await this.getUserCookTimeMultiplier(userId)

    const estimatedTime = Math.round(statedTime * multiplier)
    const difference = Math.abs(estimatedTime - statedTime)

    let message = `About ${estimatedTime} min`
    let confidence = 0.7

    if (difference > statedTime * 0.2) { // More than 20% different
      if (multiplier > 1.2) {
        message = `About ${estimatedTime} min for you (you take your time - that's great!) ⏰`
        confidence = 0.85
      } else if (multiplier < 0.8) {
        message = `About ${estimatedTime} min for you (you're fast!) ⚡`
        confidence = 0.85
      }
    } else {
      message = `About ${statedTime} min`
      confidence = 0.6
    }

    return {
      estimatedTime,
      message,
      confidence
    }
  }
}

export const recipeSuccessTrackingService = RecipeSuccessTrackingService.getInstance()

