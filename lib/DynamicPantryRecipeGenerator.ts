// Dynamic Pantry Recipe Generator
// Creates recipes using ACTUAL ingredients from the user's pantry

interface PantryItem {
  name: string
  quantity: number
  unit: string
  category: string
}

interface GeneratedRecipe {
  title: string
  description: string
  mealType: string
  cuisine: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  prepTime: number
  cookTime: number
  baseIngredients: string[]
  optionalIngredients: string[]
  instructions: string[]
  tags: string[]
  calories: number
  protein: number
  carbs: number
  fat: number
}

class DynamicPantryRecipeGenerator {
  private static instance: DynamicPantryRecipeGenerator

  static getInstance(): DynamicPantryRecipeGenerator {
    if (!DynamicPantryRecipeGenerator.instance) {
      DynamicPantryRecipeGenerator.instance = new DynamicPantryRecipeGenerator()
    }
    return DynamicPantryRecipeGenerator.instance
  }

  /**
   * Generate recipes using ACTUAL pantry ingredients
   */
  async generateRecipesFromPantry(pantryItems: PantryItem[], options: {
    allergies?: string[]
    dietaryPreferences?: string[]
    householdSize?: number
    count?: number
  } = {}): Promise<GeneratedRecipe[]> {
    const { allergies = [], dietaryPreferences = [], householdSize = 2, count = 8 } = options

    if (__DEV__) console.log('🍳 DynamicPantryRecipeGenerator: Creating recipes from', pantryItems.length, 'pantry items')

    if (!pantryItems || pantryItems.length === 0) {
      if (__DEV__) console.warn('No pantry items provided')
      return []
    }

    // Filter out allergens and dietary restrictions
    const safeItems = this.filterSafeIngredients(pantryItems, allergies, dietaryPreferences)
    if (__DEV__) console.log('✅ Safe ingredients count:', safeItems.length)

    if (safeItems.length === 0) {
      if (__DEV__) console.warn('No safe ingredients after filtering')
      return []
    }

    // Generate recipes using actual pantry ingredients
    const recipes: GeneratedRecipe[] = []

    // Strategy 1: Protein + Starch + Vegetable combinations
    const proteinRecipes = this.generateProteinBasedRecipes(safeItems, householdSize)
    recipes.push(...proteinRecipes)

    // Strategy 2: Pasta/Grain + Sauce combinations
    const grainRecipes = this.generateGrainBasedRecipes(safeItems, householdSize)
    recipes.push(...grainRecipes)

    // Strategy 3: Vegetable-focused recipes
    const veggieRecipes = this.generateVegetableRecipes(safeItems, householdSize)
    recipes.push(...veggieRecipes)

    // Strategy 4: Simple combinations
    const simpleRecipes = this.generateSimpleCombinations(safeItems, householdSize)
    recipes.push(...simpleRecipes)

    // Remove duplicates and limit count
    const uniqueRecipes = this.removeDuplicateRecipes(recipes)
    const finalRecipes = uniqueRecipes.slice(0, count)

    if (__DEV__) console.log(`✨ Generated ${finalRecipes.length} recipes using actual pantry ingredients`)

    return finalRecipes
  }

