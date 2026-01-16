// Recipe Remix Service
// The core of the adaptive curation system - searches base recipes and remixes them
// Based on user context: pantry, allergies, dietary preferences, household size

import { supabase } from './supabase'
import { recipeEmbeddingService } from './RecipeEmbeddingService'
import { config } from '../config'
import type { Recipe } from './supabase'
import { ingredientMatchingService } from './IngredientMatchingService'
import { ingredientSubstitutionEngine } from './IngredientSubstitutionEngine'

interface RemixContext {
  userId: string
  pantryItems: Array<{ name: string; qty?: string; unit?: string; category?: string }>
  allergies: string[]
  dietaryPreferences: string[]
  householdSize: number
  cuisinePreferences?: string[]
  avoidIngredients?: string[]
  flavorPreferences?: string[] // e.g., 'spicy', 'sweet', 'savory'
  recentlyCooked?: string[] // Recipe IDs to avoid
}

interface RemixedRecipe extends Recipe {
  originalRecipeId?: string
  remixReason?: string
  pantryMatchScore?: number
  substitutions?: Array<{
    original: string
    substitute: string
    reason: string
  }>
}

class RecipeRemixService {
  private static instance: RecipeRemixService
  private cache: Map<string, RemixedRecipe[]> = new Map()

  static getInstance(): RecipeRemixService {
    if (!RecipeRemixService.instance) {
      RecipeRemixService.instance = new RecipeRemixService()
    }
    return RecipeRemixService.instance
  }

  /**
   * Build search query from user context for semantic search
   */
  private buildSearchQuery(context: RemixContext): string {
    const parts: string[] = []

    // Add pantry items (most important for matching)
    if (context.pantryItems.length > 0) {
      const pantryNames = context.pantryItems
        .slice(0, 10) // Limit to top 10 to avoid too long queries
        .map(item => item.name)
        .join(', ')
      parts.push(pantryNames)
    }

    // Add cuisine preferences
    if (context.cuisinePreferences && context.cuisinePreferences.length > 0) {
      parts.push(context.cuisinePreferences.join(', '))
    }

    // Add flavor preferences
    if (context.flavorPreferences && context.flavorPreferences.length > 0) {
      parts.push(context.flavorPreferences.join(', '))
    }

    return parts.join(' ')
  }

  /**
   * Search for top matching recipes using semantic search
   */
  private async searchMatchingRecipes(
    context: RemixContext,
    count: number = 10
  ): Promise<Recipe[]> {
    try {
      const searchQuery = this.buildSearchQuery(context)

      if (!searchQuery.trim()) {
        // Fallback: get random recipes if no context
        const { data } = await supabase
          .from('recipes')
          .select('*')
          .eq('is_public', true)
          .limit(count)
        return data || []
      }

      // Use semantic search
      const results = await recipeEmbeddingService.searchRecipesByQuery(searchQuery, {
        limit: count * 2, // Get more to filter down
        threshold: 0.6, // Lower threshold for more results
        allergies: context.allergies,
        dietary: context.dietaryPreferences,
      })

      // Filter out recently cooked recipes
      const filtered = results.filter(
        recipe => !context.recentlyCooked?.includes(recipe.id)
      )

      return filtered.slice(0, count)
    } catch (error) {
      console.error('❌ Error searching matching recipes:', error)
      // Fallback to basic query
      const { data } = await supabase
        .from('recipes')
        .select('*')
        .eq('is_public', true)
        .limit(count)
      return data || []
    }
  }

  /**
   * Calculate pantry match score for a recipe
   */
  private calculatePantryMatch(
    recipe: Recipe,
    pantryItems: Array<{ name: string }>
  ): number {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return 0
    if (pantryItems.length === 0) return 0

    const pantryNames = pantryItems.map(item => item.name.toLowerCase())
    let matchedCount = 0
    let totalIngredients = 0

    for (const ingredient of recipe.ingredients) {
      const ingName = (ingredient as any).name?.toLowerCase() || ''
      if (!ingName) continue

      totalIngredients++

      // Check if ingredient matches pantry
      for (const pantryName of pantryNames) {
        const match = ingredientMatchingService.matchIngredient(ingName, pantryName)
        if (match.isMatch && match.confidence > 0.7) {
          matchedCount++
          break
        }
      }
    }

    return totalIngredients > 0 ? matchedCount / totalIngredients : 0
  }

  /**
   * Find ingredient substitutions based on pantry
   */
  private async findSubstitutions(
    ingredient: any,
    pantryItems: Array<{ name: string }>,
    allergies: string[],
    dietaryPreferences: string[]
  ): Promise<{ substitute: string; reason: string } | null> {
    const ingName = ingredient.name || ''

    // Check if we have a direct match in pantry
    for (const pantryItem of pantryItems) {
      const match = ingredientMatchingService.matchIngredient(ingName, pantryItem.name)
      if (match.isMatch && match.confidence > 0.8) {
        return null // No substitution needed
      }
    }

    // Try to find a substitution
    try {
      const substitutions = await ingredientSubstitutionEngine.findSubstitutions(
        ingName,
        undefined, // userId
        {
          dietary: dietaryPreferences,
          preferHealthy: true,
        }
      )

      if (substitutions && substitutions.length > 0) {
        // Check if any substitution is in pantry
        for (const sub of substitutions.slice(0, 3)) {
          for (const pantryItem of pantryItems) {
            const match = ingredientMatchingService.matchIngredient(
              sub.substitute.toLowerCase(),
              pantryItem.name
            )
            if (match.isMatch && match.confidence > 0.8) {
              return {
                substitute: sub.substitute,
                reason: sub.reason || `Using ${sub.substitute} from your pantry`,
              }
            }
          }
        }

        // Return first substitution even if not in pantry
        return {
          substitute: substitutions[0].substitute,
          reason: substitutions[0].reason || `Substitute for ${ingName}`,
        }
      }
    } catch (error) {
      console.error('Error finding substitutions:', error)
    }

    return null
  }

