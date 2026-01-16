// SAVR Advanced Personal Recipe Generator
// Creates original, cookable recipes tailored to user's pantry, diet, allergies, and preferences

import { supabase, Recipe } from './supabase'
import { userPreferencesService } from './UserPreferencesService'
import { usePantry } from './PantryContext'

interface PantryItem {
  name: string
  qty: string
  unit: string
  category: string
}

interface PriorSuggestion {
  title: string
  timestamp: string
  ingredients: string[]
  hash: string
}

interface NutritionTargets {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  sodium_mg?: number
}

interface RecipeGenerationRequest {
  pantry_items: PantryItem[]
  freezer_items: PantryItem[]
  fridge_items: PantryItem[]
  dislikes: string[]
  cravings: string[]
  diet: string
  allergies: string[]
  intolerances: string[]
  avoid_ingredients: string[]
  servings: number
  skill_level: 'beginner' | 'intermediate' | 'advanced'
  time_limit_minutes: number
  appliances: string[]
  cuisines_preferred: string[]
  cuisines_avoid: string[]
  nutrition_targets: NutritionTargets
  prior_suggestions: PriorSuggestion[]
  novelty_window_days: number
  max_results: number
}

interface GeneratedRecipe {
  title: string
  description: string
  meal_type: string
  cuisine_type: string
  prep_time: number
  cook_time: number
  servings: number
  difficulty: string
  ingredients: Array<{
    name: string
    quantity: string
    unit: string
    in_pantry: boolean
  }>
  instructions: Array<{
    step: number
    description: string
  }>
  nutrition: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sodium: number
  }
  appliances_used: string[]
  skill_level_required: string
  tags: string[]
  hash: string
}

