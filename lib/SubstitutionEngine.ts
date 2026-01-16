/**
 * Substitution Engine
 * AI-powered ingredient substitutions based on dietary profiles
 */

import { PantryItem } from './supabase'
import { ingredientMatchingService } from './IngredientMatchingService'

export interface SubstitutionSuggestion {
  original: string
  substitutes: Array<{
    name: string
    reason: string
    confidence: number
    inPantry?: boolean
    pantryItem?: PantryItem
  }>
  dietaryContext?: string
}

export interface DietaryProfile {
  diet?: 'vegan' | 'vegetarian' | 'pescatarian' | 'omnivore' | 'keto' | 'paleo'
  allergies?: string[]
  restrictions?: string[]
}

class SubstitutionEngine {
  private static instance: SubstitutionEngine

  static getInstance(): SubstitutionEngine {
    if (!SubstitutionEngine.instance) {
      SubstitutionEngine.instance = new SubstitutionEngine()
    }
    return SubstitutionEngine.instance
  }

  /**
   * Get substitution suggestions for an ingredient
   */
  getSubstitutions(
    ingredientName: string,
    pantryItems: PantryItem[],
    dietaryProfile?: DietaryProfile
  ): SubstitutionSuggestion {
    const substitutions = this.findSubstitutions(ingredientName, dietaryProfile)
    
    // Check which substitutions are available in pantry
    const enrichedSubstitutions = substitutions.map(sub => {
      const pantryMatch = this.findPantryMatch(sub.name, pantryItems)
      return {
        name: sub.name,
        reason: sub.reason,
        confidence: sub.confidence,
        inPantry: pantryMatch !== null,
        pantryItem: pantryMatch || undefined
      }
    })

    // Sort by confidence and pantry availability
    enrichedSubstitutions.sort((a, b) => {
      // Prioritize items in pantry
      if (a.inPantry && !b.inPantry) return -1
      if (!a.inPantry && b.inPantry) return 1
      // Then by confidence
      return b.confidence - a.confidence
    })

    return {
      original: ingredientName,
      substitutes: enrichedSubstitutions,
      dietaryContext: this.getDietaryContext(dietaryProfile)
    }
  }

