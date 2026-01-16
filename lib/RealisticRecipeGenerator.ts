// Realistic Recipe Generator
// Creates proper, cookable recipes that people would actually want to eat

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

class RealisticRecipeGenerator {
  private static instance: RealisticRecipeGenerator
  private generationCounter = 0 // Track generation count for variety

  static getInstance(): RealisticRecipeGenerator {
    if (!RealisticRecipeGenerator.instance) {
      RealisticRecipeGenerator.instance = new RealisticRecipeGenerator()
    }
    return RealisticRecipeGenerator.instance
  }
  
  /**
   * Reset generator state to force fresh recipes
   */
  reset(): void {
    this.generationCounter++
    console.log(`🔄 Recipe generator reset - generation #${this.generationCounter}`)
  }

  /**
   * Generate realistic recipes using pantry ingredients
   */
  async generateRecipesFromPantry(pantryItems: PantryItem[], options: {
    allergies?: string[]
    dietaryPreferences?: string[]
    householdSize?: number
    count?: number
  } = {}): Promise<GeneratedRecipe[]> {
    const { allergies = [], dietaryPreferences = [], householdSize = 2, count = 8 } = options

    console.log('🍳 RealisticRecipeGenerator: Creating proper recipes from pantry items')
    console.log('📦 Pantry items:', pantryItems.map(item => `${item.name} (${item.quantity} ${item.unit})`))

    if (!pantryItems || pantryItems.length === 0) {
      console.warn('No pantry items provided')
      return []
    }

    // Filter out allergens and dietary restrictions
    const safeItems = this.filterSafeIngredients(pantryItems, allergies, dietaryPreferences)
    console.log('✅ Safe ingredients:', safeItems.map(item => item.name))

    if (safeItems.length === 0) {
      console.warn('No safe ingredients after filtering')
      return []
    }

    // Generate realistic recipes using proven combinations
    // Track used ingredients to ensure variety
    const usedIngredients = new Set<string>()
    const recipes: GeneratedRecipe[] = []

    // VARIETY: Shuffle strategies to generate different recipes each time
    const strategies = [
      () => this.generateClassicRecipes(safeItems, householdSize, usedIngredients),
      () => this.generatePastaRecipes(safeItems, householdSize, usedIngredients),
      () => this.generateRiceRecipes(safeItems, householdSize, usedIngredients),
      () => this.generateStirFryRecipes(safeItems, householdSize, usedIngredients),
      () => this.generateSoupRecipes(safeItems, householdSize, usedIngredients),
      () => this.generateSaladRecipes(safeItems, householdSize, usedIngredients),
      () => this.generateMapleGlazeRecipes(safeItems, householdSize, usedIngredients),
      () => this.generateDessertRecipes(safeItems, householdSize, usedIngredients),
      () => this.generateComplexRecipes(safeItems, householdSize, usedIngredients)
    ]
    
    // Shuffle strategies for variety
    const shuffledStrategies = this.shuffleArray([...strategies])
    
    for (const strategy of shuffledStrategies) {
      const strategyRecipes = strategy()
      console.log(`📝 Strategy generated ${strategyRecipes.length} recipes`)
      if (strategyRecipes.length > 0) {
        console.log(`   Recipe titles: ${strategyRecipes.map(r => r.title).join(', ')}`)
      }
      recipes.push(...strategyRecipes)
      
      // Stop if we have enough recipes
      if (recipes.length >= count * 2) {
        break
      }
    }
    
    console.log(`📊 Total recipes generated: ${recipes.length}`)

    // Remove duplicates and recipes with too similar ingredient combinations
    const uniqueRecipes = this.removeDuplicateRecipes(recipes)
    const diverseRecipes = this.ensureRecipeDiversity(uniqueRecipes)

    // VARIETY: Shuffle final recipes so order changes each time
    const shuffledRecipes = this.shuffleArray(diverseRecipes)

    // Limit to requested count
    const finalRecipes = shuffledRecipes.slice(0, count)

    console.log(`✨ Generated ${finalRecipes.length} realistic recipes`)
    console.log('📋 Recipe titles:', finalRecipes.map(r => r.title))

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
      
      // CRITICAL: Filter out invalid/processed ingredients that shouldn't be used in recipes
      if (this.isInvalidIngredient(name)) {
        console.log(`🚫 Filtered out invalid ingredient: ${item.name}`)
        return false
      }
      
      // Check allergies
      for (const allergy of allergies) {
        const allergyLower = allergy.toLowerCase()
        if (name.includes(allergyLower)) {
          return false
        }
      }

      // Check dietary preferences
      if (dietaryPreferences.includes('vegetarian') || dietaryPreferences.includes('vegan')) {
        const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tofu', 'tempeh', 'beans', 'lentils', 'eggs', 'turkey', 'lamb']
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
   * Check if an ingredient is invalid (snacks, processed foods, etc.)
   * These should NEVER be used in actual recipes
   */
  private isInvalidIngredient(name: string): boolean {
    const invalidKeywords = [
      // Snack foods / processed
      'stick', 'sticks', 'jerky', 'crackers', 'chips', 'crisps', 'snack',
      'original', 'flavor', 'flavored', 'variety pack',
      // Non-cooking items
      'cleaning', 'detergent', 'soap', 'shampoo', 'conditioner',
      // Ready-to-eat that shouldn't be cooked
      'candy', 'gum', 'mint', 'breath', 'refresh'
    ]
    
    // Check for invalid keywords
    for (const keyword of invalidKeywords) {
      if (name.includes(keyword)) {
        return true
      }
    }
    
    // Specific invalid patterns
    // "beef sticks", "chicken sticks", etc. - these are snacks, not cooking ingredients
    if ((name.includes('beef') || name.includes('chicken') || name.includes('turkey') || name.includes('pork')) && 
        name.includes('stick')) {
      return true
    }
    
    return false
  }

  /**
   * Generate classic protein + starch + vegetable recipes
   * Uses MORE ingredients to create truly unique recipes
   */
  private generateClassicRecipes(items: PantryItem[], householdSize: number, usedIngredients: Set<string>): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    // VARIETY: Shuffle ingredients to get different combinations each time
    const proteins = this.shuffleArray(items.filter(item => this.isProtein(item.name) && !usedIngredients.has(item.name.toLowerCase())))
    const starches = this.shuffleArray(items.filter(item => this.isStarch(item.name)))
    const vegetables = this.shuffleArray(items.filter(item => this.isVegetable(item.name)))
    const seasonings = this.shuffleArray(items.filter(item => this.isSeasoning(item.name)))

    // DEBUG: Log what we found
    console.log(`🔍 Classic recipes: ${proteins.length} proteins, ${starches.length} starches, ${vegetables.length} vegetables, ${seasonings.length} seasonings`)
    console.log(`   Proteins: ${proteins.map(p => p.name).join(', ')}`)
    console.log(`   Starches: ${starches.map(s => s.name).join(', ')}`)
    console.log(`   Vegetables: ${vegetables.map(v => v.name).join(', ')}`)
    console.log(`   Seasonings: ${seasonings.map(s => s.name).join(', ')}`)

    // Only create recipes if we have the right combinations
    const maxRecipes = 2
    let recipeCount = 0
    
    for (const protein of proteins) {
      if (recipeCount >= maxRecipes) break
      
      // Skip if this protein was already used
      if (usedIngredients.has(protein.name.toLowerCase())) continue
      
      // Use MULTIPLE vegetables and seasonings for variety
      const availableVeggies = vegetables.filter(v => !usedIngredients.has(v.name.toLowerCase())).slice(0, 3)
      const availableSeasonings = seasonings.filter(s => !usedIngredients.has(s.name.toLowerCase())).slice(0, 2)
      
      // RELAXED: Allow recipes with fewer requirements if we have protein
      // Need at least: protein + (starch OR 2 vegetables) + (1 seasoning OR vegetable)
      const hasStarch = starches.length > 0
      const hasEnoughVeggies = availableVeggies.length >= 2
      const hasSeasoning = availableSeasonings.length >= 1
      const hasMinVeggie = availableVeggies.length >= 1
      
      // Recipe can be: protein + starch + 1 veggie + seasoning
      // OR: protein + 2 veggies + seasoning (no starch needed)
      // OR: protein + starch + 2 veggies (no seasoning needed if we have veggies)
      if ((hasStarch && hasMinVeggie && (hasSeasoning || hasEnoughVeggies)) || 
          (hasEnoughVeggies && (hasSeasoning || hasStarch))) {
        
        for (const starch of starches) {
          if (recipeCount >= maxRecipes) break
          
          // Use available ingredients flexibly
          const veg1 = availableVeggies[0]
          const veg2 = availableVeggies.length > 1 ? availableVeggies[1] : availableVeggies[0]
          const season1 = availableSeasonings.length > 0 ? availableSeasonings[0] : veg1
          const season2 = availableSeasonings.length > 1 ? availableSeasonings[1] : (availableVeggies.length > 1 ? availableVeggies[1] : veg1)
          
          // Use 2-3 vegetables + 2 seasonings + protein + starch = 6-7 ingredients!
          const recipe = this.createClassicRecipe(
            protein, 
            starch, 
            veg1, 
            veg2,
            season1,
            season2,
            householdSize
          )
          
          if (recipe) {
            recipes.push(recipe)
            // Mark ingredients as used
            usedIngredients.add(protein.name.toLowerCase())
            availableVeggies.forEach(v => usedIngredients.add(v.name.toLowerCase()))
            recipeCount++
            break
          }
        }
        
        // If no starch but we have enough veggies, create a veggie-heavy recipe
        if (recipeCount < maxRecipes && !hasStarch && hasEnoughVeggies && hasMinVeggie) {
          // Use a vegetable as "starch" substitute
          const starchSubstitute = availableVeggies[availableVeggies.length - 1]
          const veg1 = availableVeggies[0]
          const veg2 = availableVeggies.length > 1 ? availableVeggies[1] : availableVeggies[0]
          const season1 = availableSeasonings.length > 0 ? availableSeasonings[0] : veg1
          const season2 = availableSeasonings.length > 1 ? availableSeasonings[1] : veg2
          
          const recipe = this.createClassicRecipe(
            protein,
            starchSubstitute,
            veg1,
            veg2,
            season1,
            season2,
            householdSize
          )
          
          if (recipe) {
            recipes.push(recipe)
            usedIngredients.add(protein.name.toLowerCase())
            availableVeggies.forEach(v => usedIngredients.add(v.name.toLowerCase()))
            recipeCount++
          }
        }
      }
    }

    return recipes
  }

  /**
   * Generate maple-forward baked recipes when maple syrup is on hand
   */
  private generateMapleGlazeRecipes(items: PantryItem[], householdSize: number, usedIngredients: Set<string>): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    const maple = items.find(item => item.name.toLowerCase().includes('maple'))
    if (!maple) {
      return recipes
    }

    const butter = items.find(item => item.name.toLowerCase().includes('butter'))
    const sweetPotato = items.find(item => item.name.toLowerCase().includes('sweet potato'))
    const shallot = items.find(item => item.name.toLowerCase().includes('shallot'))
    const parchment = items.find(item => item.name.toLowerCase().includes('parchment'))

    // Maple glazed salmon
    const salmon = items.find(item => this.isProtein(item.name) && item.name.toLowerCase().includes('salmon'))
    if (salmon && sweetPotato) {
      const ingredientList = [
        salmon.name,
        maple.name,
        sweetPotato.name,
        shallot?.name,
        butter?.name,
        'olive oil',
        'salt',
        'black pepper'
      ].filter(Boolean) as string[]

      const instructions = [
        'Preheat oven to 220°C (425°F) and line a large baking sheet with parchment paper if available.',
        `Cut 2-3 ${sweetPotato.name.toLowerCase()} into 1-inch cubes. Toss with 2 tbsp olive oil, salt, and pepper. Arrange on the baking sheet with ${shallot ? `2 sliced ${shallot.name.toLowerCase()}` : '2 sliced shallots'}. Roast for 20 minutes until starting to soften.`,
        `Push the vegetables to the sides and lay 2 ${salmon.name.toLowerCase()} fillets in the center. Brush generously with a glaze made from 3 tbsp ${maple.name.toLowerCase()}${butter ? ` and 2 tbsp melted ${butter.name.toLowerCase()}` : ''}.`,
        'Roast for 10-12 minutes more, until the salmon flakes easily (internal temp 145°F) and the sweet potatoes are caramelized.',
        'Rest for 2 minutes, then serve hot with an extra drizzle of the maple butter glaze.'
      ]

      recipes.push({
        title: 'Maple-Glazed Salmon with Roasted Sweet Potatoes',
        description: `Roasted ${salmon.name.toLowerCase()} with caramelized sweet potatoes and a glossy maple glaze.`,
        mealType: 'dinner',
        cuisine: 'American',
        difficulty: 'Medium',
        prepTime: 10,
        cookTime: 30,
        baseIngredients: ingredientList,
        optionalIngredients: parchment ? [`${parchment.name} (for lining the pan)`] : [],
        instructions,
        tags: ['sheet-pan', 'maple', 'savory-sweet', 'seafood'],
        calories: this.calculateCalories(ingredientList, householdSize),
        protein: this.calculateProtein(ingredientList, householdSize),
        carbs: this.calculateCarbs(ingredientList, householdSize),
        fat: this.calculateFat(ingredientList, householdSize)
      })

      usedIngredients.add(salmon.name.toLowerCase())
      usedIngredients.add(maple.name.toLowerCase())
    }

    // Maple butter chicken
    const chicken = items.find(item => this.isProtein(item.name) && item.name.toLowerCase().includes('chicken'))
    if (chicken) {
      const ingredientList = [
        chicken.name,
        maple.name,
        butter?.name,
        shallot?.name,
        'salt',
        'black pepper'
      ].filter(Boolean) as string[]

      const instructions = [
        'Preheat oven to 200°C (400°F) and line a sheet pan with parchment paper if available.',
        `In a small saucepan melt ${butter ? butter.name.toLowerCase() : 'butter'} with ${maple.name.toLowerCase()} and finely minced ${shallot ? shallot.name.toLowerCase() : 'shallots'}.`,
        `Pat ${chicken.name.toLowerCase()} dry, season with salt and pepper, and brush generously with the maple butter glaze.`,
        'Bake for 35-40 minutes, basting once halfway through, until the skin is deeply caramelized and the meat is cooked through.',
        'Rest 5 minutes before serving with the pan juices.'
      ]

      recipes.push({
        title: 'Maple Butter Roasted Chicken',
        description: `${chicken.name} roasted with a sweet-savory maple butter glaze and aromatic shallots.`,
        mealType: 'dinner',
        cuisine: 'American',
        difficulty: 'Easy',
        prepTime: 10,
        cookTime: 40,
        baseIngredients: ingredientList,
        optionalIngredients: parchment ? [`${parchment.name} (for lining the pan)`] : [],
        instructions,
        tags: ['roasted', 'maple', 'comfort-food'],
        calories: this.calculateCalories(ingredientList, householdSize),
        protein: this.calculateProtein(ingredientList, householdSize),
        carbs: this.calculateCarbs(ingredientList, householdSize),
        fat: this.calculateFat(ingredientList, householdSize)
      })

      usedIngredients.add(chicken.name.toLowerCase())
      usedIngredients.add(maple.name.toLowerCase())
    }

    return recipes
  }

