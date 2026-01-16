// SAVR Pantry-Based Recipe Generator
// Creates custom recipes specifically from user's actual pantry items
import { supabase, Recipe } from './supabase'
import { recipePreferenceLearningService } from './RecipePreferenceLearningService'

interface PantryItem {
  name: string
  category: string
  quantity: number
}

interface GeneratedRecipe {
  title: string
  description: string
  ingredients: Array<{ name: string; quantity: string; unit: string }>
  instructions: Array<{ step: number; description: string }>
  prep_time: number
  cook_time: number
  servings: number
  difficulty: string
  meal_type: string
  cuisine_type: string
  tags: string[]
  matchPercentage: number
}

class PantryBasedRecipeGenerator {
  private static instance: PantryBasedRecipeGenerator

  static getInstance(): PantryBasedRecipeGenerator {
    if (!PantryBasedRecipeGenerator.instance) {
      PantryBasedRecipeGenerator.instance = new PantryBasedRecipeGenerator()
    }
    return PantryBasedRecipeGenerator.instance
  }

  /**
   * Generate custom recipes from user's actual pantry items
   */
  async generateFromPantry(
    userId: string,
    pantryItems: PantryItem[],
    userPreferences?: {
      cuisines?: string[]
      mealType?: string
      difficulty?: string
    }
  ): Promise<Recipe[]> {
    if (!pantryItems || pantryItems.length === 0) {
      console.log('⚠️ No pantry items to generate recipes from')
      return []
    }

    try {
      console.log(`🍳 Generating recipes from ${pantryItems.length} pantry items...`)

      // Load user's learned preferences
      await recipePreferenceLearningService.loadUserPreferences(userId)
      const topIngredients = recipePreferenceLearningService.getTopIngredients(userId, 10)
      const topCuisines = recipePreferenceLearningService.getTopCuisines(userId, 3)

      console.log(`👤 User's favorite ingredients: ${topIngredients.slice(0, 5).join(', ')}`)
      console.log(`👤 User's favorite cuisines: ${topCuisines.join(', ')}`)

      // Group items by category for smart recipe generation
      const proteins = pantryItems.filter(item => 
        ['meat', 'seafood', 'protein'].includes(item.category.toLowerCase()) ||
        item.name.toLowerCase().includes('chicken') ||
        item.name.toLowerCase().includes('beef') ||
        item.name.toLowerCase().includes('fish') ||
        item.name.toLowerCase().includes('tofu')
      )

      const vegetables = pantryItems.filter(item => 
        item.category.toLowerCase() === 'produce' ||
        item.category.toLowerCase() === 'vegetables'
      )

      const carbs = pantryItems.filter(item => 
        ['grains', 'bread', 'pasta'].includes(item.category.toLowerCase()) ||
        item.name.toLowerCase().includes('rice') ||
        item.name.toLowerCase().includes('pasta') ||
        item.name.toLowerCase().includes('bread')
      )

      const dairy = pantryItems.filter(item => 
        item.category.toLowerCase() === 'dairy'
      )

      console.log(`📊 Pantry breakdown: ${proteins.length} proteins, ${vegetables.length} veggies, ${carbs.length} carbs, ${dairy.length} dairy`)

      // Generate recipe combinations
      const generatedRecipes: Recipe[] = []

      // Strategy 1: Protein + Vegetables + Carbs (Main Dishes)
      if (proteins.length > 0) {
        for (const protein of proteins.slice(0, 3)) { // Top 3 proteins
          const compatibleVeggies = this.getCompatibleItems(protein, vegetables, 3)
          const compatibleCarbs = this.getCompatibleItems(protein, carbs, 1)

          if (compatibleVeggies.length >= 2) {
            const recipe = await this.createRecipeFromIngredients(
              userId,
              [protein, ...compatibleVeggies, ...compatibleCarbs],
              pantryItems,
              'dinner',
              topCuisines[0] || 'American'
            )
            if (recipe) generatedRecipes.push(recipe)
          }
        }
      }

      // Strategy 2: Vegetarian Bowls (if vegetables available)
      if (vegetables.length >= 3 && carbs.length > 0) {
        const recipe = await this.createVegetarianBowl(
          userId,
          vegetables.slice(0, 4),
          carbs[0],
          pantryItems,
          topCuisines[0] || 'Mediterranean'
        )
        if (recipe) generatedRecipes.push(recipe)
      }

      // Strategy 3: Quick Meals (using dairy + carbs)
      if (dairy.length > 0 && (carbs.length > 0 || vegetables.length > 0)) {
        const recipe = await this.createQuickMeal(
          userId,
          dairy[0],
          [...carbs, ...vegetables],
          pantryItems,
          userPreferences?.mealType || 'lunch'
        )
        if (recipe) generatedRecipes.push(recipe)
      }

      // Calculate match percentages
      const recipesWithMatch = generatedRecipes.map(recipe => ({
        ...recipe,
        matchPercentage: this.calculatePantryMatch(recipe, pantryItems)
      }))

      // Sort by match percentage
      recipesWithMatch.sort((a, b) => (b as any).matchPercentage - (a as any).matchPercentage)

      console.log(`✨ Generated ${recipesWithMatch.length} custom recipes from pantry`)
      return recipesWithMatch

    } catch (error) {
      console.error('Error generating pantry-based recipes:', error)
      return []
    }
  }