  /**
   * Find substitutions based on ingredient and dietary profile
   */
  private findSubstitutions(
    ingredientName: string,
    dietaryProfile?: DietaryProfile
  ): Array<{ name: string; reason: string; confidence: number }> {
    const nameLower = ingredientName.toLowerCase()
    const substitutions: Array<{ name: string; reason: string; confidence: number }> = []

    const diet = dietaryProfile?.diet
    const allergies = dietaryProfile?.allergies || []

    // EGG SUBSTITUTIONS
    if (nameLower.includes('egg')) {
      if (diet === 'vegan' || allergies.includes('Eggs')) {
        substitutions.push(
          {
            name: 'flaxseed gel',
            reason: 'Vegan egg substitute: 1 tbsp ground flaxseed + 3 tbsp water = 1 egg. Best for binding.',
            confidence: 0.95
          },
          {
            name: 'chia seed gel',
            reason: 'Vegan egg substitute: 1 tbsp chia seeds + 3 tbsp water = 1 egg. Similar to flaxseed.',
            confidence: 0.90
          },
          {
            name: 'applesauce',
            reason: 'Vegan egg substitute for baking: 1/4 cup = 1 egg. Adds moisture and sweetness.',
            confidence: 0.85
          },
          {
            name: 'mashed banana',
            reason: 'Vegan egg substitute for baking: 1/4 cup = 1 egg. Adds moisture and natural sweetness.',
            confidence: 0.80
          }
        )
      }
    }

    // DAIRY SUBSTITUTIONS
    if (nameLower.includes('butter')) {
      if (diet === 'vegan' || allergies.some(a => a.toLowerCase().includes('dairy'))) {
        substitutions.push(
          {
            name: 'coconut oil',
            reason: 'Vegan butter substitute: 1:1 ratio. Solid at room temperature, similar texture.',
            confidence: 0.95
          },
          {
            name: 'olive oil',
            reason: 'Vegan butter substitute: Use 3/4 cup oil for 1 cup butter. Best for sautéing.',
            confidence: 0.90
          },
          {
            name: 'avocado',
            reason: 'Vegan butter substitute: Mashed avocado adds creaminess. Use 1:1 ratio.',
            confidence: 0.85
          }
        )
      }
    }

    if (nameLower.includes('milk') || nameLower.includes('cream')) {
      if (diet === 'vegan' || allergies.some(a => a.toLowerCase().includes('dairy'))) {
        substitutions.push(
          {
            name: 'coconut milk',
            reason: 'Vegan dairy substitute: Rich and creamy, 1:1 ratio. Great for cooking and baking.',
            confidence: 0.95
          },
          {
            name: 'almond milk',
            reason: 'Vegan dairy substitute: Light and neutral flavor, 1:1 ratio.',
            confidence: 0.90
          },
          {
            name: 'oat milk',
            reason: 'Vegan dairy substitute: Creamy and slightly sweet, 1:1 ratio.',
            confidence: 0.90
          },
          {
            name: 'cashew milk',
            reason: 'Vegan dairy substitute: Very creamy, 1:1 ratio.',
            confidence: 0.85
          }
        )
      }
    }

    if (nameLower.includes('cheese')) {
      if (diet === 'vegan' || allergies.some(a => a.toLowerCase().includes('dairy'))) {
        substitutions.push(
          {
            name: 'nutritional yeast',
            reason: 'Vegan cheese flavor substitute: Adds umami and cheesy flavor. Sprinkle on top.',
            confidence: 0.90
          },
          {
            name: 'tofu',
            reason: 'Vegan cheese texture substitute: Crumble or blend for creamy texture.',
            confidence: 0.80
          },
          {
            name: 'cashews',
            reason: 'Vegan cheese substitute: Soak and blend for creamy cheese-like texture.',
            confidence: 0.85
          }
        )
      }
    }

    // MEAT SUBSTITUTIONS
    if (nameLower.includes('chicken') || nameLower.includes('beef') || nameLower.includes('pork')) {
      if (diet === 'vegetarian' || diet === 'vegan') {
        substitutions.push(
          {
            name: 'tofu',
            reason: 'Vegetarian protein substitute: Firm tofu works best. Marinate for flavor.',
            confidence: 0.90
          },
          {
            name: 'tempeh',
            reason: 'Vegetarian protein substitute: Fermented soy with meaty texture. Great for grilling.',
            confidence: 0.90
          },
          {
            name: 'chickpeas',
            reason: 'Vegetarian protein substitute: Great for curries and salads. High in protein.',
            confidence: 0.85
          },
          {
            name: 'lentils',
            reason: 'Vegetarian protein substitute: Perfect for ground meat replacements in sauces.',
            confidence: 0.85
          },
          {
            name: 'mushrooms',
            reason: 'Vegetarian protein substitute: Portobello or shiitake work great. Meat-like texture.',
            confidence: 0.80
          }
        )
      }
    }

    // GLUTEN SUBSTITUTIONS
    if (nameLower.includes('flour') && !nameLower.includes('almond') && !nameLower.includes('coconut')) {
      if (allergies.some(a => a.toLowerCase().includes('gluten')) || dietaryProfile?.restrictions?.includes('gluten-free')) {
        substitutions.push(
          {
            name: 'almond flour',
            reason: 'Gluten-free flour substitute: Use 1:1 ratio. Higher in protein and fat.',
            confidence: 0.95
          },
          {
            name: 'coconut flour',
            reason: 'Gluten-free flour substitute: Use 1/4 cup for every 1 cup regular flour. Very absorbent.',
            confidence: 0.90
          },
          {
            name: 'rice flour',
            reason: 'Gluten-free flour substitute: Use 1:1 ratio. Light and neutral flavor.',
            confidence: 0.90
          },
          {
            name: 'oat flour',
            reason: 'Gluten-free flour substitute: Use 1:1 ratio. Ensure certified gluten-free oats.',
            confidence: 0.85
          }
        )
      }
    }

    // SOY SUBSTITUTIONS
    if (nameLower.includes('soy sauce')) {
      substitutions.push(
        {
          name: 'coconut aminos',
          reason: 'Soy-free alternative: Similar flavor, lower sodium. Use 1:1 ratio.',
          confidence: 0.95
        },
        {
          name: 'tamari',
          reason: 'Gluten-free soy sauce alternative: Same flavor, no wheat. Use 1:1 ratio.',
          confidence: 0.90
        },
        {
          name: 'liquid aminos',
          reason: 'Soy-free alternative: Similar umami flavor. Use 1:1 ratio.',
          confidence: 0.85
        }
      )
    }

    // HONEY SUBSTITUTIONS
    if (nameLower.includes('honey')) {
      if (diet === 'vegan') {
        substitutions.push(
          {
            name: 'maple syrup',
            reason: 'Vegan sweetener substitute: Similar viscosity and sweetness. Use 1:1 ratio.',
            confidence: 0.95
          },
          {
            name: 'agave nectar',
            reason: 'Vegan sweetener substitute: Sweeter than honey, use 3/4 for every 1 cup honey.',
            confidence: 0.90
          },
          {
            name: 'date syrup',
            reason: 'Vegan sweetener substitute: Rich and caramel-like. Use 1:1 ratio.',
            confidence: 0.85
          }
        )
      }
    }

    // WINE SUBSTITUTIONS
    if (nameLower.includes('wine')) {
      substitutions.push(
        {
          name: 'wine vinegar',
          reason: 'Non-alcoholic substitute: Use white or red wine vinegar. Add a pinch of sugar.',
          confidence: 0.85
        },
        {
          name: 'broth',
          reason: 'Non-alcoholic substitute: Use vegetable or chicken broth with a splash of vinegar.',
          confidence: 0.80
        },
        {
          name: 'lemon juice',
          reason: 'Acidic substitute: Adds brightness. Use 1-2 tbsp for deglazing.',
          confidence: 0.75
        }
      )
    }

    // SHALLOT/ONION SUBSTITUTIONS
    if (nameLower.includes('shallot')) {
      substitutions.push(
        {
          name: 'onion',
          reason: 'More common substitute: Use 1/2 small onion for 1 shallot. Similar flavor.',
          confidence: 0.90
        },
        {
          name: 'scallion',
          reason: 'Similar flavor profile: Use white and light green parts. 2-3 scallions = 1 shallot.',
          confidence: 0.85
        }
      )
    }

    return substitutions
  }