  /**
   * Filter ingredients based on allergies and dietary preferences
   */
  private filterSafeIngredients(
    items: PantryItem[], 
    allergies: string[], 
    dietaryPreferences: string[]
  ): PantryItem[] {
    return items.filter(item => {
      const name = item.name.toLowerCase()
      
      // Check allergies
      for (const allergy of allergies) {
        const allergyLower = allergy.toLowerCase()
        if (name.includes(allergyLower)) {
          return false
        }
      }

      // Check dietary preferences
      if (dietaryPreferences.includes('vegetarian') || dietaryPreferences.includes('vegan')) {
        const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'turkey', 'meat', 'bacon', 'ham']
        if (meatKeywords.some(meat => name.includes(meat))) {
          return false
        }
      }

      if (dietaryPreferences.includes('vegan')) {
        const dairyKeywords = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'sour cream', 'whey', 'casein']
        if (dairyKeywords.some(dairy => name.includes(dairy))) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Generate protein-based recipes
   */
  private generateProteinBasedRecipes(items: PantryItem[], householdSize: number): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    // Find proteins
    const proteins = items.filter(item => this.isProtein(item.name))
    const starches = items.filter(item => this.isStarch(item.name))
    const vegetables = items.filter(item => this.isVegetable(item.name))
    const seasonings = items.filter(item => this.isSeasoning(item.name))

    for (const protein of proteins) {
      // Find complementary ingredients
      const starch = starches[0] // Use first available starch
      const veggie = vegetables[0] // Use first available vegetable
      const seasoning = seasonings[0] // Use first available seasoning

      if (starch && veggie) {
        const recipe = this.createProteinRecipe(protein, starch, veggie, seasoning, householdSize)
        recipes.push(recipe)
      }
    }

    return recipes
  }

  /**
   * Generate grain/pasta-based recipes
   */
  private generateGrainBasedRecipes(items: PantryItem[], householdSize: number): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    const grains = items.filter(item => this.isStarch(item.name))
    const vegetables = items.filter(item => this.isVegetable(item.name))
    const seasonings = items.filter(item => this.isSeasoning(item.name))
    const proteins = items.filter(item => this.isProtein(item.name))

    for (const grain of grains) {
      const veggie = vegetables[0]
      const seasoning = seasonings[0]
      const protein = proteins[0]

      if (veggie) {
        const recipe = this.createGrainRecipe(grain, veggie, seasoning, protein, householdSize)
        recipes.push(recipe)
      }
    }

    return recipes
  }

  /**
   * Generate vegetable-focused recipes
   */
  private generateVegetableRecipes(items: PantryItem[], householdSize: number): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    const vegetables = items.filter(item => this.isVegetable(item.name))
    const seasonings = items.filter(item => this.isSeasoning(item.name))
    const grains = items.filter(item => this.isStarch(item.name))

    if (vegetables.length >= 2) {
      const mainVeggie = vegetables[0]
      const secondaryVeggie = vegetables[1]
      const seasoning = seasonings[0]
      const grain = grains[0]

      const recipe = this.createVegetableRecipe(mainVeggie, secondaryVeggie, seasoning, grain, householdSize)
      recipes.push(recipe)
    }

