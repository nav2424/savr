/**
 * Dynamic Match Scoring 2.0
 * Weighted system for more nuanced recipe ranking
 */

import { PantryItem } from './supabase'
import { ingredientMatchingService } from './IngredientMatchingService'
import { getNormalizedPantry, normName, isStaple } from './PantryNormalizationService'
import { matchIngredient as simpleMatchIngredient } from './SimpleIngredientMatcher'

export interface MatchScore {
  totalPoints: number
  maxPossiblePoints: number
  matchPercentage: number
  breakdown: {
    pantryMatches: number
    substitutableMatches: number
    missingIngredients: number
    allergyConflicts: number
  }
  details: MatchDetail[]
}

export interface MatchDetail {
  ingredientName: string
  matchType: 'pantry' | 'substitutable' | 'missing' | 'allergy'
  points: number
  pantryItem?: PantryItem
  substitution?: Substitution
}

export interface Substitution {
  original: string
  substitute: string
  reason: string
  confidence: number
}

class MatchScoringService {
  private static instance: MatchScoringService

  static getInstance(): MatchScoringService {
    if (!MatchScoringService.instance) {
      MatchScoringService.instance = new MatchScoringService()
    }
    return MatchScoringService.instance
  }

  /**
   * Calculate weighted match score for a recipe
   * Now excludes staples from required ingredients and uses normalized pantry
   */
  calculateMatchScore(
    recipeIngredients: Array<{ name: string; quantity?: string; unit?: string }>,
    pantryItems: PantryItem[],
    allergies: string[] = [],
    dietaryProfile?: 'vegan' | 'vegetarian' | 'pescatarian' | 'omnivore'
  ): MatchScore {
    const POINTS = {
      PANTRY_MATCH: 3,
      SUBSTITUTABLE: 2,
      MISSING: 0,
      ALLERGY: -Infinity
    }

    // CRITICAL: Normalize pantry at match time, not earlier
    const normalizedPantry = getNormalizedPantry(pantryItems)

    // De-duplicate recipe ingredients by normalized name
    const seenIngredients = new Set<string>()
    const uniqueIngredients: Array<{ name: string; quantity?: string; unit?: string }> = []
    
    for (const ingredient of recipeIngredients) {
      const normalized = normName(ingredient.name)
      if (!seenIngredients.has(normalized)) {
        seenIngredients.add(normalized)
        uniqueIngredients.push(ingredient)
      }
    }

    // Filter out staples - they don't count as required ingredients
    const requiredIngredients = uniqueIngredients.filter(ing => 
      !isStaple(ing.name)
    )

    let totalPoints = 0
    let maxPossiblePoints = 0
    const details: MatchDetail[] = []
    let pantryMatches = 0
    let substitutableMatches = 0
    let missingIngredients = 0
    let allergyConflicts = 0

    // Only score non-staples
    for (const ingredient of requiredIngredients) {
      maxPossiblePoints += POINTS.PANTRY_MATCH

      // Check for allergy conflicts first
      const hasAllergyConflict = this.checkAllergyConflict(ingredient.name, allergies)
      if (hasAllergyConflict) {
        details.push({
          ingredientName: ingredient.name,
          matchType: 'allergy',
          points: POINTS.ALLERGY
        })
        allergyConflicts++
        totalPoints = -Infinity // Auto-reject
        break
      }

      // Check for pantry match with category awareness
      const pantryMatch = this.findPantryMatch(ingredient.name, normalizedPantry)
      if (pantryMatch) {
        totalPoints += POINTS.PANTRY_MATCH
        pantryMatches++
        details.push({
          ingredientName: ingredient.name,
          matchType: 'pantry',
          points: POINTS.PANTRY_MATCH,
          pantryItem: pantryMatch
        })
        continue
      }

      // Check for substitutable ingredient
      const substitution = this.findSubstitution(
        ingredient.name,
        normalizedPantry,
        dietaryProfile
      )
      if (substitution) {
        totalPoints += POINTS.SUBSTITUTABLE
        substitutableMatches++
        details.push({
          ingredientName: ingredient.name,
          matchType: 'substitutable',
          points: POINTS.SUBSTITUTABLE,
          substitution
        })
        continue
      }

      // Missing ingredient
      missingIngredients++
      details.push({
        ingredientName: ingredient.name,
        matchType: 'missing',
        points: POINTS.MISSING
      })
    }

    // Calculate percentage (handle negative infinity)
    let matchPercentage = 0
    if (totalPoints === -Infinity) {
      matchPercentage = 0
    } else if (maxPossiblePoints > 0) {
      matchPercentage = Math.round((totalPoints / maxPossiblePoints) * 100)
    }

    return {
      totalPoints: totalPoints === -Infinity ? 0 : totalPoints,
      maxPossiblePoints,
      matchPercentage,
      breakdown: {
        pantryMatches,
        substitutableMatches,
        missingIngredients,
        allergyConflicts
      },
      details
    }
  }