  /**
   * Generate dessert/snack recipes when sweets are available
   */
  private generateDessertRecipes(items: PantryItem[], householdSize: number, usedIngredients: Set<string>): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    const chocolate = items.find(item => item.name.toLowerCase().includes('chocolate'))
    const raspberries = items.find(item => item.name.toLowerCase().includes('raspber'))
    const tofu = items.find(item => item.name.toLowerCase().includes('tofu'))
    const maple = items.find(item => item.name.toLowerCase().includes('maple'))
    const proteinBar = items.find(item => item.name.toLowerCase().includes('protein bar'))
    const brownies = items.find(item => item.name.toLowerCase().includes('brownie'))

    if (chocolate && raspberries) {
      const ingredientList = [
        chocolate.name,
        raspberries.name
      ]

      const instructions = [
        `Line a tray with parchment paper or a silicone mat.`,
        `Melt the ${chocolate.name.toLowerCase()} gently using a double boiler or in the microwave in short bursts.`,
        'Spread the chocolate into an even layer and scatter raspberries over the top.',
        'Chill for 30 minutes until firm, then break into shards and serve.'
      ]

      recipes.push({
        title: 'Dark Chocolate Raspberry Bark',
        description: `Silky melted ${chocolate.name.toLowerCase()} studded with fresh raspberries for a quick dessert.`,
        mealType: 'dessert',
        cuisine: 'American',
        difficulty: 'Easy',
        prepTime: 10,
        cookTime: 5,
        baseIngredients: ingredientList,
        optionalIngredients: ['parchment paper (for lining the tray)'],
        instructions,
        tags: ['dessert', 'no-bake', 'sweet'],
        calories: this.calculateCalories(ingredientList, householdSize),
        protein: this.calculateProtein(ingredientList, householdSize),
        carbs: this.calculateCarbs(ingredientList, householdSize),
        fat: this.calculateFat(ingredientList, householdSize)
      })

      usedIngredients.add(chocolate.name.toLowerCase())
      usedIngredients.add(raspberries.name.toLowerCase())
    }

