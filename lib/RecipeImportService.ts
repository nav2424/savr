// Recipe Import Service
// Tools to import curated recipes from various sources and generate embeddings
// Supports importing from JSON files, APIs, or manual entry

import { supabase } from './supabase'
import { recipeEmbeddingService } from './RecipeEmbeddingService'
import type { Recipe } from './supabase'

interface ImportRecipe {
  title: string
  description?: string
  image_url?: string
  prep_time?: number
  cook_time?: number
  servings?: number
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  cuisine_type?: string
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert'
  ingredients: Array<{
    name: string
    quantity: string
    unit: string
  }>
  instructions: Array<{
    step: number
    description: string
  }>
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  tags?: string[]
  source?: string
}

interface ImportResult {
  success: boolean
  imported: number
  failed: number
  errors: string[]
  recipeIds: string[]
}

class RecipeImportService {
  private static instance: RecipeImportService

  static getInstance(): RecipeImportService {
    if (!RecipeImportService.instance) {
      RecipeImportService.instance = new RecipeImportService()
    }
    return RecipeImportService.instance
  }

  /**
   * Validate an import recipe
   */
  private validateRecipe(recipe: ImportRecipe): { valid: boolean; error?: string } {
    if (!recipe.title || recipe.title.trim().length === 0) {
      return { valid: false, error: 'Title is required' }
    }

    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      return { valid: false, error: 'At least one ingredient is required' }
    }

    if (!recipe.instructions || recipe.instructions.length === 0) {
      return { valid: false, error: 'At least one instruction is required' }
    }

