/**
 * AI Chef Service - World-class recipe generation
 * Creates real, complete, and edible recipes tailored to each user
 */

import { PantryItem } from './supabase'
import { ingredientMatchingService } from './IngredientMatchingService'
import { formatRecipeToStructured, StructuredRecipe, validateStructuredRecipe } from './StructuredRecipeFormatter'

export interface ChefRecipeRequest {
  user_diet?: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'halal' | 'gluten-free'
  user_allergies?: string[]
  household_size: number
  user_pantry: PantryItem[] | string[]
  time_limit_minutes?: number
  difficulty_preference?: 'Easy' | 'Medium' | 'Hard'
  cuisine_preference?: string[]
}

export interface ChefRecipeResponse extends StructuredRecipe {
  meta: {
    title: string
    description: string
    servings: number
    total_time_minutes: number
    difficulty: 'Easy' | 'Medium' | 'Hard'
    cuisine?: string
    match_percentage: number
  }
  nutrition: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

class AIChefService {
  private static instance: AIChefService

  static getInstance(): AIChefService {
    if (!AIChefService.instance) {
      AIChefService.instance = new AIChefService()
    }
    return AIChefService.instance
  }

  /**
   * Generate a complete, realistic recipe using world-class chef logic
   */
  async generateRecipe(request: ChefRecipeRequest): Promise<ChefRecipeResponse> {
    // Normalize pantry items
    const pantryItems = this.normalizePantryItems(request.user_pantry)
    
    // Filter pantry items based on diet and allergies
    const safePantryItems = this.filterSafeIngredients(
      pantryItems,
      request.user_diet || 'omnivore',
      request.user_allergies || []
    )

    if (safePantryItems.length === 0) {
      throw new Error('No safe ingredients available after filtering for diet and allergies')
    }

    // Identify key ingredients (proteins, vegetables, starches)
    const proteins = this.identifyProteins(safePantryItems, request.user_diet)
    const vegetables = this.identifyVegetables(safePantryItems)
    const starches = this.identifyStarches(safePantryItems)
    const seasonings = this.identifySeasonings(safePantryItems)

    // Generate recipe based on available ingredients
    const recipe = this.createRecipeFromIngredients({
      proteins,
      vegetables,
      starches,
      seasonings,
      pantryItems: safePantryItems,
      householdSize: request.household_size,
      diet: request.user_diet || 'omnivore',
      allergies: request.user_allergies || [],
      timeLimit: request.time_limit_minutes || 45,
      difficulty: request.difficulty_preference || 'Medium',
      cuisine: request.cuisine_preference?.[0]
    })

    // Calculate match percentage
    const matchPercentage = this.calculateMatchPercentage(recipe.ingredients, safePantryItems)

    // Convert to structured format
    const structuredRecipe = formatRecipeToStructured(recipe, safePantryItems)

    // Add match percentage and nutrition
    const chefRecipe: ChefRecipeResponse = {
      ...structuredRecipe,
      meta: {
        ...structuredRecipe.meta,
        match_percentage: matchPercentage,
        description: this.generateDescription(structuredRecipe.meta.title, matchPercentage, safePantryItems)
      },
      nutrition: this.calculateNutrition(structuredRecipe.ingredients, structuredRecipe.meta.servings)
    }

    // Validate
    const errors = validateStructuredRecipe(chefRecipe)
    if (errors.length > 0) {
      console.warn('Recipe validation warnings:', errors)
      // Fix common issues
      return this.fixValidationErrors(chefRecipe, errors)
    }

    return chefRecipe
  }