    if (chocolate && tofu) {
      const ingredientList = [
        chocolate.name,
        tofu.name,
        maple?.name ?? 'maple syrup'
      ].filter(Boolean) as string[]

      const instructions = [
        `Melt the ${chocolate.name.toLowerCase()} and let it cool slightly.`,
        `Blend ${tofu.name.toLowerCase()} with the melted chocolate and ${maple ? maple.name.toLowerCase() : 'maple syrup'} until completely smooth.`,
        'Spoon into glasses and chill for at least 2 hours.',
        `${raspberries ? `Top with ${raspberries.name.toLowerCase()} just before serving.` : 'Serve chilled with fresh fruit if available.'}`
      ]

      recipes.push({
        title: 'Chocolate Tofu Mousse',
        description: `A silky high-protein mousse made with ${tofu.name.toLowerCase()} and rich ${chocolate.name.toLowerCase()}.`,
        mealType: 'dessert',
        cuisine: 'American',
        difficulty: 'Easy',
        prepTime: 15,
        cookTime: 0,
        baseIngredients: ingredientList,
        optionalIngredients: raspberries ? [raspberries.name] : [],
        instructions,
        tags: ['dessert', 'high-protein', 'no-bake'],
        calories: this.calculateCalories(ingredientList, householdSize),
        protein: this.calculateProtein(ingredientList, householdSize),
        carbs: this.calculateCarbs(ingredientList, householdSize),
        fat: this.calculateFat(ingredientList, householdSize)
      })

      usedIngredients.add(tofu.name.toLowerCase())
    }

    if (proteinBar && chocolate && (raspberries || brownies)) {
      const ingredientList = [
        proteinBar.name,
        chocolate.name,
        raspberries?.name,
        brownies?.name
      ].filter(Boolean) as string[]

      const instructions = [
        `Chop the ${proteinBar.name.toLowerCase()} and ${brownies ? brownies.name.toLowerCase() : 'brownies'} into bite-sized pieces.`,
        `${raspberries ? `Layer the bites with ${raspberries.name.toLowerCase()} in glasses or jars.` : 'Layer the bites in small jars.'}`,
        `Drizzle with melted ${chocolate.name.toLowerCase()} and chill for 15 minutes before serving.`
      ]

      recipes.push({
        title: 'Protein Bar Chocolate Parfait',
        description: `Layered parfait with protein bar bites, ${chocolate.name.toLowerCase()}, and fresh toppings.`,
        mealType: 'dessert',
        cuisine: 'American',
        difficulty: 'Easy',
        prepTime: 10,
        cookTime: 0,
        baseIngredients: ingredientList,
        optionalIngredients: [],
        instructions,
        tags: ['dessert', 'snack', 'no-bake'],
        calories: this.calculateCalories(ingredientList, householdSize),
        protein: this.calculateProtein(ingredientList, householdSize),
        carbs: this.calculateCarbs(ingredientList, householdSize),
        fat: this.calculateFat(ingredientList, householdSize)
      })

      usedIngredients.add(proteinBar.name.toLowerCase())
    }

