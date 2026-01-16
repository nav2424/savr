/**
 * Recipe Match Feed
 * Personalized scroll feed showing recipes with match scores and context
 */

import { Recipe } from './supabase'
import { PantryItem } from './supabase'
import { matchScoringService, MatchScore } from './MatchScoringService'
import { substitutionEngine, SubstitutionSuggestion } from './SubstitutionEngine'

export interface FeedRecipe {
  recipe: Recipe
  matchScore: MatchScore
  matchSummary: string
  missingIngredients: string[]
  substitutionSuggestions: SubstitutionSuggestion[]
  feedCard: FeedCard
}

export interface FeedCard {
  title: string
  subtitle: string
  matchPercentage: number
  matchBadge: string
  missingCount: number
  hasSubstitutions: boolean
  actionText: string
}

export interface FeedOptions {
  dietaryProfile?: {
    diet?: 'vegan' | 'vegetarian' | 'pescatarian' | 'omnivore' | 'keto' | 'paleo'
    allergies?: string[]
    restrictions?: string[]
  }
  sortBy?: 'match' | 'time' | 'difficulty'
  maxResults?: number
}

class RecipeMatchFeed {
  private static instance: RecipeMatchFeed

  static getInstance(): RecipeMatchFeed {
    if (!RecipeMatchFeed.instance) {
      RecipeMatchFeed.instance = new RecipeMatchFeed()
    }
    return RecipeMatchFeed.instance
  }

  /**
   * Generate feed items from recipes
   */
  generateFeed(
    recipes: Recipe[],
    pantryItems: PantryItem[],
    options: FeedOptions = {}
  ): FeedRecipe[] {
    const feedItems: FeedRecipe[] = []

    for (const recipe of recipes) {
      // Calculate match score
      const matchScore = matchScoringService.calculateMatchScore(
        recipe.ingredients || [],
        pantryItems,
        options.dietaryProfile?.allergies || [],
        options.dietaryProfile?.diet
      )

      // Skip recipes with allergy conflicts
      if (matchScore.breakdown.allergyConflicts > 0) {
        continue
      }

      // Get missing ingredients
      const missingIngredients = matchScoringService.getMissingIngredients(matchScore)

      // Get substitution suggestions
      const substitutionSuggestions: SubstitutionSuggestion[] = []
      for (const missingIng of missingIngredients) {
        const substitution = substitutionEngine.getSubstitutions(
          missingIng,
          pantryItems,
          options.dietaryProfile
        )
        if (substitution.substitutes.length > 0) {
          substitutionSuggestions.push(substitution)
        }
      }

      // Generate match summary
      const matchSummary = matchScoringService.getMatchSummary(matchScore)

      // Create feed card
      const feedCard = this.createFeedCard(
        recipe,
        matchScore,
        missingIngredients,
        substitutionSuggestions
      )

      feedItems.push({
        recipe,
        matchScore,
        matchSummary,
        missingIngredients,
        substitutionSuggestions,
        feedCard
      })
    }

    // Sort feed items
    const sorted = this.sortFeedItems(feedItems, options.sortBy || 'match')

    // Limit results
    return sorted.slice(0, options.maxResults || 50)
  }

  /**
   * Create feed card for display
   */
  private createFeedCard(
    recipe: Recipe,
    matchScore: MatchScore,
    missingIngredients: string[],
    substitutionSuggestions: SubstitutionSuggestion[]
  ): FeedCard {
    const matchPercentage = matchScore.matchPercentage
    const missingCount = missingIngredients.length
    const hasSubstitutions = substitutionSuggestions.length > 0

    // Generate title
    const title = recipe.title

    // Generate subtitle based on match
    let subtitle = ''
    let actionText = ''

    if (matchPercentage === 100) {
      subtitle = 'All ingredients available - ready to cook!'
      actionText = 'Start Cooking'
    } else if (matchPercentage >= 80) {
      if (missingCount === 1) {
        subtitle = `Add 1 ingredient to make this recipe`
        actionText = `Add ${missingIngredients[0]}`
      } else {
        subtitle = `Add ${missingCount} ingredients to make this recipe`
        actionText = 'View Recipe'
      }
    } else if (matchPercentage >= 60) {
      if (hasSubstitutions) {
        subtitle = `${missingCount} missing, ${substitutionSuggestions.length} can be substituted`
        actionText = 'View Substitutions'
      } else {
        subtitle = `Add ${missingCount} ingredients to make this recipe`
        actionText = 'View Recipe'
      }
    } else {
      subtitle = `Add ${missingCount} ingredients to make this recipe`
      actionText = 'View Recipe'
    }

    // Generate match badge
    let matchBadge = ''
    if (matchPercentage >= 95) {
      matchBadge = `${matchPercentage}% match`
    } else if (matchPercentage >= 80) {
      matchBadge = `${matchPercentage}% match`
    } else if (matchPercentage >= 60) {
      matchBadge = `${matchPercentage}% match`
    } else {
      matchBadge = `${matchPercentage}% match`
    }

    return {
      title,
      subtitle,
      matchPercentage,
      matchBadge,
      missingCount,
      hasSubstitutions,
      actionText
    }
  }

  /**
   * Sort feed items
   */
  private sortFeedItems(
    feedItems: FeedRecipe[],
    sortBy: 'match' | 'time' | 'difficulty'
  ): FeedRecipe[] {
    const sorted = [...feedItems]

    switch (sortBy) {
      case 'match':
        // Sort by match percentage (highest first)
        sorted.sort((a, b) => {
          // Prioritize no missing ingredients
          if (a.missingCount === 0 && b.missingCount > 0) return -1
          if (a.missingCount > 0 && b.missingCount === 0) return 1
          
          // Then by match percentage
          return b.matchScore.matchPercentage - a.matchScore.matchPercentage
        })
        break

      case 'time':
        // Sort by cook time (shortest first)
        sorted.sort((a, b) => {
          const timeA = (a.recipe.prep_time || 0) + (a.recipe.cook_time || 0)
          const timeB = (b.recipe.prep_time || 0) + (b.recipe.cook_time || 0)
          return timeA - timeB
        })
        break

      case 'difficulty':
        // Sort by difficulty (Easy first)
        const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 }
        sorted.sort((a, b) => {
          const diffA = difficultyOrder[a.recipe.difficulty as 'Easy' | 'Medium' | 'Hard'] || 2
          const diffB = difficultyOrder[b.recipe.difficulty as 'Easy' | 'Medium' | 'Hard'] || 2
          return diffA - diffB
        })
        break
    }

    return sorted
  }

  /**
   * Format feed item for display
   */
  formatFeedItem(item: FeedRecipe): string {
    const { feedCard, matchScore, missingIngredients, substitutionSuggestions } = item

    let text = `${feedCard.matchBadge} – ${feedCard.title}\n`
    text += `${feedCard.subtitle}\n`

    if (missingIngredients.length > 0) {
      text += `\nMissing: ${missingIngredients.join(', ')}\n`
    }

    if (substitutionSuggestions.length > 0) {
      text += `\nSubstitutions available:\n`
      for (const sub of substitutionSuggestions.slice(0, 2)) {
        const formatted = substitutionEngine.formatSubstitutionSuggestion(sub)
        if (formatted) {
          text += `• ${formatted}\n`
        }
      }
    }

    return text
  }
}

export const recipeMatchFeed = RecipeMatchFeed.getInstance()