  /**
   * Remix a single recipe for user context
   */
  private async remixRecipe(
    baseRecipe: Recipe,
    context: RemixContext
  ): Promise<RemixedRecipe | null> {
    try {
      const remixed: RemixedRecipe = {
        ...baseRecipe,
        originalRecipeId: baseRecipe.id,
        remixReason: 'Adapted to your pantry and preferences',
        pantryMatchScore: this.calculatePantryMatch(baseRecipe, context.pantryItems),
      }

      // Scale recipe for household size
      if (baseRecipe.servings && baseRecipe.servings !== context.householdSize) {
        const scaleFactor = context.householdSize / baseRecipe.servings
        remixed.servings = context.householdSize

        // Scale ingredients
        if (remixed.ingredients) {
          remixed.ingredients = remixed.ingredients.map((ing: any) => {
            const quantity = parseFloat(ing.quantity || '1')
            const scaledQty = (quantity * scaleFactor).toFixed(2)
            return {
              ...ing,
              quantity: scaledQty,
            }
          })
        }

        // Scale nutrition (approximate)
        if (remixed.calories) remixed.calories = Math.round(remixed.calories * scaleFactor)
        if (remixed.protein) remixed.protein = Math.round(remixed.protein * scaleFactor)
        if (remixed.carbs) remixed.carbs = Math.round(remixed.carbs * scaleFactor)
        if (remixed.fat) remixed.fat = Math.round(remixed.fat * scaleFactor)
      }

      // Find and apply ingredient substitutions
      const substitutions: Array<{
        original: string
        substitute: string
        reason: string
      }> = []

      if (remixed.ingredients) {
        for (let i = 0; i < remixed.ingredients.length; i++) {
          const ingredient = remixed.ingredients[i] as any
          const ingName = ingredient.name || ''

          // Check if ingredient is in pantry
          let inPantry = false
          for (const pantryItem of context.pantryItems) {
            const match = ingredientMatchingService.matchIngredient(ingName, pantryItem.name)
            if (match.isMatch && match.confidence > 0.8) {
              inPantry = true
              break
            }
          }

          // If not in pantry and not critical, try to substitute
          if (!inPantry && !this.isCriticalIngredient(ingName)) {
            const substitution = await this.findSubstitutions(
              ingredient,
              context.pantryItems,
              context.allergies,
              context.dietaryPreferences
            )

            if (substitution) {
              substitutions.push({
                original: ingName,
                substitute: substitution.substitute,
                reason: substitution.reason,
              })

              // Update ingredient name
              remixed.ingredients[i] = {
                ...ingredient,
                name: substitution.substitute,
                inPantry: true,
              }
            }
          } else if (inPantry) {
            // Mark as in pantry
            remixed.ingredients[i] = {
              ...ingredient,
              inPantry: true,
            }
          }
        }
      }

      if (substitutions.length > 0) {
        remixed.substitutions = substitutions
        remixed.remixReason = `Adapted with ${substitutions.length} substitutions from your pantry`
      }

      // Generate new ID for remixed recipe
      remixed.id = `remix_${baseRecipe.id}_${Date.now()}`

      return remixed
    } catch (error) {
      console.error('❌ Error remixing recipe:', error)
      return null
    }
  }

  /**
   * Check if an ingredient is critical (cannot be substituted)
   */
  private isCriticalIngredient(ingredientName: string): boolean {
    const critical = [
      'chicken',
      'beef',
      'pork',
      'fish',
      'salmon',
      'tofu',
      'pasta',
      'rice',
      'bread',
    ]
    return critical.some(crit => ingredientName.toLowerCase().includes(crit))
  }

  /**
   * Main remix function - search base recipes and remix them
   */
  async remixRecipes(
    context: RemixContext,
    count: number = 5
  ): Promise<RemixedRecipe[]> {
    try {
      console.log(`🎨 Remixing ${count} recipes for user ${context.userId}`)

      // Search for matching base recipes
      const baseRecipes = await this.searchMatchingRecipes(context, count * 2)

      if (baseRecipes.length === 0) {
        console.warn('⚠️ No base recipes found')
        return []
      }

      console.log(`📚 Found ${baseRecipes.length} base recipes to remix`)

      // Remix each recipe
      const remixedRecipes: RemixedRecipe[] = []

      for (const baseRecipe of baseRecipes.slice(0, count * 2)) {
        const remixed = await this.remixRecipe(baseRecipe, context)
        if (remixed) {
          remixedRecipes.push(remixed)
        }
      }

      // Sort by pantry match score (highest first)
      remixedRecipes.sort((a, b) => {
        const scoreA = a.pantryMatchScore || 0
        const scoreB = b.pantryMatchScore || 0
        return scoreB - scoreA
      })

      // Return top N
      const result = remixedRecipes.slice(0, count)
      console.log(`✅ Remixed ${result.length} recipes`)
      return result
    } catch (error) {
      console.error('❌ Error in remixRecipes:', error)
      return []
    }
  }

  /**
   * Remix a specific recipe by ID
   */
  async remixRecipeById(
    recipeId: string,
    context: RemixContext
  ): Promise<RemixedRecipe | null> {
    try {
      const { data: recipe, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single()

      if (error || !recipe) {
        console.error('❌ Recipe not found:', recipeId)
        return null
      }

      return await this.remixRecipe(recipe, context)
    } catch (error) {
      console.error('❌ Error remixing recipe by ID:', error)
      return null
    }
  }
}

export const recipeRemixService = RecipeRemixService.getInstance()
export default recipeRemixService