  /**
   * Check if ingredient conflicts with allergies
   */
  private checkAllergyConflict(ingredientName: string, allergies: string[]): boolean {
    const nameLower = ingredientName.toLowerCase()
    
    for (const allergy of allergies) {
      const allergyLower = allergy.toLowerCase()
      
      // Direct match
      if (nameLower.includes(allergyLower) || allergyLower.includes(nameLower)) {
        return true
      }
      
      // Common allergen mappings
      const allergenMappings: Record<string, string[]> = {
        'dairy': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein'],
        'gluten': ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye'],
        'nuts': ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut'],
        'peanuts': ['peanut', 'groundnut'],
        'shellfish': ['shrimp', 'crab', 'lobster', 'prawn'],
        'soy': ['soy', 'tofu', 'tempeh', 'edamame'],
        'eggs': ['egg', 'mayonnaise'],
        'fish': ['salmon', 'tuna', 'cod', 'sardine', 'anchovy']
      }
      
      if (allergenMappings[allergyLower]) {
        if (allergenMappings[allergyLower].some(term => nameLower.includes(term))) {
          return true
        }
      }
    }
    
    return false
  }

  /**
   * Find matching pantry item using simplified matcher
   */
  private findPantryMatch(
    ingredientName: string,
    pantryItems: PantryItem[]
  ): PantryItem | null {
    const match = simpleMatchIngredient(ingredientName, pantryItems)
    
    if (match.type === 'exact' || match.type === 'alias' || match.type === 'fuzzy') {
      return match.item
    }
    
    return null
  }

  /**
   * Find substitution for missing ingredient
   */
  private findSubstitution(
    ingredientName: string,
    pantryItems: PantryItem[],
    dietaryProfile?: string
  ): Substitution | null {
    const nameLower = ingredientName.toLowerCase()
    
    // Get substitution suggestions
    const substitutions = this.getSubstitutionSuggestions(ingredientName, dietaryProfile)
    
    // Check if any substitution is available in pantry
    for (const sub of substitutions) {
      const found = this.findPantryMatch(sub.substitute, pantryItems)
      if (found) {
        return {
          original: ingredientName,
          substitute: found.name,
          reason: sub.reason,
          confidence: sub.confidence
        }
      }
    }
    
    return null
  }

