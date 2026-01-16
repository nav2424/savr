// Recipe Embedding Service
// Generates vector embeddings for recipes using OpenAI API
// Enables semantic search and recipe remixing

import { config } from '../config'
import { supabase } from './supabase'
import type { Recipe } from './supabase'

const OPENAI_EMBEDDINGS_API_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 dimensions, cost-effective
const EMBEDDING_DIMENSIONS = 1536

interface EmbeddingResponse {
  data: Array<{
    embedding: number[]
    index: number
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

class RecipeEmbeddingService {
  private static instance: RecipeEmbeddingService
  private cache: Map<string, number[]> = new Map()

  static getInstance(): RecipeEmbeddingService {
    if (!RecipeEmbeddingService.instance) {
      RecipeEmbeddingService.instance = new RecipeEmbeddingService()
    }
    return RecipeEmbeddingService.instance
  }

  /**
   * Generate embedding text from recipe data
   * This is what gets sent to OpenAI for embedding
   */
  private generateEmbeddingText(recipe: Recipe): string {
    const ingredientNames = recipe.ingredients
      ?.map((ing: any) => ing.name || '')
      .filter(Boolean)
      .join(', ') || ''

    const tags = (recipe.tags || []).join(' ')

    return [
      recipe.title || '',
      recipe.description || '',
      ingredientNames,
      tags,
      recipe.cuisine_type || '',
      recipe.meal_type || '',
      recipe.difficulty || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  /**
   * Generate vector embedding for a recipe using OpenAI
   */
  async generateEmbedding(recipe: Recipe): Promise<number[] | null> {
    try {
      // Check cache first
      const cacheKey = recipe.id || this.generateEmbeddingText(recipe)
      if (this.cache.has(cacheKey)) {
        console.log(`📦 Using cached embedding for: ${recipe.title}`)
        return this.cache.get(cacheKey)!
      }

      if (!config.openaiApiKey) {
        console.error('❌ OpenAI API key missing')
        return null
      }

      const embeddingText = this.generateEmbeddingText(recipe)
      
      if (!embeddingText) {
        console.warn('⚠️ Empty embedding text for recipe:', recipe.title)
        return null
      }

      console.log(`🔮 Generating embedding for: ${recipe.title}`)
      console.log(`📝 Embedding text length: ${embeddingText.length} chars`)

      const response = await fetch(OPENAI_EMBEDDINGS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: embeddingText,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ Embedding API error:', error)
        throw new Error(error.error?.message || 'Failed to generate embedding')
      }

      const data: EmbeddingResponse = await response.json()
      const embedding = data.data[0]?.embedding

      if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error('Invalid embedding dimensions')
      }

      // Cache the embedding
      this.cache.set(cacheKey, embedding)

      console.log(`✅ Generated embedding (${embedding.length} dimensions)`)
      return embedding
    } catch (error) {
      console.error('❌ Error generating embedding:', error)
      return null
    }
  }

  /**
   * Generate embedding for a query string (used for semantic search)
   */
  async generateQueryEmbedding(query: string): Promise<number[] | null> {
    try {
      if (!config.openaiApiKey) {
        console.error('❌ OpenAI API key missing')
        return null
      }

      const response = await fetch(OPENAI_EMBEDDINGS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: query,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error?.message || 'Failed to generate query embedding')
      }

      const data: EmbeddingResponse = await response.json()
      return data.data[0]?.embedding || null
    } catch (error) {
      console.error('❌ Error generating query embedding:', error)
      return null
    }
  }

  /**
   * Save embedding to database for a recipe
   */
  async saveEmbedding(recipeId: string, embedding: number[]): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('update_recipe_embeddings_batch', {
        recipe_ids: [recipeId],
        embeddings: [embedding],
      })

      if (error) {
        // Fallback: direct update if RPC doesn't exist
        const { error: updateError } = await supabase
          .from('recipes')
          .update({ embedding: `[${embedding.join(',')}]` })
          .eq('id', recipeId)

        if (updateError) throw updateError
      }

      console.log(`💾 Saved embedding for recipe: ${recipeId}`)
      return true
    } catch (error) {
      console.error('❌ Error saving embedding:', error)
      return false
    }
  }

  /**
   * Generate and save embedding for a recipe
   */
  async generateAndSaveEmbedding(recipe: Recipe): Promise<boolean> {
    try {
      const embedding = await this.generateEmbedding(recipe)
      if (!embedding) return false

      if (!recipe.id) {
        console.error('❌ Recipe missing ID')
        return false
      }

      return await this.saveEmbedding(recipe.id, embedding)
    } catch (error) {
      console.error('❌ Error in generateAndSaveEmbedding:', error)
      return false
    }
  }

  /**
   * Batch generate embeddings for multiple recipes
   */
  async generateEmbeddingsBatch(recipes: Recipe[]): Promise<number> {
    let successCount = 0

    for (const recipe of recipes) {
      try {
        const success = await this.generateAndSaveEmbedding(recipe)
        if (success) successCount++

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`❌ Error processing recipe ${recipe.title}:`, error)
      }
    }

    console.log(`✅ Generated ${successCount}/${recipes.length} embeddings`)
    return successCount
  }

  /**
   * Search recipes using semantic similarity
   */
  async searchRecipesByQuery(
    query: string,
    options: {
      limit?: number
      threshold?: number
      allergies?: string[]
      dietary?: string[]
      mealType?: string
      cuisine?: string
    } = {}
  ): Promise<Recipe[]> {
    try {
      const {
        limit = 10,
        threshold = 0.7,
        allergies = [],
        dietary = [],
        mealType,
        cuisine,
      } = options

      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query)
      if (!queryEmbedding) {
        console.error('❌ Failed to generate query embedding')
        return []
      }

      // Call Supabase function for semantic search
      const { data, error } = await supabase.rpc('search_recipes_by_embedding', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        filter_allergies: allergies,
        filter_dietary: dietary,
        filter_meal_type: mealType || null,
        filter_cuisine: cuisine || null,
      })

      if (error) {
        console.error('❌ Semantic search error:', error)
        // Fallback to text search if vector search fails
        return this.fallbackTextSearch(query, limit)
      }

      return (data || []).map((r: any) => ({
        ...r,
        similarity: r.similarity,
      }))
    } catch (error) {
      console.error('❌ Error in searchRecipesByQuery:', error)
      return this.fallbackTextSearch(query, options.limit || 10)
    }
  }

  /**
   * Fallback to text search if vector search fails
   */
  private async fallbackTextSearch(query: string, limit: number): Promise<Recipe[]> {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('is_public', true)
        .textSearch('title', query, { type: 'websearch' })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Fallback text search error:', error)
      return []
    }
  }
}

export const recipeEmbeddingService = RecipeEmbeddingService.getInstance()
export default recipeEmbeddingService