    return { valid: true }
  }

  /**
   * Convert import recipe to database format
   */
  private convertToRecipe(importRecipe: ImportRecipe, userId?: string): Partial<Recipe> {
    return {
      title: importRecipe.title.trim(),
      description: importRecipe.description?.trim(),
      image_url: importRecipe.image_url,
      prep_time: importRecipe.prep_time,
      cook_time: importRecipe.cook_time,
      servings: importRecipe.servings || 4,
      difficulty: importRecipe.difficulty || 'Medium',
      cuisine_type: importRecipe.cuisine_type,
      meal_type: importRecipe.meal_type || 'dinner',
      ingredients: importRecipe.ingredients as any,
      instructions: importRecipe.instructions as any,
      calories: importRecipe.calories,
      protein: importRecipe.protein,
      carbs: importRecipe.carbs,
      fat: importRecipe.fat,
      fiber: importRecipe.fiber,
      tags: importRecipe.tags || [],
      source: (importRecipe.source as 'curated' | 'imported' | 'user_created' | 'ai_generated') || 'imported',
      is_public: true,
      created_by: userId,
    }
  }

  /**
   * Import a single recipe
   */
  async importRecipe(
    recipe: ImportRecipe,
    userId?: string,
    generateEmbedding: boolean = true
  ): Promise<{ success: boolean; recipeId?: string; error?: string }> {
    try {
      // Validate
      const validation = this.validateRecipe(recipe)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      // Convert to database format
      const dbRecipe = this.convertToRecipe(recipe, userId)

      // Insert into database
      const { data, error } = await supabase
        .from('recipes')
        .insert(dbRecipe)
        .select()
        .single()

      if (error) {
        console.error('❌ Database error:', error)
        return { success: false, error: error.message }
      }

      if (!data) {
        return { success: false, error: 'No data returned from insert' }
      }

      console.log(`✅ Imported recipe: ${recipe.title} (${data.id})`)

      // Generate embedding if requested
      if (generateEmbedding && data) {
        try {
          await recipeEmbeddingService.generateAndSaveEmbedding(data)
          console.log(`🔮 Generated embedding for: ${recipe.title}`)
        } catch (embedError) {
          console.warn(`⚠️ Failed to generate embedding for ${recipe.title}:`, embedError)
          // Don't fail the import if embedding fails
        }
      }

      return { success: true, recipeId: data.id }
    } catch (error: any) {
      console.error('❌ Error importing recipe:', error)
      return { success: false, error: error.message || 'Unknown error' }
    }
  }

  /**
   * Import multiple recipes from an array
   */
  async importRecipes(
    recipes: ImportRecipe[],
    userId?: string,
    options: {
      generateEmbeddings?: boolean
      batchSize?: number
      continueOnError?: boolean
    } = {}
  ): Promise<ImportResult> {
    const {
      generateEmbeddings = true,
      batchSize = 10,
      continueOnError = true,
    } = options

    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      recipeIds: [],
    }

    console.log(`📦 Importing ${recipes.length} recipes...`)

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < recipes.length; i += batchSize) {
      const batch = recipes.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(recipes.length / batchSize)}`)

      for (const recipe of batch) {
        try {
          const importResult = await this.importRecipe(recipe, userId, generateEmbeddings)

          if (importResult.success && importResult.recipeId) {
            result.imported++
            result.recipeIds.push(importResult.recipeId)
          } else {
            result.failed++
            result.errors.push(`${recipe.title}: ${importResult.error || 'Unknown error'}`)
            
            if (!continueOnError) {
              result.success = false
              return result
            }
          }

          // Rate limiting: wait 200ms between imports
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error: any) {
          result.failed++
          result.errors.push(`${recipe.title}: ${error.message || 'Unknown error'}`)
          
          if (!continueOnError) {
            result.success = false
            return result
          }
        }
      }

      // Longer pause between batches
      if (i + batchSize < recipes.length) {
        console.log('⏸️ Pausing between batches...')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`✅ Import complete: ${result.imported} succeeded, ${result.failed} failed`)
    return result
  }

  /**
   * Import from JSON file/object
   */
  async importFromJSON(
    jsonData: ImportRecipe[] | { recipes: ImportRecipe[] },
    userId?: string,
    options?: {
      generateEmbeddings?: boolean
      batchSize?: number
      continueOnError?: boolean
    }
  ): Promise<ImportResult> {
    let recipes: ImportRecipe[]

    if (Array.isArray(jsonData)) {
      recipes = jsonData
    } else if (jsonData.recipes && Array.isArray(jsonData.recipes)) {
      recipes = jsonData.recipes
    } else {
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: ['Invalid JSON format: expected array or object with "recipes" array'],
        recipeIds: [],
      }
    }

    return this.importRecipes(recipes, userId, options)
  }

  /**
   * Update embeddings for existing recipes that don't have them
   */
  async updateMissingEmbeddings(limit: number = 100): Promise<number> {
    try {
      console.log(`🔮 Updating embeddings for recipes without them (limit: ${limit})...`)

      // Get recipes without embeddings
      const { data: recipes, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('is_public', true)
        .is('embedding', null)
        .limit(limit)

      if (error) throw error

      if (!recipes || recipes.length === 0) {
        console.log('✅ All recipes already have embeddings')
        return 0
      }

      console.log(`📚 Found ${recipes.length} recipes without embeddings`)

      let successCount = 0
      for (const recipe of recipes) {
        try {
          const success = await recipeEmbeddingService.generateAndSaveEmbedding(recipe)
          if (success) successCount++

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          console.error(`❌ Failed to generate embedding for ${recipe.title}:`, error)
        }
      }

      console.log(`✅ Updated ${successCount}/${recipes.length} embeddings`)
      return successCount
    } catch (error) {
      console.error('❌ Error updating embeddings:', error)
      return 0
    }
  }

  /**
   * Save embedding to database for a recipe
   */
  async saveEmbedding(recipeId: string, embedding: number[]): Promise<boolean> {
    try {
      // Convert array to PostgreSQL vector format: [1,2,3] as string
      // Supabase expects the embedding as a string in vector format
      const vectorString = `[${embedding.join(',')}]`

      const { error } = await supabase
        .from('recipes')
        .update({ embedding: vectorString })
        .eq('id', recipeId)

      if (error) {
        console.error('Error saving embedding:', error)
        throw error
      }

      console.log(`💾 Saved embedding for recipe: ${recipeId}`)
      return true
    } catch (error) {
      console.error('❌ Error saving embedding:', error)
      return false
    }
  }

  /**
   * Generate sample curated recipes for testing
   */
  generateSampleRecipes(count: number = 10): ImportRecipe[] {
    const cuisines = ['Italian', 'Mexican', 'Asian', 'Mediterranean', 'American', 'Indian']
    const mealTypes: Array<'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert'> = [
      'breakfast',
      'lunch',
      'dinner',
      'snack',
      'dessert',
    ]
    const difficulties: Array<'Easy' | 'Medium' | 'Hard'> = ['Easy', 'Medium', 'Hard']

    const recipes: ImportRecipe[] = []

    const sampleTemplates = [
      {
        title: 'Classic Pasta Carbonara',
        cuisine: 'Italian',
        meal: 'dinner',
        ingredients: [
          { name: 'Spaghetti', quantity: '1', unit: 'lb' },
          { name: 'Eggs', quantity: '4', unit: 'pieces' },
          { name: 'Pancetta', quantity: '8', unit: 'oz' },
          { name: 'Parmesan cheese', quantity: '1', unit: 'cup' },
          { name: 'Black pepper', quantity: '1', unit: 'tsp' },
        ],
        instructions: [
          { step: 1, description: 'Cook pasta in salted water until al dente' },
          { step: 2, description: 'Cook pancetta in a large pan until crispy' },
          { step: 3, description: 'Whisk eggs with grated parmesan' },
          { step: 4, description: 'Toss hot pasta with pancetta and egg mixture' },
          { step: 5, description: 'Serve immediately with black pepper' },
        ],
        prep: 10,
        cook: 20,
        calories: 520,
        protein: 28,
        carbs: 65,
        fat: 18,
      },
      {
        title: 'Mediterranean Quinoa Bowl',
        cuisine: 'Mediterranean',
        meal: 'lunch',
        ingredients: [
          { name: 'Quinoa', quantity: '1', unit: 'cup' },
          { name: 'Cherry tomatoes', quantity: '1', unit: 'cup' },
          { name: 'Cucumber', quantity: '1', unit: 'piece' },
          { name: 'Feta cheese', quantity: '4', unit: 'oz' },
          { name: 'Olive oil', quantity: '2', unit: 'tbsp' },
          { name: 'Lemon juice', quantity: '1', unit: 'tbsp' },
        ],
        instructions: [
          { step: 1, description: 'Cook quinoa according to package directions' },
          { step: 2, description: 'Chop tomatoes and cucumber into bite-sized pieces' },
          { step: 3, description: 'Crumble feta cheese' },
          { step: 4, description: 'Whisk olive oil and lemon juice for dressing' },
          { step: 5, description: 'Combine all ingredients and toss with dressing' },
        ],
        prep: 15,
        cook: 15,
        calories: 380,
        protein: 14,
        carbs: 52,
        fat: 16,
      },
    ]

    for (let i = 0; i < count; i++) {
      const template = sampleTemplates[i % sampleTemplates.length]
      const cuisine = cuisines[Math.floor(Math.random() * cuisines.length)]
      const meal = mealTypes[Math.floor(Math.random() * mealTypes.length)]
      const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)]

      recipes.push({
        title: `${template.title} ${i > 0 ? `#${i + 1}` : ''}`.trim(),
        description: `Delicious ${cuisine} ${meal} recipe`,
        cuisine_type: cuisine,
        meal_type: meal,
        difficulty,
        prep_time: template.prep + Math.floor(Math.random() * 10),
        cook_time: template.cook + Math.floor(Math.random() * 15),
        servings: 2 + Math.floor(Math.random() * 4),
        ingredients: template.ingredients,
        instructions: template.instructions,
        calories: template.calories + Math.floor(Math.random() * 100),
        protein: template.protein + Math.floor(Math.random() * 10),
        carbs: template.carbs + Math.floor(Math.random() * 15),
        fat: template.fat + Math.floor(Math.random() * 5),
        tags: [cuisine.toLowerCase(), meal, difficulty.toLowerCase()],
        source: 'curated',
      })
    }

    return recipes
  }
}

export const recipeImportService = RecipeImportService.getInstance()
export default recipeImportService