  /**
   * Normalize pantry items (handle both PantryItem[] and string[])
   */
  private normalizePantryItems(pantry: PantryItem[] | string[]): PantryItem[] {
    if (pantry.length === 0) return []
    
    if (typeof pantry[0] === 'string') {
      return (pantry as string[]).map(name => ({
        id: `temp_${name}`,
        name: name,
        quantity: '1',
        unit: 'piece',
        category: 'Other',
        location: 'pantry',
        expiry_date: null,
        user_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    }
    
    return pantry as PantryItem[]
  }

  /**
   * Filter ingredients based on diet and allergies
   */
  private filterSafeIngredients(
    pantryItems: PantryItem[],
    diet: string,
    allergies: string[]
  ): PantryItem[] {
    return pantryItems.filter(item => {
      const name = item.name.toLowerCase()
      
      // Check allergies
      for (const allergy of allergies) {
        const allergyLower = allergy.toLowerCase()
        if (name.includes(allergyLower) || allergyLower.includes(name)) {
          return false
        }
      }
      
      // Check diet restrictions
      if (diet === 'vegan') {
        const nonVegan = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'egg', 'milk', 'cheese', 'butter', 'honey']
        if (nonVegan.some(nv => name.includes(nv))) {
          return false
        }
      }
      
      if (diet === 'vegetarian') {
        const nonVegetarian = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna']
        if (nonVegetarian.some(nv => name.includes(nv))) {
          return false
        }
      }
      
      if (diet === 'pescatarian') {
        const nonPescatarian = ['chicken', 'beef', 'pork']
        if (nonPescatarian.some(nv => name.includes(nv))) {
          return false
        }
      }
      
      return true
    })
  }

  /**
   * Identify proteins in pantry
   */
  private identifyProteins(pantryItems: PantryItem[], diet?: string): PantryItem[] {
    const proteins: PantryItem[] = []
    
    for (const item of pantryItems) {
      const name = item.name.toLowerCase()
      
      // Animal proteins
      if (name.includes('chicken') || name.includes('beef') || name.includes('pork') ||
          name.includes('salmon') || name.includes('fish') || name.includes('tuna') ||
          name.includes('shrimp') || name.includes('turkey') || name.includes('lamb')) {
        proteins.push(item)
        continue
      }
      
      // Plant proteins
      if (name.includes('tofu') || name.includes('tempeh') || name.includes('bean') ||
          name.includes('lentil') || name.includes('chickpea') || name.includes('egg')) {
        proteins.push(item)
      }
    }
    
    return proteins
  }

  /**
   * Identify vegetables in pantry
   */
  private identifyVegetables(pantryItems: PantryItem[]): PantryItem[] {
    const vegetables: PantryItem[] = []
    
    const veggieKeywords = [
      'potato', 'sweet potato', 'onion', 'shallot', 'scallion', 'garlic',
      'tomato', 'pepper', 'bell pepper', 'carrot', 'broccoli', 'spinach',
      'lettuce', 'arugula', 'spring mix', 'greens', 'cucumber', 'zucchini',
      'mushroom', 'eggplant', 'avocado', 'celery', 'leek'
    ]
    
    for (const item of pantryItems) {
      const name = item.name.toLowerCase()
      if (veggieKeywords.some(keyword => name.includes(keyword))) {
        vegetables.push(item)
      }
    }
    
    return vegetables
  }

  /**
   * Identify starches in pantry
   */
  private identifyStarches(pantryItems: PantryItem[]): PantryItem[] {
    const starches: PantryItem[] = []
    
    const starchKeywords = [
      'rice', 'pasta', 'quinoa', 'couscous', 'bread', 'tortilla',
      'potato', 'sweet potato', 'noodle', 'wheat'
    ]
    
    for (const item of pantryItems) {
      const name = item.name.toLowerCase()
      if (starchKeywords.some(keyword => name.includes(keyword))) {
        starches.push(item)
      }
    }
    
    return starches
  }

  /**
   * Identify seasonings in pantry
   */
  private identifySeasonings(pantryItems: PantryItem[]): PantryItem[] {
    const seasonings: PantryItem[] = []
    
    const seasoningKeywords = [
      'salt', 'pepper', 'olive oil', 'butter', 'garlic', 'ginger',
      'paprika', 'cumin', 'oregano', 'thyme', 'rosemary', 'basil',
      'soy sauce', 'vinegar', 'lemon', 'lime', 'honey', 'sugar'
    ]
    
    for (const item of pantryItems) {
      const name = item.name.toLowerCase()
      if (seasoningKeywords.some(keyword => name.includes(keyword))) {
        seasonings.push(item)
      }
    }
    
    return seasonings
  }

  /**
   * Create a complete recipe from available ingredients
   */
  private createRecipeFromIngredients(params: {
    proteins: PantryItem[]
    vegetables: PantryItem[]
    starches: PantryItem[]
    seasonings: PantryItem[]
    pantryItems: PantryItem[]
    householdSize: number
    diet?: string
    allergies: string[]
    timeLimit: number
    difficulty: 'Easy' | 'Medium' | 'Hard'
    cuisine?: string
  }) {
    const { proteins, vegetables, starches, seasonings, householdSize, timeLimit, difficulty, cuisine } = params
    
    // Select main ingredients
    const protein = proteins[0] || null
    const vegetable = vegetables[0] || vegetables[1] || null
    const starch = starches.find(s => !s.name.toLowerCase().includes('potato')) || starches[0] || null
    const additionalVeg = vegetables[1] || vegetables[2] || null
    
    // Generate recipe title and type
    const recipeType = this.determineRecipeType(protein, vegetable, starch, timeLimit)
    const title = this.generateTitle(protein, vegetable, starch, recipeType, cuisine)
    
    // Build ingredients list
    const ingredients: Array<{ name: string; quantity: string; unit: string; inPantry: boolean }> = []
    
    // Add protein
    if (protein) {
      ingredients.push({
        name: protein.name,
        quantity: householdSize.toString(),
        unit: protein.name.toLowerCase().includes('fillet') ? 'piece' : 'g',
        inPantry: true
      })
    }
    
    // Add vegetables
    if (vegetable) {
      ingredients.push({
        name: vegetable.name,
        quantity: householdSize.toString(),
        unit: 'piece',
        inPantry: true
      })
    }
    
    if (additionalVeg) {
      ingredients.push({
        name: additionalVeg.name,
        quantity: householdSize <= 2 ? '1' : '2',
        unit: 'piece',
        inPantry: true
      })
    }
    
    // Add starch
    if (starch) {
      const starchName = starch.name.toLowerCase()
      if (starchName.includes('rice') || starchName.includes('quinoa')) {
        ingredients.push({
          name: starch.name,
          quantity: (householdSize * 75).toString(),
          unit: 'g',
          inPantry: true
        })
      } else if (starchName.includes('pasta')) {
        ingredients.push({
          name: starch.name,
          quantity: (householdSize * 100).toString(),
          unit: 'g',
          inPantry: true
        })
      } else {
        ingredients.push({
          name: starch.name,
          quantity: householdSize.toString(),
          unit: 'piece',
          inPantry: true
        })
      }
    }
    
    // Add common seasonings (always available)
    // Per Recipe Composer rules: never use "to taste", use specific measurements
    const commonSeasonings = [
      { name: 'olive oil', quantity: '1', unit: 'tbsp' },
      { name: 'salt', quantity: householdSize <= 2 ? '1/4' : String((householdSize / 2) * 0.25), unit: 'tsp' },
      { name: 'black pepper', quantity: householdSize <= 2 ? '1/8' : String((householdSize / 2) * 0.125), unit: 'tsp' }
    ]
    
    for (const seasoning of commonSeasonings) {
      const found = seasonings.find(s => 
        s.name.toLowerCase().includes(seasoning.name.split(' ')[0])
      )
      ingredients.push({
        name: seasoning.name,
        quantity: seasoning.quantity,
        unit: seasoning.unit,
        inPantry: found !== undefined
      })
    }
    
    // Generate instructions
    const instructions = this.generateInstructions(
      protein,
      vegetable,
      additionalVeg,
      starch,
      recipeType,
      timeLimit,
      difficulty
    )
    
    // Calculate cook time
    const cookTime = this.calculateCookTime(recipeType, difficulty, timeLimit)
    
    return {
      title,
      servings: householdSize,
      prepTime: 10,
      cookTime,
      difficulty,
      cuisine_type: cuisine || 'Modern',
      ingredients,
      instructions
    }
  }

  /**
   * Determine recipe type based on available ingredients
   */
  private determineRecipeType(
    protein: PantryItem | null,
    vegetable: PantryItem | null,
    starch: PantryItem | null,
    timeLimit: number
  ): 'roast' | 'stir-fry' | 'soup' | 'salad' | 'pasta' | 'rice' {
    if (timeLimit < 20) {
      return 'salad'
    }
    
    if (starch?.name.toLowerCase().includes('pasta')) {
      return 'pasta'
    }
    
    if (starch?.name.toLowerCase().includes('rice')) {
      return 'rice'
    }
    
    if (protein && vegetable) {
      return 'roast'
    }
    
    return 'stir-fry'
  }

  /**
   * Generate recipe title
   */
  private generateTitle(
    protein: PantryItem | null,
    vegetable: PantryItem | null,
    starch: PantryItem | null,
    recipeType: string,
    cuisine?: string
  ): string {
    const parts: string[] = []
    
    if (protein) {
      const proteinName = this.formatIngredientName(protein.name)
      parts.push(proteinName)
    }
    
    if (vegetable) {
      const vegName = this.formatIngredientName(vegetable.name)
      parts.push(vegName)
    }
    
    if (starch && !starch.name.toLowerCase().includes('potato')) {
      const starchName = this.formatIngredientName(starch.name)
      parts.push(starchName)
    }
    
    if (parts.length === 0) {
      return `${recipeType.charAt(0).toUpperCase() + recipeType.slice(1)} Bowl`
    }
    
    return parts.join(' with ')
  }

  /**
   * Format ingredient name for recipe title
   */
  private formatIngredientName(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  /**
   * Generate detailed cooking instructions
   */
  private generateInstructions(
    protein: PantryItem | null,
    vegetable: PantryItem | null,
    additionalVeg: PantryItem | null,
    starch: PantryItem | null,
    recipeType: string,
    timeLimit: number,
    difficulty: 'Easy' | 'Medium' | 'Hard'
  ): string[] {
    const instructions: string[] = []
    
    if (recipeType === 'roast') {
      instructions.push('Preheat oven to 220°C and line a baking sheet with parchment paper.')
      instructions.push(`Toss ${vegetable?.name || 'vegetables'} with olive oil, salt, and pepper. Spread evenly on the sheet.`)
      instructions.push(`Roast for 20 minutes, turning once halfway through.`)
      if (protein) {
        instructions.push(`Push vegetables to the sides, place ${protein.name} in the center, and season with salt and pepper.`)
        instructions.push(`Return to oven and roast until cooked through, 10–12 minutes.`)
      }
      instructions.push('Serve hot with remaining pan juices.')
    } else if (recipeType === 'stir-fry') {
      instructions.push('Heat a large skillet or wok over high heat. Add 1 tbsp olive oil.')
      if (protein) {
        instructions.push(`Add ${protein.name} and cook until golden, 4–5 minutes. Remove and set aside.`)
      }
      if (vegetable) {
        instructions.push(`Add ${vegetable.name} to the same pan and stir-fry for 3–4 minutes until crisp-tender.`)
      }
      if (protein) {
        instructions.push(`Return ${protein.name} to the pan and toss together.`)
      }
      instructions.push('Season with salt and pepper to taste. Serve immediately.')
    } else if (recipeType === 'pasta' || recipeType === 'rice') {
      instructions.push(`Cook ${starch?.name || 'starch'} according to package directions.`)
      if (protein) {
        instructions.push(`Meanwhile, cook ${protein.name} in a pan with olive oil until done, 6–8 minutes.`)
      }
      if (vegetable) {
        instructions.push(`Add ${vegetable.name} and cook until tender, 3–4 minutes.`)
      }
      instructions.push(`Combine ${starch?.name || 'starch'} with cooked ingredients and season with salt and pepper.`)
      instructions.push('Serve hot.')
    } else {
      instructions.push('Combine all ingredients in a large bowl.')
      instructions.push('Toss with olive oil, salt, and pepper.')
      instructions.push('Serve immediately.')
    }
    
    return instructions
  }

  /**
   * Calculate cook time based on recipe type and difficulty
   */
  private calculateCookTime(
    recipeType: string,
    difficulty: 'Easy' | 'Medium' | 'Hard',
    timeLimit: number
  ): number {
    const baseTimes: Record<string, number> = {
      'roast': 30,
      'stir-fry': 15,
      'soup': 25,
      'salad': 5,
      'pasta': 20,
      'rice': 25
    }
    
    const baseTime = baseTimes[recipeType] || 20
    const difficultyMultiplier = difficulty === 'Easy' ? 0.8 : difficulty === 'Medium' ? 1.0 : 1.2
    
    return Math.min(Math.round(baseTime * difficultyMultiplier), timeLimit)
  }

  /**
   * Calculate match percentage
   */
  private calculateMatchPercentage(
    ingredients: Array<{ name: string; inPantry?: boolean }>,
    pantryItems: PantryItem[]
  ): number {
    if (ingredients.length === 0) return 0
    
    let matched = 0
    
    for (const ing of ingredients) {
      if (ing.inPantry === true) {
        matched++
        continue
      }
      
      // Check if ingredient matches pantry item
      const found = pantryItems.some(pantryItem => {
        const matchResult = ingredientMatchingService.matchIngredient(ing.name, pantryItem.name)
        return matchResult.isMatch && matchResult.confidence >= 0.70
      })
      
      if (found) {
        matched++
      }
    }
    
    return Math.round((matched / ingredients.length) * 100)
  }

  /**
   * Generate recipe description
   */
  private generateDescription(
    title: string,
    matchPercentage: number,
    pantryItems: PantryItem[]
  ): string {
    const pantryCount = pantryItems.length
    return `A delicious ${title.toLowerCase()} using ${pantryCount} items from your pantry. ${matchPercentage}% match with your available ingredients.`
  }

  /**
   * Calculate nutrition estimates
   */
  private calculateNutrition(
    ingredients: StructuredRecipe['ingredients'],
    servings: number
  ): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
    // Base nutrition per serving
    let calories = 0
    let protein = 0
    let carbs = 0
    let fat = 0
    
    for (const ing of ingredients) {
      const name = ing.name_canonical.toLowerCase()
      const qty = typeof ing.quantity_recipe_value === 'number' 
        ? ing.quantity_recipe_value 
        : parseFloat(String(ing.quantity_recipe_value)) || 0
      
      // Estimate nutrition based on ingredient type
      if (name.includes('salmon') || name.includes('fish')) {
        calories += 200 * qty
        protein += 30 * qty
        fat += 10 * qty
      } else if (name.includes('chicken')) {
        calories += 180 * qty
        protein += 30 * qty
        fat += 5 * qty
      } else if (name.includes('sweet potato') || name.includes('potato')) {
        calories += 100 * qty
        carbs += 25 * qty
      } else if (name.includes('rice') || name.includes('pasta')) {
        calories += 130 * qty
        carbs += 28 * qty
      } else if (name.includes('vegetable') || name.includes('shallot') || name.includes('onion')) {
        calories += 20 * qty
        carbs += 5 * qty
      }
    }
    
    // Scale by servings
    return {
      calories: Math.round(calories / servings),
      protein_g: Math.round(protein / servings),
      carbs_g: Math.round(carbs / servings),
      fat_g: Math.round(fat / servings)
    }
  }

  /**
   * Fix validation errors
   */
  private fixValidationErrors(
    recipe: ChefRecipeResponse,
    errors: string[]
  ): ChefRecipeResponse {
    // Fix duplicate ingredients
    const seen = new Set<string>()
    recipe.ingredients = recipe.ingredients.filter(ing => {
      const key = ing.name_canonical.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    
    // Ensure pantry items have correct purchase fields
    for (const ing of recipe.ingredients) {
      if (ing.is_pantry_item) {
        ing.quantity_purchase_value = '—'
        ing.unit_purchase = '—'
      }
    }
    
    return recipe
  }
}

export const aiChefService = AIChefService.getInstance()