  /**
   * Create a recipe from specific ingredients
   */
  private async createRecipeFromIngredients(
    userId: string,
    mainIngredients: PantryItem[],
    allPantryItems: PantryItem[],
    mealType: string,
    cuisineType: string
  ): Promise<Recipe | null> {
    try {
      const mainProtein = mainIngredients[0]
      const veggies = mainIngredients.slice(1, 4)
      
      // Create smart recipe title based on ingredients
      const title = this.generateRecipeTitle(mainProtein, veggies, cuisineType)
      
      // Build ingredients list
      const ingredients = [
        {
          name: mainProtein.name,
          quantity: '1',
          unit: mainProtein.name.toLowerCase().includes('chicken') ? 'lb' : 'piece'
        },
        ...veggies.map(v => ({
          name: v.name,
          quantity: '1',
          unit: 'cup'
        })),
        // Add common pantry staples if available
        ...this.addCommonStaples(allPantryItems)
      ]

      // Generate cooking instructions
      const instructions = this.generateInstructions(mainProtein, veggies, cuisineType)

      // Create recipe object
      const recipe: Recipe = {
        id: `pantry_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        description: `A delicious ${cuisineType.toLowerCase()} dish made with ${mainProtein.name.toLowerCase()} and fresh vegetables from your pantry.`,
        image_url: this.getRecipeImage(cuisineType, mealType),
        prep_time: 15,
        cook_time: 25,
        servings: 4,
        difficulty: 'Easy',
        cuisine_type: cuisineType,
        meal_type: mealType,
        ingredients,
        instructions,
        calories: 350,
        protein: 28,
        carbs: 32,
        fat: 12,
      tags: ['pantry-based', cuisineType.toLowerCase(), 'quick', mealType],
      source: 'ai_generated',
      is_public: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: userId
      }

      return recipe
    } catch (error) {
      console.error('Error creating recipe from ingredients:', error)
      return null
    }
  }

  /**
   * Create a vegetarian bowl recipe
   */
  private async createVegetarianBowl(
    userId: string,
    vegetables: PantryItem[],
    grain: PantryItem,
    allPantryItems: PantryItem[],
    cuisineType: string
  ): Promise<Recipe | null> {
    const title = `${cuisineType} Veggie Bowl with ${grain.name}`
    
    const ingredients = [
      { name: grain.name, quantity: '2', unit: 'cups' },
      ...vegetables.slice(0, 4).map(v => ({
        name: v.name,
        quantity: '1',
        unit: 'cup'
      })),
      ...this.addCommonStaples(allPantryItems)
    ]

    const instructions = [
      { step: 1, description: `Cook ${grain.name.toLowerCase()} according to package instructions` },
      { step: 2, description: `Chop all vegetables into bite-sized pieces` },
      { step: 3, description: 'Heat oil in a large pan over medium-high heat' },
      { step: 4, description: 'Sauté vegetables until tender, about 8-10 minutes' },
      { step: 5, description: 'Season with salt, pepper, and your favorite spices' },
      { step: 6, description: `Serve vegetables over ${grain.name.toLowerCase()}` }
    ]

    return {
      id: `pantry_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: `A healthy and colorful vegetarian bowl featuring ${vegetables.map(v => v.name.toLowerCase()).join(', ')}.`,
      image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      prep_time: 10,
      cook_time: 20,
      servings: 4,
      difficulty: 'Easy',
      cuisine_type: cuisineType,
      meal_type: 'lunch',
      ingredients,
      instructions,
      calories: 320,
      protein: 12,
      carbs: 52,
      fat: 8,
      tags: ['vegetarian', 'healthy', 'pantry-based', 'bowl'],
      source: 'ai_generated',
      is_public: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: userId
    }
  }

  /**
   * Create a quick meal recipe
   */
  private async createQuickMeal(
    userId: string,
    dairyItem: PantryItem,
    otherItems: PantryItem[],
    allPantryItems: PantryItem[],
    mealType: string
  ): Promise<Recipe | null> {
    const title = `Quick ${dairyItem.name} ${mealType === 'breakfast' ? 'Breakfast' : 'Meal'}`
    
    const ingredients = [
      { name: dairyItem.name, quantity: '1', unit: 'cup' },
      ...otherItems.slice(0, 3).map(item => ({
        name: item.name,
        quantity: '1/2',
        unit: 'cup'
      }))
    ]

    const instructions = [
      { step: 1, description: 'Gather all ingredients' },
      { step: 2, description: `Combine ${dairyItem.name.toLowerCase()} with other ingredients` },
      { step: 3, description: 'Mix well and season to taste' },
      { step: 4, description: 'Serve immediately and enjoy!' }
    ]

    return {
      id: `pantry_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: `A quick and easy meal using ${dairyItem.name.toLowerCase()} and pantry items.`,
      image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
      prep_time: 5,
      cook_time: 5,
      servings: 2,
      difficulty: 'Easy',
      cuisine_type: 'American',
      meal_type: mealType,
      ingredients,
      instructions,
      calories: 250,
      protein: 10,
      carbs: 28,
      fat: 8,
      tags: ['quick', 'easy', 'pantry-based', mealType],
      source: 'ai_generated',
      is_public: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: userId
    }
  }

  // Helper methods
  private getCompatibleItems(mainItem: PantryItem, items: PantryItem[], count: number): PantryItem[] {
    return items.slice(0, count)
  }

  private generateRecipeTitle(protein: PantryItem, veggies: PantryItem[], cuisine: string): string {
    const proteinName = protein.name.split(' ')[0]
    const veggie1 = veggies[0]?.name.split(' ')[0] || 'Vegetable'
    return `${cuisine} ${proteinName} with ${veggie1}`
  }

  private generateInstructions(protein: PantryItem, veggies: PantryItem[], cuisine: string): Array<{ step: number; description: string }> {
    return [
      { step: 1, description: `Prepare ${protein.name.toLowerCase()} by cleaning and cutting into pieces` },
      { step: 2, description: 'Chop all vegetables into bite-sized pieces' },
      { step: 3, description: 'Heat oil in a large pan over medium-high heat' },
      { step: 4, description: `Cook ${protein.name.toLowerCase()} until done, about 6-8 minutes` },
      { step: 5, description: 'Add vegetables and stir-fry for 5-7 minutes' },
      { step: 6, description: `Season with ${cuisine.toLowerCase()} spices and serve hot` }
    ]
  }

  private addCommonStaples(pantryItems: PantryItem[]): Array<{ name: string; quantity: string; unit: string }> {
    const staples = []
    const staplesToCheck = [
      { name: 'olive oil', altNames: ['oil'] },
      { name: 'salt', altNames: ['salt'] },
      { name: 'pepper', altNames: ['pepper', 'black pepper'] },
      { name: 'garlic', altNames: ['garlic'] },
      { name: 'onion', altNames: ['onion'] }
    ]

    for (const staple of staplesToCheck) {
      const hasStaple = pantryItems.some(item => 
        staple.altNames.some(alt => item.name.toLowerCase().includes(alt))
      )
      if (hasStaple) {
        staples.push({
          name: staple.name,
          quantity: '2',
          unit: 'tbsp'
        })
      }
      if (staples.length >= 3) break
    }

    return staples
  }

  private getRecipeImage(cuisine: string, mealType: string): string {
    const images: { [key: string]: string } = {
      'italian': 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80',
      'mexican': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80',
      'asian': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&q=80',
      'mediterranean': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      'default': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'
    }
    return images[cuisine.toLowerCase()] || images.default
  }

  private calculatePantryMatch(recipe: Recipe, pantryItems: PantryItem[]): number {
    if (!recipe.ingredients || !pantryItems) return 0

    const pantryNames = pantryItems.map(item => item.name.toLowerCase())
    let matchCount = 0

    recipe.ingredients.forEach((ing: any) => {
      const ingName = ing.name.toLowerCase()
      if (pantryNames.some(p => p.includes(ingName) || ingName.includes(p))) {
        matchCount++
      }
    })

    return Math.round((matchCount / recipe.ingredients.length) * 100)
  }
}

export const pantryBasedRecipeGenerator = PantryBasedRecipeGenerator.getInstance()