    return recipes
  }

  /**
   * Generate simple combinations
   */
  private generateSimpleCombinations(items: PantryItem[], householdSize: number): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    // Create simple recipes with 2-3 ingredients
    for (let i = 0; i < Math.min(3, items.length - 1); i++) {
      const mainIngredient = items[i]
      const secondaryIngredient = items[i + 1]
      
      if (mainIngredient && secondaryIngredient) {
        const recipe = this.createSimpleRecipe(mainIngredient, secondaryIngredient, householdSize)
        recipes.push(recipe)
      }
    }

    return recipes
  }

  /**
   * Create a protein-based recipe
   */
  private createProteinRecipe(
    protein: PantryItem, 
    starch: PantryItem, 
    vegetable: PantryItem, 
    seasoning: PantryItem | undefined,
    householdSize: number
  ): GeneratedRecipe {
    const proteinName = protein.name.toLowerCase()
    const starchName = starch.name.toLowerCase()
    const veggieName = vegetable.name.toLowerCase()
    
    let title = ''
    let cuisine = 'American'
    let cookingMethod = 'sautéed'
    
    // Determine cooking method and cuisine based on ingredients
    if (proteinName.includes('chicken')) {
      cookingMethod = 'sautéed'
      cuisine = 'American'
    } else if (proteinName.includes('beef')) {
      cookingMethod = 'pan-seared'
      cuisine = 'American'
    } else if (proteinName.includes('fish') || proteinName.includes('salmon')) {
      cookingMethod = 'pan-seared'
      cuisine = 'Mediterranean'
    }

    // Create title
    if (starchName.includes('rice')) {
      title = `${this.capitalize(cookingMethod)} ${this.capitalize(protein.name)} with ${this.capitalize(vegetable.name)} Rice`
    } else if (starchName.includes('pasta')) {
      title = `${this.capitalize(protein.name)} and ${this.capitalize(vegetable.name)} Pasta`
    } else {
      title = `${this.capitalize(cookingMethod)} ${this.capitalize(protein.name)} with ${this.capitalize(starch.name)} and ${this.capitalize(vegetable.name)}`
    }

    const ingredients = [protein.name, starch.name, vegetable.name]
    if (seasoning) ingredients.push(seasoning.name)

    const instructions = this.generateProteinInstructions(protein, starch, vegetable, seasoning, cookingMethod)

    return {
      title,
      description: `A delicious ${cuisine.toLowerCase()} dish featuring ${protein.name} with ${starch.name} and ${vegetable.name}.`,
      mealType: 'dinner',
      cuisine,
      difficulty: 'Easy',
      prepTime: 10,
      cookTime: 20,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: [cuisine.toLowerCase(), protein.name.toLowerCase(), 'quick', 'healthy'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  /**
   * Create a grain-based recipe
   */
  private createGrainRecipe(
    grain: PantryItem,
    vegetable: PantryItem,
    seasoning: PantryItem | undefined,
    protein: PantryItem | undefined,
    householdSize: number
  ): GeneratedRecipe {
    const grainName = grain.name.toLowerCase()
    const veggieName = vegetable.name.toLowerCase()
    
    let title = ''
    let cuisine = 'American'
    
    if (grainName.includes('pasta')) {
      title = `${this.capitalize(vegetable.name)} Pasta`
      cuisine = 'Italian'
    } else if (grainName.includes('rice')) {
      title = `${this.capitalize(vegetable.name)} Fried Rice`
      cuisine = 'Asian'
    } else {
      title = `${this.capitalize(grain.name)} with ${this.capitalize(vegetable.name)}`
    }

    const ingredients = [grain.name, vegetable.name]
    if (seasoning) ingredients.push(seasoning.name)
    if (protein) ingredients.push(protein.name)

    const instructions = this.generateGrainInstructions(grain, vegetable, seasoning, protein)

    return {
      title,
      description: `A simple and satisfying ${cuisine.toLowerCase()} dish using ${grain.name} and ${vegetable.name}.`,
      mealType: 'dinner',
      cuisine,
      difficulty: 'Easy',
      prepTime: 5,
      cookTime: 15,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: [cuisine.toLowerCase(), grain.name.toLowerCase(), 'simple', 'quick'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  /**
   * Create a vegetable-focused recipe
   */
  private createVegetableRecipe(
    mainVeggie: PantryItem,
    secondaryVeggie: PantryItem,
    seasoning: PantryItem | undefined,
    grain: PantryItem | undefined,
    householdSize: number
  ): GeneratedRecipe {
    const title = `Roasted ${this.capitalize(mainVeggie.name)} and ${this.capitalize(secondaryVeggie.name)}`
    
    const ingredients = [mainVeggie.name, secondaryVeggie.name]
    if (seasoning) ingredients.push(seasoning.name)
    if (grain) ingredients.push(grain.name)

    const instructions = this.generateVegetableInstructions(mainVeggie, secondaryVeggie, seasoning, grain)

    return {
      title,
      description: `A healthy and colorful dish featuring roasted ${mainVeggie.name} and ${secondaryVeggie.name}.`,
      mealType: 'dinner',
      cuisine: 'Mediterranean',
      difficulty: 'Easy',
      prepTime: 10,
      cookTime: 25,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: ['vegetarian', 'healthy', 'roasted', 'colorful'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  /**
   * Create a simple 2-ingredient recipe
   */
  private createSimpleRecipe(
    mainIngredient: PantryItem,
    secondaryIngredient: PantryItem,
    householdSize: number
  ): GeneratedRecipe {
    const title = `Simple ${this.capitalize(mainIngredient.name)} with ${this.capitalize(secondaryIngredient.name)}`
    
    const ingredients = [mainIngredient.name, secondaryIngredient.name]
    const instructions = this.generateSimpleInstructions(mainIngredient, secondaryIngredient)

    return {
      title,
      description: `A quick and easy dish combining ${mainIngredient.name} and ${secondaryIngredient.name}.`,
      mealType: 'dinner',
      cuisine: 'American',
      difficulty: 'Easy',
      prepTime: 5,
      cookTime: 10,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: ['simple', 'quick', 'easy'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  /**
   * Generate cooking instructions for protein recipes
   */
  private generateProteinInstructions(
    protein: PantryItem,
    starch: PantryItem,
    vegetable: PantryItem,
    seasoning: PantryItem | undefined,
    cookingMethod: string
  ): string[] {
    const instructions = []
    
    instructions.push(`Season ${protein.name} with salt and pepper.`)
    
    if (cookingMethod === 'sautéed') {
      instructions.push(`Heat oil in a large pan over medium-high heat.`)
      instructions.push(`Sauté ${protein.name} until golden and cooked through, about 6-8 minutes.`)
    } else if (cookingMethod === 'pan-seared') {
      instructions.push(`Heat oil in a large pan over high heat.`)
      instructions.push(`Sear ${protein.name} for 3-4 minutes per side until golden.`)
    }
    
    instructions.push(`Remove ${protein.name} and set aside.`)
    instructions.push(`In the same pan, cook ${vegetable.name} until tender, about 5 minutes.`)
    
    if (starch.name.toLowerCase().includes('rice')) {
      instructions.push(`Add cooked rice and stir to combine.`)
    } else if (starch.name.toLowerCase().includes('pasta')) {
      instructions.push(`Add cooked pasta and toss to combine.`)
    }
    
    if (seasoning) {
      instructions.push(`Season with ${seasoning.name} and stir to combine.`)
    }
    
    instructions.push(`Return ${protein.name} to the pan and serve hot.`)
    
    return instructions
  }

  /**
   * Generate cooking instructions for grain recipes
   */
  private generateGrainInstructions(
    grain: PantryItem,
    vegetable: PantryItem,
    seasoning: PantryItem | undefined,
    protein: PantryItem | undefined
  ): string[] {
    const instructions = []
    
    if (grain.name.toLowerCase().includes('pasta')) {
      instructions.push(`Cook pasta according to package directions.`)
      instructions.push(`Meanwhile, heat oil in a large pan over medium heat.`)
      instructions.push(`Sauté ${vegetable.name} until tender, about 5-7 minutes.`)
      instructions.push(`Add cooked pasta to the pan and toss to combine.`)
    } else if (grain.name.toLowerCase().includes('rice')) {
      instructions.push(`Heat oil in a large pan or wok over high heat.`)
      instructions.push(`Add ${vegetable.name} and stir-fry for 3-4 minutes.`)
      instructions.push(`Add cooked rice and stir-fry for 2-3 minutes.`)
    }
    
    if (protein) {
      instructions.push(`Add ${protein.name} and cook until heated through.`)
    }
    
    if (seasoning) {
      instructions.push(`Season with ${seasoning.name} and stir to combine.`)
    }
    
    instructions.push(`Serve hot and enjoy!`)
    
    return instructions
  }

  /**
   * Generate cooking instructions for vegetable recipes
   */
  private generateVegetableInstructions(
    mainVeggie: PantryItem,
    secondaryVeggie: PantryItem,
    seasoning: PantryItem | undefined,
    grain: PantryItem | undefined
  ): string[] {
    const instructions = []
    
    instructions.push(`Preheat oven to 425°F.`)
    instructions.push(`Cut ${mainVeggie.name} and ${secondaryVeggie.name} into bite-sized pieces.`)
    instructions.push(`Toss vegetables with olive oil, salt, and pepper.`)
    instructions.push(`Spread on a baking sheet and roast for 20-25 minutes until tender and golden.`)
    
    if (seasoning) {
      instructions.push(`Remove from oven and sprinkle with ${seasoning.name}.`)
    }
    
    if (grain) {
      instructions.push(`Serve over ${grain.name} if desired.`)
    }
    
    instructions.push(`Enjoy your healthy roasted vegetables!`)
    
    return instructions
  }

  /**
   * Generate simple cooking instructions
   */
  private generateSimpleInstructions(
    mainIngredient: PantryItem,
    secondaryIngredient: PantryItem
  ): string[] {
    const instructions = []
    
    instructions.push(`Heat oil in a pan over medium heat.`)
    instructions.push(`Add ${mainIngredient.name} and cook until tender.`)
    instructions.push(`Add ${secondaryIngredient.name} and cook for 2-3 minutes more.`)
    instructions.push(`Season with salt and pepper to taste.`)
    instructions.push(`Serve hot and enjoy!`)
    
    return instructions
  }

  /**
   * Remove duplicate recipes
   */
  private removeDuplicateRecipes(recipes: GeneratedRecipe[]): GeneratedRecipe[] {
    const seen = new Set<string>()
    return recipes.filter(recipe => {
      const key = recipe.title.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  // Helper methods for ingredient classification
  private isProtein(name: string): boolean {
    const proteins = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tofu', 'tempeh', 'beans', 'lentils', 'eggs', 'turkey', 'lamb']
    return proteins.some(protein => name.toLowerCase().includes(protein))
  }

  private isStarch(name: string): boolean {
    const starches = ['rice', 'pasta', 'spaghetti', 'potato', 'bread', 'quinoa', 'barley', 'oats', 'noodles', 'couscous']
    return starches.some(starch => name.toLowerCase().includes(starch))
  }

  private isVegetable(name: string): boolean {
    const vegetables = ['onion', 'garlic', 'tomato', 'pepper', 'carrot', 'celery', 'spinach', 'broccoli', 'mushroom', 'zucchini', 'eggplant', 'squash', 'lettuce', 'kale', 'cabbage', 'arugula', 'cucumber', 'avocado']
    return vegetables.some(vegetable => name.toLowerCase().includes(vegetable))
  }

  private isSeasoning(name: string): boolean {
    const seasonings = ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme', 'rosemary', 'garlic powder', 'onion powder', 'chili powder', 'cayenne', 'ginger', 'cilantro', 'parsley']
    return seasonings.some(seasoning => name.toLowerCase().includes(seasoning))
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  // Simple nutrition calculations
  private calculateCalories(ingredients: string[], householdSize: number): number {
    const baseCalories = ingredients.length * 80
    return Math.round(baseCalories / householdSize)
  }

  private calculateProtein(ingredients: string[], householdSize: number): number {
    const proteinCount = ingredients.filter(ing => this.isProtein(ing)).length
    const baseProtein = proteinCount * 15 + (ingredients.length - proteinCount) * 3
    return Math.round(baseProtein / householdSize)
  }

  private calculateCarbs(ingredients: string[], householdSize: number): number {
    const carbCount = ingredients.filter(ing => this.isStarch(ing)).length
    const baseCarbs = carbCount * 20 + (ingredients.length - carbCount) * 5
    return Math.round(baseCarbs / householdSize)
  }

  private calculateFat(ingredients: string[], householdSize: number): number {
    const baseFat = ingredients.length * 8
    return Math.round(baseFat / householdSize)
  }
}

export const dynamicPantryRecipeGenerator = DynamicPantryRecipeGenerator.getInstance()