class AdvancedRecipeGenerator {
  private readonly ALLERGY_RESTRICTIONS = {
    peanut: ['peanuts', 'peanut oil', 'peanut butter', 'peanut flour'],
    tree_nut: ['almonds', 'walnuts', 'cashews', 'pistachios', 'pecans', 'hazelnuts', 'macadamia nuts', 'brazil nuts', 'pine nuts'],
    dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'sour cream', 'whey', 'casein', 'lactose'],
    egg: ['eggs', 'egg whites', 'egg yolks', 'mayonnaise'],
    soy: ['soy sauce', 'tofu', 'tempeh', 'miso', 'soy milk', 'soy oil', 'edamame'],
    shellfish: ['shrimp', 'crab', 'lobster', 'oysters', 'mussels', 'clams', 'scallops'],
    gluten: ['wheat', 'barley', 'rye', 'flour', 'bread', 'pasta', 'soy sauce with wheat']
  }

  private readonly DIETARY_RULES = {
    vegan: {
      forbidden: ['meat', 'fish', 'poultry', 'dairy', 'eggs', 'honey', 'gelatin', 'fish sauce', 'anchovies'],
      substitutions: {
        'butter': 'vegan butter or coconut oil',
        'milk': 'plant-based milk',
        'cheese': 'nutritional yeast or vegan cheese',
        'eggs': 'flax eggs or applesauce',
        'honey': 'maple syrup or agave'
      }
    },
    vegetarian: {
      forbidden: ['meat', 'fish', 'poultry', 'gelatin', 'fish sauce', 'anchovies'],
      substitutions: {
        'chicken': 'tofu or tempeh',
        'beef': 'lentils or mushrooms',
        'fish': 'tofu or seaweed'
      }
    },
    gluten_free: {
      forbidden: ['wheat', 'barley', 'rye', 'flour', 'bread', 'pasta'],
      substitutions: {
        'soy sauce': 'tamari',
        'flour': 'gluten-free flour blend',
        'breadcrumbs': 'gluten-free breadcrumbs'
      }
    },
    halal: {
      forbidden: ['pork', 'alcohol', 'gelatin from pork'],
      substitutions: {
        'bacon': 'turkey bacon',
        'wine': 'grape juice or vinegar'
      }
    },
    kosher: {
      forbidden: ['pork', 'shellfish', 'mixing meat and dairy'],
      substitutions: {
        'bacon': 'turkey bacon',
        'shellfish': 'fish'
      }
    }
  }

  private readonly CUISINE_SIGNATURES = {
    italian: {
      aromatics: ['garlic', 'onion', 'basil', 'oregano', 'parsley'],
      acids: ['lemon', 'balsamic vinegar', 'tomato'],
      fats: ['olive oil', 'parmesan cheese'],
      techniques: ['sauté', 'simmer', 'braise']
    },
    asian: {
      aromatics: ['ginger', 'garlic', 'scallions', 'cilantro'],
      acids: ['rice vinegar', 'lime', 'soy sauce'],
      fats: ['sesame oil', 'coconut oil'],
      techniques: ['stir-fry', 'steam', 'wok cooking']
    },
    mexican: {
      aromatics: ['onion', 'garlic', 'cilantro', 'cumin', 'chili'],
      acids: ['lime', 'tomato'],
      fats: ['avocado oil', 'cheese'],
      techniques: ['sauté', 'grill', 'roast']
    },
    mediterranean: {
      aromatics: ['garlic', 'onion', 'oregano', 'thyme', 'rosemary'],
      acids: ['lemon', 'olive oil'],
      fats: ['olive oil', 'feta cheese'],
      techniques: ['roast', 'grill', 'sauté']
    }
  }

  /**
   * Generate personalized recipes based on comprehensive user context
   */
  async generatePersonalizedRecipes(request: RecipeGenerationRequest): Promise<GeneratedRecipe[]> {
    try {
      console.log('🎯 Advanced Recipe Generator: Starting personalized recipe generation')
      console.log('📊 Request details:', {
        pantryItems: request.pantry_items.length,
        freezerItems: request.freezer_items.length,
        diet: request.diet,
        allergies: request.allergies,
        maxResults: request.max_results
      })
      
      // Validate constraints
      const validation = this.validateConstraints(request)
      if (!validation.valid) {
        throw new Error(validation.reason)
      }

      // Get all available ingredients
      const allIngredients = [
        ...request.pantry_items,
        ...request.freezer_items,
        ...request.fridge_items
      ]

      console.log('🥘 Available ingredients:', allIngredients.map(item => item.name))

      // Filter out disliked and avoided ingredients
      const availableIngredients = this.filterIngredients(allIngredients, request)
      console.log('✅ Filtered ingredients:', availableIngredients.map(item => item.name))

      // Generate recipes
      const recipes: GeneratedRecipe[] = []
      const usedHashes = new Set(request.prior_suggestions.map(s => s.hash))

      for (let i = 0; i < request.max_results; i++) {
        try {
          const recipe = await this.generateSingleRecipe(request, availableIngredients, usedHashes)
          if (recipe) {
            recipes.push(recipe)
            usedHashes.add(recipe.hash)
            console.log(`✅ Generated recipe ${i + 1}: ${recipe.title}`)
          } else {
            console.log(`⚠️ Failed to generate recipe ${i + 1} - no suitable ingredients`)
          }
        } catch (error) {
          console.warn(`Failed to generate recipe ${i + 1}:`, error)
        }
      }

      // If no recipes generated, create simple fallback recipes
      if (recipes.length === 0 && availableIngredients.length > 0) {
        console.log('🔄 Creating fallback recipes with available ingredients...')
        const fallbackRecipes = this.createFallbackRecipes(availableIngredients, request)
        recipes.push(...fallbackRecipes)
      }

      console.log(`✨ Generated ${recipes.length} personalized recipes`)
      return recipes

    } catch (error) {
      console.error('❌ Advanced Recipe Generator Error:', error)
      throw error
    }
  }

  /**
   * Validate dietary and allergy constraints
   */
  private validateConstraints(request: RecipeGenerationRequest): { valid: boolean; reason?: string } {
    // Check for impossible combinations
    if (request.diet === 'vegan' && request.allergies.includes('soy')) {
      return { valid: false, reason: 'Vegan diet with soy allergy severely limits protein options' }
    }

    if (request.diet === 'gluten_free' && request.allergies.includes('tree_nut')) {
      return { valid: false, reason: 'Gluten-free diet with tree nut allergy limits flour alternatives' }
    }

    return { valid: true }
  }

  /**
   * Filter ingredients based on dislikes and avoid lists
   */
  private filterIngredients(ingredients: PantryItem[], request: RecipeGenerationRequest): PantryItem[] {
    return ingredients.filter(item => {
      const name = item.name.toLowerCase()
      
      // Check dislikes
      if (request.dislikes.some(dislike => name.includes(dislike.toLowerCase()))) {
        return false
      }

      // Check avoid ingredients
      if (request.avoid_ingredients.some(avoid => name.includes(avoid.toLowerCase()))) {
        return false
      }

      return true
    })
  }

  /**
   * Generate a single recipe
   */
  private async generateSingleRecipe(
    request: RecipeGenerationRequest,
    availableIngredients: PantryItem[],
    usedHashes: Set<string>
  ): Promise<GeneratedRecipe | null> {
    
    // Choose cuisine based on preferences and available ingredients
    const cuisine = this.selectCuisine(request, availableIngredients)
    
    // Select anchor ingredients (protein or primary vegetable + starch)
    const anchorIngredients = this.selectAnchorIngredients(availableIngredients, request, cuisine)
    
    if (anchorIngredients.length === 0) {
      return null
    }

    // Build recipe around anchor ingredients
    const recipe = await this.buildRecipe(anchorIngredients, availableIngredients, request, cuisine)
    
    // Check for novelty (avoid recent duplicates)
    if (usedHashes.has(recipe.hash)) {
      return null
    }

    return recipe
  }

  /**
   * Select appropriate cuisine based on preferences and available ingredients
   */
  private selectCuisine(request: RecipeGenerationRequest, availableIngredients: PantryItem[]): string {
    const preferredCuisines = request.cuisines_preferred
    const avoidedCuisines = request.cuisines_avoid

    // If user has strong preferences, respect them
    if (preferredCuisines.length > 0) {
      const validCuisines = preferredCuisines.filter(c => !avoidedCuisines.includes(c))
      if (validCuisines.length > 0) {
        return validCuisines[Math.floor(Math.random() * validCuisines.length)]
      }
    }

    // Analyze available ingredients to suggest cuisine
    const ingredientNames = availableIngredients.map(item => item.name.toLowerCase())
    
    if (ingredientNames.some(name => ['ginger', 'soy sauce', 'sesame oil', 'rice'].includes(name))) {
      return 'asian'
    }
    if (ingredientNames.some(name => ['tomato', 'basil', 'oregano', 'olive oil'].includes(name))) {
      return 'italian'
    }
    if (ingredientNames.some(name => ['cumin', 'chili', 'lime', 'cilantro'].includes(name))) {
      return 'mexican'
    }
    if (ingredientNames.some(name => ['olive oil', 'lemon', 'garlic', 'herbs'].includes(name))) {
      return 'mediterranean'
    }

    // Default to a balanced approach
    return 'mediterranean'
  }

  /**
   * Select anchor ingredients (protein or primary vegetable + starch)
   */
  private selectAnchorIngredients(
    availableIngredients: PantryItem[],
    request: RecipeGenerationRequest,
    cuisine: string
  ): PantryItem[] {
    
    const anchors: PantryItem[] = []
    
    // Look for proteins first
    const proteins = availableIngredients.filter(item => 
      this.isProtein(item.name) && this.isAllowedForDiet(item.name, request.diet)
    )
    
    if (proteins.length > 0) {
      anchors.push(proteins[Math.floor(Math.random() * proteins.length)])
    }

    // Look for primary vegetables
    const vegetables = availableIngredients.filter(item => 
      this.isVegetable(item.name) && !anchors.some(anchor => anchor.name === item.name)
    )
    
    if (vegetables.length > 0 && anchors.length < 2) {
      anchors.push(vegetables[Math.floor(Math.random() * vegetables.length)])
    }

    // Look for starches
    const starches = availableIngredients.filter(item => 
      this.isStarch(item.name) && !anchors.some(anchor => anchor.name === item.name)
    )
    
    if (starches.length > 0 && anchors.length < 2) {
      anchors.push(starches[Math.floor(Math.random() * starches.length)])
    }

    return anchors
  }

  /**
   * Build complete recipe around anchor ingredients
   */
  private async buildRecipe(
    anchorIngredients: PantryItem[],
    availableIngredients: PantryItem[],
    request: RecipeGenerationRequest,
    cuisine: string
  ): Promise<GeneratedRecipe> {
    
    const cuisineProfile = this.CUISINE_SIGNATURES[cuisine as keyof typeof this.CUISINE_SIGNATURES] || this.CUISINE_SIGNATURES.mediterranean
    
    // Select supporting ingredients
    const supportingIngredients = this.selectSupportingIngredients(
      anchorIngredients,
      availableIngredients,
      cuisineProfile,
      request
    )

    // Create recipe structure
    const recipe = this.createRecipeStructure(
      anchorIngredients,
      supportingIngredients,
      request,
      cuisine
    )

    return recipe
  }

  /**
   * Select supporting ingredients (aromatics, acids, fats, seasonings)
   */
  private selectSupportingIngredients(
    anchors: PantryItem[],
    availableIngredients: PantryItem[],
    cuisineProfile: any,
    request: RecipeGenerationRequest
  ): PantryItem[] {
    
    const supporting: PantryItem[] = []
    const used = new Set(anchors.map(a => a.name))

    // Add aromatics
    const aromatics = availableIngredients.filter(item => 
      cuisineProfile.aromatics.some((aromatic: string) => 
        item.name.toLowerCase().includes(aromatic.toLowerCase())
      ) && !used.has(item.name)
    )
    
    if (aromatics.length > 0) {
      supporting.push(aromatics[0])
      used.add(aromatics[0].name)
    }

    // Add acids
    const acids = availableIngredients.filter(item => 
      cuisineProfile.acids.some((acid: string) => 
        item.name.toLowerCase().includes(acid.toLowerCase())
      ) && !used.has(item.name)
    )
    
    if (acids.length > 0) {
      supporting.push(acids[0])
      used.add(acids[0].name)
    }

    // Add fats
    const fats = availableIngredients.filter(item => 
      cuisineProfile.fats.some((fat: string) => 
        item.name.toLowerCase().includes(fat.toLowerCase())
      ) && !used.has(item.name)
    )
    
    if (fats.length > 0) {
      supporting.push(fats[0])
      used.add(fats[0].name)
    }

    return supporting
  }

  /**
   * Create complete recipe structure
   */
  private createRecipeStructure(
    anchors: PantryItem[],
    supporting: PantryItem[],
    request: RecipeGenerationRequest,
    cuisine: string
  ): GeneratedRecipe {
    
    const allIngredients = [...anchors, ...supporting]
    const recipeName = this.generateRecipeName(anchors, cuisine)
    
    return {
      title: recipeName,
      description: this.generateDescription(anchors, cuisine, request.skill_level),
      meal_type: this.determineMealType(request.cravings, anchors),
      cuisine_type: cuisine,
      prep_time: this.calculatePrepTime(request.skill_level, allIngredients.length),
      cook_time: this.calculateCookTime(request.time_limit_minutes, request.skill_level),
      servings: request.servings,
      difficulty: request.skill_level,
      ingredients: this.formatIngredients(allIngredients, request.servings),
      instructions: this.generateInstructions(anchors, supporting, cuisine, request.skill_level),
      nutrition: this.calculateNutrition(allIngredients, request.servings),
      appliances_used: this.determineAppliances(request.appliances, cuisine),
      skill_level_required: request.skill_level,
      tags: this.generateTags(anchors, cuisine, request.diet),
      hash: this.generateHash(anchors, supporting, cuisine)
    }
  }

  /**
   * Generate recipe name based on anchor ingredients and cuisine
   */
  private generateRecipeName(anchors: PantryItem[], cuisine: string): string {
    const primaryIngredient = anchors[0]?.name || 'Vegetable'
    const cuisineAdjectives = {
      italian: ['Rustic', 'Classic', 'Traditional'],
      asian: ['Aromatic', 'Fragrant', 'Spiced'],
      mexican: ['Zesty', 'Bold', 'Fiery'],
      mediterranean: ['Fresh', 'Herbed', 'Light']
    }
    
    const adjectives = cuisineAdjectives[cuisine as keyof typeof cuisineAdjectives] || ['Delicious', 'Flavorful', 'Savory']
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
    
    return `${adjective} ${primaryIngredient} ${cuisine.charAt(0).toUpperCase() + cuisine.slice(1)} Style`
  }

  /**
   * Generate recipe description
   */
  private generateDescription(anchors: PantryItem[], cuisine: string, skillLevel: string): string {
    const primaryIngredient = anchors[0]?.name || 'ingredients'
    const cuisineDescriptions = {
      italian: 'A classic Italian-inspired dish',
      asian: 'An aromatic Asian-style preparation',
      mexican: 'A bold Mexican-inspired creation',
      mediterranean: 'A fresh Mediterranean approach'
    }
    
    const baseDescription = cuisineDescriptions[cuisine as keyof typeof cuisineDescriptions] || 'A delicious homemade dish'
    const skillDescription = skillLevel === 'beginner' ? 'Perfect for beginners' : 
                           skillLevel === 'intermediate' ? 'Great for home cooks' : 
                           'For experienced cooks'
    
    return `${baseDescription} featuring ${primaryIngredient}. ${skillDescription} with simple techniques and fresh flavors.`
  }

  /**
   * Determine meal type based on cravings and ingredients
   */
  private determineMealType(cravings: string[], anchors: PantryItem[]): string {
    if (cravings.some(c => ['breakfast', 'morning'].includes(c.toLowerCase()))) {
      return 'breakfast'
    }
    if (cravings.some(c => ['lunch', 'light'].includes(c.toLowerCase()))) {
      return 'lunch'
    }
    if (cravings.some(c => ['dinner', 'hearty'].includes(c.toLowerCase()))) {
      return 'dinner'
    }
    
    // Default based on ingredients
    const primaryIngredient = anchors[0]?.name.toLowerCase() || ''
    if (['eggs', 'bacon', 'pancakes'].some(item => primaryIngredient.includes(item))) {
      return 'breakfast'
    }
    if (['salad', 'soup', 'sandwich'].some(item => primaryIngredient.includes(item))) {
      return 'lunch'
    }
    
    return 'dinner'
  }

  /**
   * Calculate prep time based on skill level and ingredient count
   */
  private calculatePrepTime(skillLevel: string, ingredientCount: number): number {
    const baseTime = 10
    const skillMultiplier = skillLevel === 'beginner' ? 1.5 : skillLevel === 'intermediate' ? 1.2 : 1.0
    const ingredientTime = ingredientCount * 2
    
    return Math.min(Math.round((baseTime + ingredientTime) * skillMultiplier), 30)
  }

  /**
   * Calculate cook time based on time limit and skill level
   */
  private calculateCookTime(timeLimit: number, skillLevel: string): number {
    const maxCookTime = timeLimit - 10 // Leave 10 minutes for prep
    const skillMultiplier = skillLevel === 'beginner' ? 0.8 : skillLevel === 'intermediate' ? 1.0 : 1.2
    
    return Math.min(Math.round(maxCookTime * skillMultiplier), 45)
  }

  /**
   * Format ingredients for recipe
   */
  private formatIngredients(ingredients: PantryItem[], servings: number): Array<{
    name: string
    quantity: string
    unit: string
    in_pantry: boolean
  }> {
    return ingredients.map(ingredient => ({
      name: ingredient.name,
      quantity: this.calculateQuantity(ingredient, servings),
      unit: ingredient.unit,
      in_pantry: true
    }))
  }

  /**
   * Calculate ingredient quantity based on servings
   */
  private calculateQuantity(ingredient: PantryItem, servings: number): string {
    const baseQuantity = parseFloat(ingredient.qty) || 1
    const scaledQuantity = (baseQuantity * servings / 2).toFixed(1) // Scale from 2 servings
    return scaledQuantity
  }

  /**
   * Generate cooking instructions
   */
  private generateInstructions(
    anchors: PantryItem[],
    supporting: PantryItem[],
    cuisine: string,
    skillLevel: string
  ): Array<{ step: number; description: string }> {
    
    const instructions = []
    let step = 1

    // Prep ingredients
    instructions.push({
      step: step++,
      description: `Prepare all ingredients: chop ${anchors[0]?.name || 'main ingredient'} and gather ${supporting.map(s => s.name).join(', ')}.`
    })

    // Cooking technique based on cuisine
    const techniques = this.CUISINE_SIGNATURES[cuisine as keyof typeof this.CUISINE_SIGNATURES]?.techniques || ['sauté', 'simmer']
    const primaryTechnique = techniques[0]

    if (primaryTechnique === 'sauté') {
      instructions.push({
        step: step++,
        description: `Heat oil in a large pan over medium heat. Add aromatics and cook until fragrant, about 2-3 minutes.`
      })
      instructions.push({
        step: step++,
        description: `Add ${anchors[0]?.name || 'main ingredient'} and cook until golden and tender, about 5-7 minutes.`
      })
    } else if (primaryTechnique === 'simmer') {
      instructions.push({
        step: step++,
        description: `Combine all ingredients in a large pot. Bring to a boil, then reduce heat and simmer for 15-20 minutes.`
      })
    }

    // Final touches
    instructions.push({
      step: step++,
      description: `Season with salt and pepper to taste. Serve hot and enjoy!`
    })

    return instructions
  }

  /**
   * Calculate nutrition information
   */
  private calculateNutrition(ingredients: PantryItem[], servings: number): {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sodium: number
  } {
    // Simplified nutrition calculation
    const baseCalories = ingredients.length * 50
    const baseProtein = ingredients.filter(i => this.isProtein(i.name)).length * 8
    const baseCarbs = ingredients.filter(i => this.isStarch(i.name)).length * 15
    const baseFat = ingredients.filter(i => this.isFat(i.name)).length * 9

    return {
      calories: Math.round(baseCalories / servings),
      protein: Math.round(baseProtein / servings),
      carbs: Math.round(baseCarbs / servings),
      fat: Math.round(baseFat / servings),
      fiber: Math.round(ingredients.length * 2 / servings),
      sodium: Math.round(ingredients.length * 50 / servings)
    }
  }

  /**
   * Determine appliances needed
   */
  private determineAppliances(availableAppliances: string[], cuisine: string): string[] {
    const appliances = ['stovetop'] // Always need stovetop
    
    if (availableAppliances.includes('oven')) {
      appliances.push('oven')
    }
    if (availableAppliances.includes('blender') && cuisine === 'mexican') {
      appliances.push('blender')
    }
    
    return appliances
  }

  /**
   * Generate recipe tags
   */
  private generateTags(anchors: PantryItem[], cuisine: string, diet: string): string[] {
    const tags = [cuisine, diet]
    
    if (anchors.some(a => this.isProtein(a.name))) {
      tags.push('protein-rich')
    }
    if (anchors.some(a => this.isVegetable(a.name))) {
      tags.push('vegetable-forward')
    }
    
    return tags
  }

  /**
   * Generate unique hash for recipe
   */
  private generateHash(anchors: PantryItem[], supporting: PantryItem[], cuisine: string): string {
    const ingredientNames = [...anchors, ...supporting].map(i => i.name).sort()
    const hashInput = `${cuisine}-${ingredientNames.join('-')}`
    
    // Simple hash function
    let hash = 0
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    
    return Math.abs(hash).toString(36)
  }

  // Helper methods for ingredient classification
  private isProtein(name: string): boolean {
    const proteins = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tofu', 'tempeh', 'beans', 'lentils', 'eggs']
    return proteins.some(protein => name.toLowerCase().includes(protein))
  }

  private isVegetable(name: string): boolean {
    const vegetables = ['onion', 'garlic', 'tomato', 'pepper', 'carrot', 'celery', 'spinach', 'broccoli', 'mushroom']
    return vegetables.some(vegetable => name.toLowerCase().includes(vegetable))
  }

  private isStarch(name: string): boolean {
    const starches = ['rice', 'pasta', 'potato', 'bread', 'quinoa', 'barley', 'oats']
    return starches.some(starch => name.toLowerCase().includes(starch))
  }

  private isFat(name: string): boolean {
    const fats = ['oil', 'butter', 'avocado', 'nuts', 'cheese']
    return fats.some(fat => name.toLowerCase().includes(fat))
  }

  private isAllowedForDiet(ingredient: string, diet: string): boolean {
    const rules = this.DIETARY_RULES[diet as keyof typeof this.DIETARY_RULES]
    if (!rules) return true
    
    return !rules.forbidden.some((forbidden: string) => 
      ingredient.toLowerCase().includes(forbidden.toLowerCase())
    )
  }

  /**
   * Create simple fallback recipes when normal generation fails
   */
  private createFallbackRecipes(ingredients: PantryItem[], request: RecipeGenerationRequest): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    // Create simple recipes using available ingredients
    for (let i = 0; i < Math.min(request.max_results, 5); i++) {
      const primaryIngredient = ingredients[i % ingredients.length]
      
      const recipe: GeneratedRecipe = {
        title: `${this.getCookingMethod(i)} ${primaryIngredient.name} with ${this.getAccompaniment(i)}`,
        description: `A ${this.getCookingMethod(i).toLowerCase()} ${primaryIngredient.name} dish with ${this.getAccompaniment(i).toLowerCase()}. Perfect for a quick and satisfying meal using what you have on hand.`,
        meal_type: 'dinner',
        cuisine_type: 'mediterranean',
        prep_time: 10,
        cook_time: 15,
        servings: request.servings,
        difficulty: 'beginner',
        ingredients: this.createIngredientList(ingredients, request.servings, i),
        instructions: this.createInstructions(ingredients, i),
        nutrition: {
          calories: 200,
          protein: 8,
          carbs: 25,
          fat: 6,
          fiber: 4,
          sodium: 300
        },
        appliances_used: ['stovetop'],
        skill_level_required: 'beginner',
        tags: ['simple', 'quick', 'pantry-friendly'],
        hash: this.generateHash([primaryIngredient], [], 'simple')
      }
      
      recipes.push(recipe)
    }
    
    return recipes
  }

  /**
   * Get cooking method for recipe variety
   */
  private getCookingMethod(index: number): string {
    const methods = ['Sautéed', 'Roasted', 'Grilled', 'Braised', 'Steamed', 'Stir-Fried', 'Baked', 'Pan-Seared']
    return methods[index % methods.length]
  }

  /**
   * Get accompaniment for recipe variety
   */
  private getAccompaniment(index: number): string {
    const accompaniments = ['Herbs', 'Spices', 'Garlic', 'Onions', 'Lemon', 'Olive Oil', 'Seasonings', 'Aromatics']
    return accompaniments[index % accompaniments.length]
  }

  /**
   * Create diverse ingredient list using multiple pantry items
   */
  private createIngredientList(ingredients: PantryItem[], servings: number, recipeIndex: number): Array<{
    name: string
    quantity: string
    unit: string
    in_pantry: boolean
  }> {
    const ingredientList = []
    
    // Use 2-4 ingredients per recipe for variety
    const numIngredients = Math.min(2 + (recipeIndex % 3), ingredients.length)
    
    for (let i = 0; i < numIngredients; i++) {
      const ingredient = ingredients[i % ingredients.length]
      ingredientList.push({
        name: ingredient.name,
        quantity: this.calculateQuantity(ingredient, servings),
        unit: ingredient.unit,
        in_pantry: true
      })
    }
    
    return ingredientList
  }

  /**
   * Create diverse cooking instructions
   */
  private createInstructions(ingredients: PantryItem[], recipeIndex: number): Array<{
    step: number
    description: string
  }> {
    const primaryIngredient = ingredients[recipeIndex % ingredients.length]
    const secondaryIngredient = ingredients[(recipeIndex + 1) % ingredients.length]
    const cookingMethod = this.getCookingMethod(recipeIndex).toLowerCase()
    
    return [
      {
        step: 1,
        description: `Prepare ${primaryIngredient.name} by washing and cutting as needed. If using ${secondaryIngredient.name}, prepare it as well.`
      },
      {
        step: 2,
        description: `Heat a pan over medium heat and add a small amount of oil or butter.`
      },
      {
        step: 3,
        description: `${this.getCookingMethod(recipeIndex)} ${primaryIngredient.name} until tender and golden, about 10-15 minutes. Add ${secondaryIngredient.name} halfway through cooking.`
      },
      {
        step: 4,
        description: `Season with salt, pepper, and ${this.getAccompaniment(recipeIndex).toLowerCase()} to taste. Serve hot and enjoy!`
      }
    ]
  }
}

export const advancedRecipeGenerator = new AdvancedRecipeGenerator()