    return recipes
  }

  /**
   * Generate pasta dishes with multiple ingredients
   */
  private generatePastaRecipes(items: PantryItem[], householdSize: number, usedIngredients: Set<string>): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    const pastaItems = items.filter(item => this.isPasta(item.name))
    const vegetables = items.filter(item => this.isVegetable(item.name))
    const proteins = items.filter(item => this.isProtein(item.name))
    const seasonings = items.filter(item => this.isSeasoning(item.name))

    for (const pasta of pastaItems) {
      // Need at least pasta + 1 vegetable + 1 seasoning
      if (vegetables.length >= 1 && seasonings.length >= 1) {
        const recipe = this.createPastaRecipe(pasta, vegetables, proteins, seasonings, householdSize)
        if (recipe) {
          recipes.push(recipe)
        }
      }
    }

    return recipes
  }

  /**
   * Generate rice dishes with multiple ingredients
   */
  private generateRiceRecipes(items: PantryItem[], householdSize: number, usedIngredients: Set<string>): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    const riceItems = items.filter(item => this.isRice(item.name))
    const vegetables = items.filter(item => this.isVegetable(item.name))
    const proteins = items.filter(item => this.isProtein(item.name))
    const seasonings = items.filter(item => this.isSeasoning(item.name))

    for (const rice of riceItems) {
      // Need at least rice + 1 vegetable + 1 seasoning
      if (vegetables.length >= 1 && seasonings.length >= 1) {
        const recipe = this.createRiceRecipe(rice, vegetables, proteins, seasonings, householdSize)
        if (recipe) {
          recipes.push(recipe)
        }
      }
    }

    return recipes
  }

  /**
   * Generate stir-fry dishes with multiple ingredients
   */
  private generateStirFryRecipes(items: PantryItem[], householdSize: number, usedIngredients: Set<string>): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    const proteins = items.filter(item => this.isProtein(item.name))
    const vegetables = items.filter(item => this.isVegetable(item.name))
    const seasonings = items.filter(item => this.isStirFrySeasoning(item.name))

    // Need at least 1 protein + 2 vegetables + 1 stir-fry seasoning
    if (proteins.length >= 1 && vegetables.length >= 2 && seasonings.length >= 1) {
      const recipe = this.createStirFryRecipe(proteins[0], vegetables, seasonings, householdSize)
      if (recipe) {
        recipes.push(recipe)
      }
    }

    return recipes
  }

  /**
   * Generate soup recipes with multiple ingredients
   */
  private generateSoupRecipes(items: PantryItem[], householdSize: number, usedIngredients: Set<string>): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    const vegetables = items.filter(item => this.isVegetable(item.name))
    const proteins = items.filter(item => this.isProtein(item.name))
    const seasonings = items.filter(item => this.isSeasoning(item.name))

    // Need at least 2 vegetables + 1 seasoning
    if (vegetables.length >= 2 && seasonings.length >= 1) {
      const recipe = this.createSoupRecipe(vegetables, proteins, seasonings, householdSize)
      if (recipe) {
        recipes.push(recipe)
      }
    }

    return recipes
  }

  /**
   * Generate salad recipes with multiple ingredients
   */
  private generateSaladRecipes(items: PantryItem[], householdSize: number, usedIngredients: Set<string>): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    const vegetables = items.filter(item => this.isSaladVegetable(item.name))
    const proteins = items.filter(item => this.isSaladProtein(item.name))
    const seasonings = items.filter(item => this.isSaladSeasoning(item.name))

    // Need at least 2 vegetables + 1 seasoning
    if (vegetables.length >= 2 && seasonings.length >= 1) {
      const recipe = this.createSaladRecipe(vegetables, proteins, seasonings, householdSize)
      if (recipe) {
        recipes.push(recipe)
      }
    }

    return recipes
  }

  /**
   * Create a classic protein + starch + MULTIPLE vegetables + MULTIPLE seasonings recipe
   * Uses 6-7 ingredients to create unique, diverse recipes
   */
  private createClassicRecipe(
    protein: PantryItem,
    starch: PantryItem,
    vegetable1: PantryItem,
    vegetable2: PantryItem,
    seasoning1: PantryItem,
    seasoning2: PantryItem,
    householdSize: number
  ): GeneratedRecipe | null {
    const proteinName = protein.name.toLowerCase()
    const starchName = starch.name.toLowerCase()
    
    // Only create recipes with sensible combinations
    if (!this.isValidClassicCombination(proteinName, starchName, vegetable1.name.toLowerCase())) {
      return null
    }

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

    // Create UNIQUE titles with multiple ingredients
    const veggieNames = vegetable1.name === vegetable2.name 
      ? this.capitalize(vegetable1.name)
      : `${this.capitalize(vegetable1.name)} and ${this.capitalize(vegetable2.name)}`
    
    if (starchName.includes('rice')) {
      title = `${this.capitalize(cookingMethod)} ${this.capitalize(protein.name)} with ${veggieNames} Rice`
    } else if (starchName.includes('pasta')) {
      title = `${this.capitalize(protein.name)} and ${veggieNames} Pasta`
    } else if (starchName.includes('potato')) {
      title = `${this.capitalize(cookingMethod)} ${this.capitalize(protein.name)} with ${veggieNames} and Potatoes`
    } else {
      title = `${this.capitalize(cookingMethod)} ${this.capitalize(protein.name)} with ${veggieNames} and ${this.capitalize(starch.name)}`
    }

    // Use 6-7 ingredients for a complete, unique recipe
    // Auto-add common staples that recipes typically need
    const ingredients = [
      protein.name, 
      starch.name, 
      vegetable1.name,
      vegetable2.name,
      seasoning1.name,
      seasoning2.name,
      'olive oil', // Common staple
      'salt', // Common staple
      'black pepper' // Common staple
    ]
    
    const instructions = this.generateClassicInstructions(
      protein, 
      starch, 
      [vegetable1, vegetable2], 
      [seasoning1, seasoning2], 
      cookingMethod
    )

    return {
      title,
      description: `A delicious ${cuisine.toLowerCase()} dish featuring ${protein.name} with ${veggieNames.toLowerCase()} and ${starch.name}.`,
      mealType: 'dinner',
      cuisine,
      difficulty: 'Easy',
      prepTime: 15,
      cookTime: 30,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: [cuisine.toLowerCase(), protein.name.toLowerCase(), 'balanced', 'nutritious'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  /**
   * Create a pasta recipe
   */
  private createPastaRecipe(
    pasta: PantryItem,
    vegetables: PantryItem[],
    proteins: PantryItem[],
    seasonings: PantryItem[],
    householdSize: number
  ): GeneratedRecipe | null {
    const mainVeggie = vegetables[0]
    const protein = proteins.length > 0 ? proteins[0] : null
    const seasoning = seasonings[0]

    let title = ''
    let cuisine = 'Italian'

    if (protein) {
      title = `${this.capitalize(protein.name)} and ${this.capitalize(mainVeggie.name)} Pasta`
    } else {
      title = `${this.capitalize(mainVeggie.name)} Pasta`
    }

    const ingredients = [pasta.name, mainVeggie.name, seasoning.name]
    if (protein) ingredients.push(protein.name)
    // Add common staples
    ingredients.push('olive oil', 'salt', 'black pepper')

    const instructions = this.generatePastaInstructions(pasta, mainVeggie, protein, seasoning)

    return {
      title,
      description: `A classic ${cuisine.toLowerCase()} pasta dish with ${mainVeggie.name}${protein ? ` and ${protein.name}` : ''}.`,
      mealType: 'dinner',
      cuisine,
      difficulty: 'Easy',
      prepTime: 10,
      cookTime: 20,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: [cuisine.toLowerCase(), 'pasta', 'comfort', 'quick'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  /**
   * Create a rice recipe
   */
  private createRiceRecipe(
    rice: PantryItem,
    vegetables: PantryItem[],
    proteins: PantryItem[],
    seasonings: PantryItem[],
    householdSize: number
  ): GeneratedRecipe | null {
    const mainVeggie = vegetables[0]
    const protein = proteins.length > 0 ? proteins[0] : null
    const seasoning = seasonings[0]

    let title = ''
    let cuisine = 'Asian'

    if (protein) {
      title = `${this.capitalize(protein.name)} and ${this.capitalize(mainVeggie.name)} Fried Rice`
    } else {
      title = `${this.capitalize(mainVeggie.name)} Fried Rice`
    }

    const ingredients = [rice.name, mainVeggie.name, seasoning.name]
    if (protein) ingredients.push(protein.name)
    // Add common staples
    ingredients.push('olive oil', 'salt', 'black pepper')

    const instructions = this.generateRiceInstructions(rice, mainVeggie, protein, seasoning)

    return {
      title,
      description: `A flavorful ${cuisine.toLowerCase()} fried rice with ${mainVeggie.name}${protein ? ` and ${protein.name}` : ''}.`,
      mealType: 'dinner',
      cuisine,
      difficulty: 'Easy',
      prepTime: 10,
      cookTime: 15,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: [cuisine.toLowerCase(), 'rice', 'stir-fry', 'quick'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  /**
   * Create a stir-fry recipe
   */
  private createStirFryRecipe(
    protein: PantryItem,
    vegetables: PantryItem[],
    seasonings: PantryItem[],
    householdSize: number
  ): GeneratedRecipe | null {
    const mainVeggie = vegetables[0]
    const secondaryVeggie = vegetables[1]
    const seasoning = seasonings[0]

    const title = `${this.capitalize(protein.name)} and ${this.capitalize(mainVeggie.name)} Stir-Fry`
    const ingredients = [protein.name, mainVeggie.name, secondaryVeggie.name, seasoning.name]
    // Add common staples
    ingredients.push('olive oil', 'salt', 'black pepper')
    const instructions = this.generateStirFryInstructions(protein, mainVeggie, secondaryVeggie, seasoning)

    return {
      title,
      description: `A quick and healthy stir-fry with ${protein.name}, ${mainVeggie.name}, and ${secondaryVeggie.name}.`,
      mealType: 'dinner',
      cuisine: 'Asian',
      difficulty: 'Easy',
      prepTime: 10,
      cookTime: 12,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: ['asian', 'stir-fry', 'healthy', 'quick'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  /**
   * Create a soup recipe
   */
  private createSoupRecipe(
    vegetables: PantryItem[],
    proteins: PantryItem[],
    seasonings: PantryItem[],
    householdSize: number
  ): GeneratedRecipe | null {
    const mainVeggie = vegetables[0]
    const secondaryVeggie = vegetables[1]
    const protein = proteins.length > 0 ? proteins[0] : null
    const seasoning = seasonings[0]

    let title = ''
    if (protein) {
      title = `${this.capitalize(protein.name)} and ${this.capitalize(mainVeggie.name)} Soup`
    } else {
      title = `${this.capitalize(mainVeggie.name)} and ${this.capitalize(secondaryVeggie.name)} Soup`
    }

    const ingredients = [mainVeggie.name, secondaryVeggie.name, seasoning.name]
    if (protein) ingredients.push(protein.name)
    // Add common staples
    ingredients.push('olive oil', 'salt', 'black pepper', 'chicken broth')

    const instructions = this.generateSoupInstructions(mainVeggie, secondaryVeggie, protein, seasoning)

    return {
      title,
      description: `A comforting soup with ${mainVeggie.name} and ${secondaryVeggie.name}${protein ? ` and ${protein.name}` : ''}.`,
      mealType: 'dinner',
      cuisine: 'American',
      difficulty: 'Easy',
      prepTime: 15,
      cookTime: 30,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: ['soup', 'comfort', 'healthy', 'warm'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  /**
   * Create a salad recipe
   */
  private createSaladRecipe(
    vegetables: PantryItem[],
    proteins: PantryItem[],
    seasonings: PantryItem[],
    householdSize: number
  ): GeneratedRecipe | null {
    const mainVeggie = vegetables[0]
    const secondaryVeggie = vegetables[1]
    const protein = proteins.length > 0 ? proteins[0] : null
    const seasoning = seasonings[0]

    let title = ''
    if (protein) {
      title = `${this.capitalize(protein.name)} and ${this.capitalize(mainVeggie.name)} Salad`
    } else {
      title = `${this.capitalize(mainVeggie.name)} and ${this.capitalize(secondaryVeggie.name)} Salad`
    }

    const ingredients = [mainVeggie.name, secondaryVeggie.name, seasoning.name]
    if (protein) ingredients.push(protein.name)
    // Add common staples for salad
    ingredients.push('olive oil', 'red wine vinegar', 'salt', 'black pepper')

    const instructions = this.generateSaladInstructions(mainVeggie, secondaryVeggie, protein, seasoning)

    return {
      title,
      description: `A fresh and healthy salad with ${mainVeggie.name} and ${secondaryVeggie.name}${protein ? ` and ${protein.name}` : ''}.`,
      mealType: 'lunch',
      cuisine: 'American',
      difficulty: 'Easy',
      prepTime: 10,
      cookTime: 0,
      baseIngredients: ingredients,
      optionalIngredients: [],
      instructions,
      tags: ['salad', 'healthy', 'fresh', 'light'],
      calories: this.calculateCalories(ingredients, householdSize),
      protein: this.calculateProtein(ingredients, householdSize),
      carbs: this.calculateCarbs(ingredients, householdSize),
      fat: this.calculateFat(ingredients, householdSize)
    }
  }

  // Helper methods for ingredient classification
  private isProtein(name: string): boolean {
    const lowerName = name.toLowerCase()
    
    // First check if it's invalid (snacks, processed foods)
    if (this.isInvalidIngredient(lowerName)) {
      return false
    }
    
    // Only allow actual cooking proteins, not processed snacks
    const validProteins = [
      // Fresh/cooking proteins only
      'chicken breast', 'chicken thigh', 'chicken leg', 'chicken wing', 'whole chicken',
      'beef steak', 'beef roast', 'ground beef', 'beef chuck', 'beef brisket', 'beef sirloin',
      'pork chop', 'pork loin', 'pork shoulder', 'ground pork', 'pork tenderloin',
      'salmon', 'salmon fillet', 'fish fillet', 'tuna steak', 'cod', 'tilapia', 'halibut',
      'tofu', 'tempeh', 'beans', 'lentils', 'eggs', 'egg', 'turkey breast', 'turkey',
      'lamb', 'lamb chop', 'shrimp', 'prawn', 'crab', 'lobster'
    ]
    
    // Check for valid protein patterns
    if (validProteins.some(protein => lowerName.includes(protein))) {
      return true
    }
    
    // Allow generic terms ONLY if not invalid
    const genericProteins = ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb']
    return genericProteins.some(protein => lowerName.includes(protein) && 
      !lowerName.includes('stick') && !lowerName.includes('jerky') && 
      !lowerName.includes('snack') && !lowerName.includes('original'))
  }

  private isStarch(name: string): boolean {
    const lowerName = name.toLowerCase()
    const starches = [
      'rice', 'pasta', 'spaghetti', 'potato', 'sweet potato', 
      'bread', 'quinoa', 'barley', 'oats', 'noodles', 'couscous',
      'tortilla', 'tortillas', 'wraps', 'flatbread'
    ]
    return starches.some(starch => lowerName.includes(starch))
  }

  private isVegetable(name: string): boolean {
    const lowerName = name.toLowerCase()
    const vegetables = [
      'onion', 'shallot', 'scallion', 'leek', 'garlic', 
      'tomato', 'pepper', 'carrot', 'celery', 'spinach', 
      'broccoli', 'mushroom', 'zucchini', 'eggplant', 'squash', 
      'lettuce', 'kale', 'cabbage', 'arugula', 'cucumber', 
      'avocado', 'green', 'mix', 'spring mix', 'salad', 'greens',
      'potato', 'sweet potato', 'yam'
    ]
    return vegetables.some(vegetable => lowerName.includes(vegetable))
  }

  private isSeasoning(name: string): boolean {
    const seasonings = ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme', 'rosemary', 'garlic powder', 'onion powder', 'chili powder', 'cayenne', 'ginger', 'cilantro', 'parsley', 'olive oil', 'vegetable oil']
    return seasonings.some(seasoning => name.toLowerCase().includes(seasoning))
  }

  private isPasta(name: string): boolean {
    const pastas = ['pasta', 'spaghetti', 'linguine', 'fettuccine', 'penne', 'rigatoni', 'macaroni', 'noodles']
    return pastas.some(pasta => name.toLowerCase().includes(pasta))
  }

  private isRice(name: string): boolean {
    const rices = ['rice', 'brown rice', 'white rice', 'jasmine rice', 'basmati rice']
    return rices.some(rice => name.toLowerCase().includes(rice))
  }

  private isStirFrySeasoning(name: string): boolean {
    const seasonings = ['soy sauce', 'ginger', 'garlic', 'sesame oil', 'chili sauce', 'hoisin sauce']
    return seasonings.some(seasoning => name.toLowerCase().includes(seasoning))
  }

  private isSaladVegetable(name: string): boolean {
    const vegetables = ['lettuce', 'spinach', 'kale', 'arugula', 'cucumber', 'tomato', 'bell pepper', 'carrot', 'celery', 'avocado']
    return vegetables.some(vegetable => name.toLowerCase().includes(vegetable))
  }

  private isSaladProtein(name: string): boolean {
    const proteins = ['chicken', 'turkey', 'eggs', 'cheese', 'beans', 'lentils', 'tofu']
    return proteins.some(protein => name.toLowerCase().includes(protein))
  }

  private isSaladSeasoning(name: string): boolean {
    const seasonings = ['olive oil', 'vinegar', 'lemon', 'lime', 'salt', 'pepper', 'garlic']
    return seasonings.some(seasoning => name.toLowerCase().includes(seasoning))
  }

  /**
   * Check if a combination is valid for classic recipes
   */
  private isValidClassicCombination(protein: string, starch: string, vegetable: string): boolean {
    // Avoid nonsensical combinations
    const badCombinations = [
      // No milk with main dishes
      { protein: 'milk', starch: 'tortilla' },
      { protein: 'tortilla', starch: 'milk' },
      // No weird pairings
      { protein: 'milk', starch: 'bread' },
      { protein: 'bread', starch: 'milk' }
    ]

    for (const bad of badCombinations) {
      if ((protein.includes(bad.protein) && starch.includes(bad.starch)) ||
          (protein.includes(bad.starch) && starch.includes(bad.protein))) {
        return false
      }
    }

    return true
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Generate complex recipes using MANY ingredients (5-8 ingredients)
   */
  private generateComplexRecipes(items: PantryItem[], householdSize: number, usedIngredients: Set<string>): GeneratedRecipe[] {
    const recipes: GeneratedRecipe[] = []
    
    const availableItems = items.filter(item => !usedIngredients.has(item.name.toLowerCase()))
    if (availableItems.length < 5) return recipes
    
    // Create recipes that use 5-8 ingredients
    const shuffledItems = this.shuffleArray(availableItems)
    
    // Generate 1-2 complex recipes
    for (let i = 0; i < Math.min(2, Math.floor(shuffledItems.length / 5)); i++) {
      const startIdx = i * 5
      const recipeItems = shuffledItems.slice(startIdx, startIdx + 6) // Use 6 ingredients
      
      if (recipeItems.length >= 5) {
        const recipe = this.createComplexRecipe(recipeItems, householdSize)
        if (recipe) {
          recipes.push(recipe)
          recipeItems.forEach(item => usedIngredients.add(item.name.toLowerCase()))
        }
      }
    }
    
    return recipes
  }

  /**
   * Create a complex recipe using 5-8 ingredients
   */
  private createComplexRecipe(items: PantryItem[], householdSize: number): GeneratedRecipe | null {
    const proteins = items.filter(item => this.isProtein(item.name))
    const vegetables = items.filter(item => this.isVegetable(item.name))
    const starches = items.filter(item => this.isStarch(item.name))
    const seasonings = items.filter(item => this.isSeasoning(item.name))
    
    if (proteins.length === 0 || vegetables.length < 2) return null
    
    const protein = proteins[0]
    const selectedVeggies = vegetables.slice(0, 3)
    const starch = starches.length > 0 ? starches[0] : null
    const selectedSeasonings = seasonings.slice(0, 2)
    
    const allIngredients = [
      protein.name,
      ...selectedVeggies.map(v => v.name),
      ...selectedSeasonings.map(s => s.name)
    ]
    if (starch) allIngredients.push(starch.name)
    
    const title = `${this.capitalize(protein.name)} with ${selectedVeggies.map(v => this.capitalize(v.name)).join(', ')}${starch ? ` and ${this.capitalize(starch.name)}` : ''}`
    
    return {
      title,
      description: `A hearty dish featuring ${allIngredients.join(', ')}.`,
      mealType: 'dinner',
      cuisine: 'American',
      difficulty: 'Medium',
      prepTime: 15,
      cookTime: 35,
      baseIngredients: allIngredients,
      optionalIngredients: [],
      instructions: this.generateComplexInstructions(protein, selectedVeggies, starch, selectedSeasonings),
      tags: ['complex', 'nutritious', 'balanced'],
      calories: this.calculateCalories(allIngredients, householdSize),
      protein: this.calculateProtein(allIngredients, householdSize),
      carbs: this.calculateCarbs(allIngredients, householdSize),
      fat: this.calculateFat(allIngredients, householdSize)
    }
  }

  /**
   * Ensure recipes are diverse (not just protein swaps)
   */
  private ensureRecipeDiversity(recipes: GeneratedRecipe[]): GeneratedRecipe[] {
    const diverse: GeneratedRecipe[] = []
    const seenPatterns = new Set<string>()
    
    for (const recipe of recipes) {
      // Create a signature based on ingredient combination (not just protein)
      const ingredients = [...recipe.baseIngredients].sort().join('|')
      const pattern = ingredients
      
      // Only add if this ingredient combination hasn't been seen
      if (!seenPatterns.has(pattern)) {
        seenPatterns.add(pattern)
        diverse.push(recipe)
      }
    }
    
    return diverse
  }

  /**
   * Shuffle array for variety - ensures different recipes each time
   * Uses proper Fisher-Yates shuffle with Math.random()
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    // Fisher-Yates shuffle - properly randomizes array
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
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

  // Instruction generation methods
  private generateClassicInstructions(
    protein: PantryItem,
    starch: PantryItem,
    vegetables: PantryItem[],
    seasonings: PantryItem[],
    cookingMethod: string
  ): string[] {
    const veggie1 = vegetables[0]
    const veggie2 = vegetables.length > 1 ? vegetables[1] : vegetables[0]
    const seasoning1 = seasonings[0]
    const seasoning2 = seasonings.length > 1 ? seasonings[1] : seasonings[0]
    const instructions = []
    
    const proteinName = protein.name.toLowerCase()
    const starchName = starch.name.toLowerCase()
    const isChicken = proteinName.includes('chicken')
    const isBeef = proteinName.includes('beef')
    const isFish = proteinName.includes('fish') || proteinName.includes('salmon')
    const isPasta = starchName.includes('pasta') || starchName.includes('fettuccine') || starchName.includes('spaghetti')
    const isRice = starchName.includes('rice')
    const isPotato = starchName.includes('potato')
    
    // Step 1: Prepare the protein
    if (isChicken) {
      instructions.push(`Season ${protein.name} with salt and freshly ground black pepper on both sides.`)
    } else if (isBeef) {
      instructions.push(`Pat ${protein.name} dry with paper towels and season generously with salt and pepper.`)
    } else if (isFish) {
      instructions.push(`Pat ${protein.name} dry and season both sides with salt and pepper.`)
    } else {
      instructions.push(`Season ${protein.name} with salt and pepper.`)
    }
    
    // Step 2: Cook the starch if needed
    if (isPasta) {
      instructions.push(`Cook the pasta: Bring a large pot of salted water to a rolling boil. Add ${starch.name} and cook until al dente (about 9–11 minutes). Reserve ¼ cup of pasta water before draining.`)
    } else if (isRice) {
      instructions.push(`Cook the rice: Rinse ${starch.name} until water runs clear. In a pot, combine rice with water (1:1.5 ratio) and a pinch of salt. Bring to a boil, reduce heat to low, cover, and simmer for 15–18 minutes until water is absorbed.`)
    } else if (isPotato) {
      instructions.push(`Prepare the potatoes: Cut ${starch.name} into even pieces. Place in a pot of salted water, bring to a boil, and cook for 10–12 minutes until tender but not mushy. Drain and set aside.`)
    }
    
    // Step 3: Cook the protein
    if (cookingMethod === 'sautéed') {
      if (isChicken) {
        instructions.push(`Cook the chicken: Heat 1 tablespoon olive oil in a large skillet over medium-high heat. Add ${protein.name} and sauté until golden and cooked through (internal temperature 165°F), about 6–8 minutes per side. Remove and set aside.`)
      } else {
        instructions.push(`Cook the protein: Heat 1 tablespoon olive oil in a large pan over medium-high heat. Add ${protein.name} and sauté until golden and cooked through, about 6–8 minutes. Remove and set aside.`)
      }
    } else if (cookingMethod === 'pan-seared') {
      instructions.push(`Sear the protein: Heat 1 tablespoon olive oil in a large pan over high heat. Add ${protein.name} and sear for 3–4 minutes per side until golden brown and cooked through. Remove and set aside.`)
    }
    
    // Step 4: Sauté vegetables
    instructions.push(`Sauté the vegetables: In the same pan, add a drizzle of olive oil if needed. Add ${veggie1.name} and ${veggie2.name}, and cook for 4–5 minutes until slightly softened but still crisp, stirring occasionally.`)
    
    // Step 5: Combine with starch
    if (isRice) {
      instructions.push(`Combine with rice: Add the cooked rice to the pan with the vegetables. Stir-fry for 2–3 minutes until everything is well combined and heated through.`)
    } else if (isPasta) {
      instructions.push(`Combine with pasta: Add the drained pasta to the pan. Toss well with the vegetables, gradually adding reserved pasta water if needed until the sauce clings to the noodles.`)
    } else if (isPotato) {
      instructions.push(`Add potatoes: Add the cooked potatoes to the pan with the vegetables. Stir gently to combine and heat through for 2–3 minutes.`)
    }
    
    // Step 6: Season and finish
    instructions.push(`Season and finish: Stir in ${seasoning1.name} and ${seasoning2.name}. Season with additional salt and pepper to taste. Return ${protein.name} to the pan and heat through for 1–2 minutes.`)
    
    // Step 7: Serve
    instructions.push(`Serve: Plate the dish immediately while hot. Garnish with fresh herbs if desired.`)
    
    return instructions
  }

  private generateComplexInstructions(
    protein: PantryItem,
    vegetables: PantryItem[],
    starch: PantryItem | null,
    seasonings: PantryItem[]
  ): string[] {
    const instructions = []
    const veggieNames = vegetables.map(v => v.name).join(', ')
    const seasoningNames = seasonings.map(s => s.name).join(' and ')
    
    instructions.push(`Season ${protein.name} with salt and pepper.`)
    instructions.push(`Heat oil in a large pan over medium-high heat.`)
    instructions.push(`Cook ${protein.name} until golden, about 6-8 minutes, then set aside.`)
    instructions.push(`In the same pan, sauté ${veggieNames} until tender, about 7-10 minutes.`)
    
    if (starch) {
      instructions.push(`Add cooked ${starch.name} and stir to combine.`)
    }
    
    instructions.push(`Season with ${seasoningNames} and stir well.`)
    instructions.push(`Return ${protein.name} to the pan, heat through, and serve.`)
    
    return instructions
  }

  private generatePastaInstructions(
    pasta: PantryItem,
    vegetable: PantryItem,
    protein: PantryItem | null,
    seasoning: PantryItem
  ): string[] {
    const instructions = []
    
    instructions.push(`Cook the pasta: Bring a large pot of salted water to a rolling boil. Add ${pasta.name} and cook until al dente (about 9–11 minutes). Reserve ¼ cup of pasta water before draining.`)
    
    instructions.push(`Prepare the sauce: Meanwhile, heat 1 tablespoon olive oil in a large skillet over medium heat.`)
    
    if (protein) {
      instructions.push(`Cook the protein: Add ${protein.name} and cook until golden and cooked through, about 4–5 minutes. Remove and set aside.`)
    }
    
    instructions.push(`Sauté the vegetables: In the same pan, add ${vegetable.name} and cook for 4–5 minutes until slightly softened but still crisp, stirring occasionally.`)
    
    if (protein) {
      instructions.push(`Combine: Return ${protein.name} to the pan. Add the drained pasta and toss well, gradually incorporating reserved pasta water until the sauce clings to the noodles.`)
    } else {
      instructions.push(`Combine with pasta: Add the drained pasta to the pan. Toss well with the vegetables, gradually adding reserved pasta water if needed until everything is well combined.`)
    }
    
    instructions.push(`Season and serve: Stir in ${seasoning.name}. Season with salt and freshly ground black pepper to taste. Serve immediately while hot.`)
    
    return instructions
  }

  private generateRiceInstructions(
    rice: PantryItem,
    vegetable: PantryItem,
    protein: PantryItem | null,
    seasoning: PantryItem
  ): string[] {
    const instructions = []
    
    instructions.push(`Cook the rice: Rinse ${rice.name} until water runs clear. In a pot, combine rice with water (1:1.5 ratio) and a pinch of salt. Bring to a boil, reduce heat to low, cover, and simmer for 15–18 minutes until water is absorbed. Set aside and let cool slightly.`)
    
    if (protein) {
      instructions.push(`Marinate the protein: In a bowl, mix ${protein.name} with 1 tablespoon ${seasoning.name} and a pinch of salt. Let marinate for at least 15 minutes.`)
    }
    
    instructions.push(`Stir-fry the vegetables: Heat 1 tablespoon olive oil in a large pan or wok over high heat. Add ${vegetable.name} and stir-fry for 3–4 minutes until slightly softened but still crisp.`)
    
    if (protein) {
      instructions.push(`Cook the protein: Push vegetables to one side of the pan. Add marinated ${protein.name} and cook for 2–3 minutes per side until golden and cooked through.`)
      instructions.push(`Combine: Add the cooked rice to the pan. Stir-fry everything together for 2–3 minutes until well combined and heated through.`)
    } else {
      instructions.push(`Combine with rice: Add the cooked rice to the pan. Stir-fry for 2–3 minutes until everything is well combined and heated through.`)
    }
    
    instructions.push(`Season and serve: Stir in ${seasoning.name} and season with salt and pepper to taste. Serve immediately while hot.`)
    
    return instructions
  }

  private generateStirFryInstructions(
    protein: PantryItem,
    vegetable1: PantryItem,
    vegetable2: PantryItem,
    seasoning: PantryItem
  ): string[] {
    const instructions = []
    
    instructions.push(`Prepare the protein: Cut ${protein.name} into thin strips or bite-sized pieces. Season with salt and pepper.`)
    instructions.push(`Marinate: In a bowl, mix ${protein.name} with 1 tablespoon ${seasoning.name}. Let marinate for at least 15 minutes.`)
    instructions.push(`Heat the pan: Heat 1 tablespoon olive oil in a large pan or wok over high heat until shimmering.`)
    instructions.push(`Cook the protein: Add marinated ${protein.name} and stir-fry for 4–5 minutes until golden and cooked through. Remove and set aside.`)
    instructions.push(`Stir-fry the vegetables: In the same pan, add a drizzle of oil if needed. Add ${vegetable1.name} and ${vegetable2.name} and stir-fry for 4–5 minutes until slightly softened but still crisp, stirring frequently.`)
    instructions.push(`Combine: Return ${protein.name} to the pan. Add remaining ${seasoning.name} and stir-fry for 1–2 minutes until everything is well combined and heated through.`)
    instructions.push(`Serve: Season with additional salt and pepper to taste. Serve immediately while hot, over rice if desired.`)
    
    return instructions
  }

  private generateSoupInstructions(
    vegetable1: PantryItem,
    vegetable2: PantryItem,
    protein: PantryItem | null,
    seasoning: PantryItem
  ): string[] {
    const instructions = []
    
    instructions.push(`Prepare the vegetables: Wash and chop ${vegetable1.name} and ${vegetable2.name} into bite-sized pieces.`)
    
    if (protein) {
      instructions.push(`Prepare the protein: Cut ${protein.name} into small pieces and season with salt and pepper.`)
    }
    
    instructions.push(`Sauté the vegetables: Heat 1 tablespoon olive oil in a large pot over medium heat. Add ${vegetable1.name} and ${vegetable2.name} and cook for 5–7 minutes until slightly softened, stirring occasionally.`)
    
    if (protein) {
      instructions.push(`Add the protein: Add ${protein.name} and cook for 3–4 minutes until lightly browned.`)
    }
    
    instructions.push(`Add liquid: Pour in 4 cups chicken broth (or vegetable broth) and bring to a boil. Reduce heat to low and simmer, covered, for 15–20 minutes until vegetables are tender.`)
    
    instructions.push(`Season and finish: Stir in ${seasoning.name}. Season with salt and freshly ground black pepper to taste. Simmer for an additional 5 minutes.`)
    
    instructions.push(`Serve: Ladle into bowls and serve hot. Garnish with fresh herbs if desired.`)
    
    return instructions
  }

  private generateSaladInstructions(
    vegetable1: PantryItem,
    vegetable2: PantryItem,
    protein: PantryItem | null,
    seasoning: PantryItem
  ): string[] {
    const instructions = []
    
    instructions.push(`Prepare the vegetables: Wash and chop ${vegetable1.name} and ${vegetable2.name} into bite-sized pieces.`)
    
    if (protein) {
      instructions.push(`Prepare the protein: If ${protein.name} needs cooking, prepare it according to package directions and let cool to room temperature.`)
    }
    
    instructions.push(`Make the dressing: In a small bowl, whisk together 2 tablespoons olive oil, 1 tablespoon red wine vinegar, ½ teaspoon dried ${seasoning.name}, salt, and freshly ground black pepper to taste.`)
    
    instructions.push(`Assemble the salad: Add ${vegetable1.name} and ${vegetable2.name} to a large bowl.`)
    
    if (protein) {
      instructions.push(`Add the protein: Add ${protein.name} to the bowl and toss gently to combine.`)
    }
    
    instructions.push(`Dress and serve: Drizzle the dressing over the salad and toss gently to coat everything evenly. Serve immediately while fresh and crisp.`)
    
    return instructions
  }
}

export const realisticRecipeGenerator = RealisticRecipeGenerator.getInstance()