  /**
   * Get substitution suggestions based on dietary profile
   */
  private getSubstitutionSuggestions(
    ingredientName: string,
    dietaryProfile?: string
  ): Array<{ substitute: string; reason: string; confidence: number }> {
    const nameLower = ingredientName.toLowerCase()
    const substitutions: Array<{ substitute: string; reason: string; confidence: number }> = []
    
    // Vegan substitutions
    if (dietaryProfile === 'vegan') {
      if (nameLower.includes('egg')) {
        substitutions.push(
          { substitute: 'flaxseed gel', reason: 'Vegan egg substitute (1 tbsp ground flaxseed + 3 tbsp water = 1 egg)', confidence: 0.9 },
          { substitute: 'chia seed gel', reason: 'Vegan egg substitute (1 tbsp chia + 3 tbsp water = 1 egg)', confidence: 0.85 },
          { substitute: 'applesauce', reason: 'Vegan egg substitute for baking (1/4 cup = 1 egg)', confidence: 0.8 }
        )
      }
      if (nameLower.includes('butter')) {
        substitutions.push(
          { substitute: 'coconut oil', reason: 'Vegan butter substitute', confidence: 0.95 },
          { substitute: 'olive oil', reason: 'Vegan butter substitute', confidence: 0.9 }
        )
      }
      if (nameLower.includes('milk') || nameLower.includes('cream')) {
        substitutions.push(
          { substitute: 'coconut milk', reason: 'Vegan dairy substitute', confidence: 0.9 },
          { substitute: 'almond milk', reason: 'Vegan dairy substitute', confidence: 0.85 }
        )
      }
      if (nameLower.includes('cheese')) {
        substitutions.push(
          { substitute: 'nutritional yeast', reason: 'Vegan cheese flavor substitute', confidence: 0.8 },
          { substitute: 'tofu', reason: 'Vegan cheese texture substitute', confidence: 0.7 }
        )
      }
      if (nameLower.includes('honey')) {
        substitutions.push(
          { substitute: 'maple syrup', reason: 'Vegan sweetener substitute', confidence: 0.95 },
          { substitute: 'agave', reason: 'Vegan sweetener substitute', confidence: 0.9 }
        )
      }
    }
    
    // Vegetarian substitutions
    if (dietaryProfile === 'vegetarian') {
      if (nameLower.includes('chicken') || nameLower.includes('beef') || nameLower.includes('pork')) {
        substitutions.push(
          { substitute: 'tofu', reason: 'Vegetarian protein substitute', confidence: 0.85 },
          { substitute: 'tempeh', reason: 'Vegetarian protein substitute', confidence: 0.8 },
          { substitute: 'chickpeas', reason: 'Vegetarian protein substitute', confidence: 0.75 }
        )
      }
    }
    
    // Gluten-free substitutions
    if (dietaryProfile === 'gluten-free') {
      if (nameLower.includes('flour') && !nameLower.includes('almond') && !nameLower.includes('coconut')) {
        substitutions.push(
          { substitute: 'almond flour', reason: 'Gluten-free flour substitute', confidence: 0.9 },
          { substitute: 'coconut flour', reason: 'Gluten-free flour substitute', confidence: 0.85 },
          { substitute: 'rice flour', reason: 'Gluten-free flour substitute', confidence: 0.8 }
        )
      }
      if (nameLower.includes('soy sauce')) {
        substitutions.push(
          { substitute: 'tamari', reason: 'Gluten-free soy sauce substitute', confidence: 0.95 },
          { substitute: 'coconut aminos', reason: 'Gluten-free soy sauce substitute', confidence: 0.9 }
        )
      }
    }
    
    // General substitutions
    if (nameLower.includes('soy sauce')) {
      substitutions.push(
        { substitute: 'coconut aminos', reason: 'Soy-free alternative with similar flavor', confidence: 0.9 },
        { substitute: 'tamari', reason: 'Gluten-free soy sauce alternative', confidence: 0.85 }
      )
    }
    
    if (nameLower.includes('white wine')) {
      substitutions.push(
        { substitute: 'white wine vinegar', reason: 'Acidic substitute for white wine', confidence: 0.7 },
        { substitute: 'lemon juice', reason: 'Acidic substitute for white wine', confidence: 0.65 }
      )
    }
    
    if (nameLower.includes('shallot')) {
      substitutions.push(
        { substitute: 'onion', reason: 'Similar flavor profile, more common', confidence: 0.9 },
        { substitute: 'scallion', reason: 'Similar flavor profile', confidence: 0.8 }
      )
    }
    
    return substitutions
  }

  /**
   * Get match summary text for display
   */
  getMatchSummary(score: MatchScore): string {
    if (score.breakdown.allergyConflicts > 0) {
      return 'Contains allergens - not suitable'
    }
    
    const { pantryMatches, substitutableMatches, missingIngredients } = score.breakdown
    const totalIngredients = pantryMatches + substitutableMatches + missingIngredients
    
    if (missingIngredients === 0) {
      return `${score.matchPercentage}% match - All ingredients available`
    }
    
    if (substitutableMatches > 0) {
      return `${score.matchPercentage}% match - ${missingIngredients} missing, ${substitutableMatches} substitutable`
    }
    
    return `${score.matchPercentage}% match - Add ${missingIngredients} ingredient${missingIngredients > 1 ? 's' : ''}`
  }

  /**
   * Get missing ingredients list
   */
  getMissingIngredients(score: MatchScore): string[] {
    return score.details
      .filter(d => d.matchType === 'missing')
      .map(d => d.ingredientName)
  }

  /**
   * Get substitution suggestions for display
   */
  getSubstitutionSuggestions(score: MatchScore): Array<{
    original: string
    substitute: string
    reason: string
  }> {
    return score.details
      .filter(d => d.matchType === 'substitutable' && d.substitution)
      .map(d => ({
        original: d.substitution!.original,
        substitute: d.substitution!.substitute,
        reason: d.substitution!.reason
      }))
  }
}

export const matchScoringService = MatchScoringService.getInstance()