  /**
   * Find pantry match for substitution
   */
  private findPantryMatch(ingredientName: string, pantryItems: PantryItem[]): PantryItem | null {
    for (const pantryItem of pantryItems) {
      const matchResult = ingredientMatchingService.matchIngredient(
        ingredientName,
        pantryItem.name
      )
      
      if (matchResult.isMatch && matchResult.confidence >= 0.70) {
        return pantryItem
      }
    }
    
    return null
  }

  /**
   * Get dietary context string
   */
  private getDietaryContext(profile?: DietaryProfile): string {
    if (!profile) return ''
    
    const parts: string[] = []
    
    if (profile.diet) {
      parts.push(profile.diet)
    }
    
    if (profile.allergies && profile.allergies.length > 0) {
      parts.push(`allergies: ${profile.allergies.join(', ')}`)
    }
    
    return parts.join(' | ')
  }

  /**
   * Format substitution suggestion for inline display
   */
  formatSubstitutionSuggestion(suggestion: SubstitutionSuggestion): string {
    if (suggestion.substitutes.length === 0) {
      return ''
    }
    
    const bestSub = suggestion.substitutes[0]
    const pantryText = bestSub.inPantry ? ' (you have this)' : ''
    
    return `You can replace ${suggestion.original} with ${bestSub.name}${pantryText}. ${bestSub.reason}`
  }
}

export const substitutionEngine = SubstitutionEngine.getInstance()

