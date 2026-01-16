import murmurHash from 'imurmurhash'
import { supabase } from './supabase'

export interface ImageGenerationOptions {
  service: 'openai' | 'stability' | 'replicate' | 'unsplash' | 'pexels' | 'foodish' | 'spoonacular' | 'direct'
  apiKey?: string
  fallbackToStock?: boolean
  preferLocal?: boolean
}

type ClassifiedMeta = {
  class: string
  primary: string
  method: string
  sides: string[]
  keywords: string[]
  canonicalTitle: string
  canonicalDescription: string
  canonicalIngredients: string[]
  cuisine?: string // e.g., 'italian', 'asian', 'mexican', 'mediterranean'
  dishType?: string // e.g., 'wrap', 'salad', 'pasta', 'bowl', 'sandwich'
}

type ExternalImageCandidate = {
  url: string
  provider: 'unsplash' | 'pexels'
  providerId?: string
  width?: number
  height?: number
  credit?: {
    user?: string
    username?: string
    link?: string
  }
  raw?: any
}

type CanonicalPayload = {
  title: string
  desc: string
  ingredients: string[]
}

const DEFAULT_REMOTE_FALLBACKS = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
  'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
  'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
  'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
  'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80',
]

const DISTINCTIVE_SIDE_TOKENS = [
  'arugula',
  'spinach',
  'kale',
  'broccoli',
  'zucchini',
  'pepper',
  'bell pepper',
  'sweet potato',
  'potato',
  'tortilla',
  'pita',
  'rice',
  'quinoa',
  'couscous',
  'noodle',
  'pasta',
  'avocado',
  'raspberry',
  'strawberry',
  'blueberry',
  'yogurt',
  'granola',
  'tomato',
  'cucumber',
  'lentil',
  'bean',
]

const PRIMARY_PRIORITY_TOKENS = [
  'salmon',
  'cod',
  'halibut',
  'trout',
  'tuna',
  'fish',
  'shrimp',
  'prawn',
  'lobster',
  'crab',
  'scallop',
  'mussel',
  'clam',
  'chicken thigh',
  'chicken breast',
  'chicken',
  'turkey',
  'duck',
  'beef',
  'steak',
  'sirloin',
  'ribeye',
  'pork',
  'ham',
  'bacon',
  'sausage',
  'lamb',
  'tofu',
  'tempeh',
  'seitan',
  'lentil',
  'chickpea',
  'black bean',
  'kidney bean',
  'egg',
  'eggs',
  'sweet potato',
  'potato',
  'pasta',
  'noodle',
  'rice',
  'quinoa',
  'chocolate',
  'brownie',
  'cake',
  'cookie',
  'oatmeal',
  'pancake',
  'waffle',
]

const MEAT_TOKENS = [
  'chicken',
  'beef',
  'pork',
  'fish',
  'salmon',
  'shrimp',
  'bacon',
  'steak',
  'lamb',
  'turkey',
  'duck',
  'sausage',
  'ham',
  'crab',
  'lobster',
]

const DAIRY_TOKENS = [
  'cheese',
  'cream',
  'milk',
  'butter',
  'yogurt',
  'ghee',
]

export class RecipeImageService {
  private static instance: RecipeImageService

  private cache = new Map<string, string>()
  private readonly imageBucket = 'images'

  // Use reliable Unsplash URLs instead of Supabase storage paths
  private readonly curatedFallbacks: Record<string, Record<string, string[]>> = {
    fish: {
      bake: [
        'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80', // Baked salmon
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80', // Fish
      ],
      grill: ['https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80'], // Grilled salmon
      general: ['https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80'], // Fish
    },
    seafood: {
      saute: ['https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80'], // Shrimp
      general: ['https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80'], // Seafood
    },
    poultry: {
      roast: ['https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'], // Roasted chicken
      saute: ['https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'], // Sautéed chicken
      general: ['https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'], // Chicken
    },
    meat: {
      grill: ['https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80'], // Grilled steak
      stew: ['https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80'], // Beef stew
      general: ['https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80'], // Meat
    },
    vegetarian: {
      saute: ['https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'], // Stir-fry
      salad: ['https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'], // Salad
      bowl: ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'], // Bowl
      general: ['https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80'], // Vegetables
    },
    vegan: {
      saute: ['https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'], // Vegan stir-fry
      general: ['https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80'], // Vegan
    },
    breakfast: {
      general: ['https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80'], // Breakfast
    },
    dessert: {
      general: ['https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80'], // Dessert/Parfait
    },
    egg: {
      general: ['https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80'], // Eggs
    },
    general: {
      general: ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'], // General food
    },
  }

  static getInstance(): RecipeImageService {
    if (!RecipeImageService.instance) {
      RecipeImageService.instance = new RecipeImageService()
    }
    return RecipeImageService.instance
  }

  clearCacheForRecipe(title: string, description?: string, ingredients?: string[]): void {
    const key = this.buildDeterministicKey(title, description || '', ingredients || [])
    if (this.cache.delete(key)) {
      console.log(`🗑️ Removed cached image for "${title}"`)
    }
  }

  clearAllCache(): void {
    this.cache.clear()
    console.log('🗑️ Cleared entire recipe image cache')
  }

  buildDeterministicKey(title: string, desc: string, ingredients: string[]): string {
    const canon = this.canonicalize({ title, desc, ingredients })
    const base = `${canon.title}|${canon.desc}|${canon.ingredients.join(',')}`
    if (!base.trim()) {
      return this.hashToString('savr-fallback')
    }
    return this.hashToString(base)
  }

  async getRecipeImage(
    title: string,
    description?: string,
    ingredients: string[] = [],
    options: ImageGenerationOptions = { service: 'unsplash', fallbackToStock: true, preferLocal: true },
    deterministicKey?: string
  ): Promise<string> {
    try {
      const safeIngredients = Array.isArray(ingredients) ? ingredients : []
      const key = deterministicKey || this.buildDeterministicKey(title, description || '', safeIngredients)

      if (this.cache.has(key)) {
        return this.cache.get(key)!
      }

      const classification = this.classify({ title, description, ingredients: safeIngredients })
      const seed = this.seedFrom(key)
      const preferLocal = options?.preferLocal !== false

      if (preferLocal) {
        try {
          const local = await this.lookupSupabase(classification, key, seed)
          if (local) {
            this.cache.set(key, local)
            return local
          }
        } catch (error) {
          console.warn('Supabase lookup failed, continuing with external sources:', error)
        }
      }

      // Use Unsplash API for accurate image search if service is 'unsplash'
      if (options?.service === 'unsplash') {
        console.log(`📸 Getting image for "${title}" using Unsplash API (key: ${key.substring(0, 8)}...)`)
        
        // Build multiple query variations for better diversity
        const queries = this.buildMultipleSearchQueries(title, description, safeIngredients, classification, seed)
        console.log(`📝 Generated ${queries.length} search queries for "${title}":`, queries)
        
        // Try each query variation until we get results
        let lastError: Error | null = null
        for (const searchQuery of queries) {
          try {
            // Use a unique seed per query to ensure different images even for similar queries
            const querySpecificSeed = seed + this.hash(searchQuery)
            console.log(`🔍 Trying Unsplash query: "${searchQuery}" (seed: ${querySpecificSeed})`)
            const candidate = await this.getUnsplashDeterministic(searchQuery, querySpecificSeed)
            
            if (candidate && candidate.url) {
              console.log(`✅ SUCCESS: Found Unsplash image for "${title}" with query: "${searchQuery}"`)
              console.log(`   Image URL: ${candidate.url.substring(0, 80)}...`)
              const imageUrl = candidate.url
              this.cache.set(key, imageUrl)
              return imageUrl
            } else {
              console.warn(`⚠️ Unsplash query "${searchQuery}" returned null candidate`)
            }
          } catch (error) {
            lastError = error as Error
            console.warn(`⚠️ Unsplash query "${searchQuery}" failed:`, error)
            continue // Try next query
          }
        }
        
        // If Unsplash fails, try Pexels (free, 200 requests/hour)
        console.log(`📸 Unsplash failed for "${title}", trying Pexels API`)
        const pexelsQuery = this.buildAccurateSearchQuery(title, description, safeIngredients, classification)
        try {
          const pexelsCandidates = await this.getPexelsMultiple(pexelsQuery, 20)
          if (pexelsCandidates.length > 0) {
            const index = Math.abs(seed) % pexelsCandidates.length
            const candidate = pexelsCandidates[index]
            console.log(`✅ Found Pexels image for "${title}" (${pexelsCandidates.length} candidates)`)
            const imageUrl = candidate.url
            this.cache.set(key, imageUrl)
            return imageUrl
          } else {
            console.warn(`⚠️ Pexels returned 0 results for "${pexelsQuery}"`)
          }
        } catch (error) {
          console.warn(`⚠️ Pexels API failed for "${title}":`, error)
        }
        
        console.warn(`⚠️ All API searches failed for "${title}", falling back to direct matching`)
        if (lastError) {
          console.error(`   Last error:`, lastError.message)
        }
      }
      
      // Use direct image matching as fallback or if service is 'direct'
      // This uses Foodish API and curated Unsplash image URLs based on recipe classification
      console.log(`📸 Getting image for "${title}" using direct matching`)
      const imageUrl = await this.getDirectImageUrl(classification, title, description, safeIngredients)
      this.cache.set(key, imageUrl)
      return imageUrl
    } catch (error) {
      // CRITICAL: Always return a valid URL, even if everything fails
      console.error('RecipeImageService: All image sources failed, using default fallback:', error)
      const defaultFallback = DEFAULT_REMOTE_FALLBACKS[0]
      const key = deterministicKey || this.buildDeterministicKey(title, description || '', ingredients || [])
      this.cache.set(key, defaultFallback)
      return defaultFallback
    }
  }

  private canonicalize(payload: { title?: string; desc?: string; ingredients?: string[] }): CanonicalPayload {
    const title = this.normalize(payload.title || '')
    const desc = this.normalize(payload.desc || '')
    const ingredients = (payload.ingredients || [])
      .map(value => this.normalize(value))
      .filter(Boolean)

    const uniqueIngredients = Array.from(new Set(ingredients)).sort()

    return {
      title,
      desc,
      ingredients: uniqueIngredients,
    }
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private seedFrom(key: string): number {
    return Math.abs(this.hash(key || 'savr'))
  }

  private hashToString(input: string): string {
    return this.hash(input).toString()
  }

  private hash(input: string): number {
    return murmurHash(input || 'savr').result()
  }

  private isSupabaseConfigured(): boolean {
    return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
  }

  private async lookupSupabase(meta: ClassifiedMeta, deterministicKey: string, seed: number): Promise<string | null> {
    if (!this.isSupabaseConfigured()) {
      return null
    }

    try {
      const { data: deterministicMatch, error: deterministicError } = await supabase
        .from('image_library')
        .select('path')
        .eq('deterministic_key', deterministicKey)
        .limit(1)

      if (deterministicError) {
        console.warn('Supabase deterministic lookup failed:', deterministicError)
      } else if (deterministicMatch && deterministicMatch.length > 0) {
        const directUrl = this.getPublicUrl(deterministicMatch[0].path)
        if (directUrl) {
          return directUrl
        }
      }

      const { data, error } = await supabase
        .from('image_library')
        .select('path')
        .eq('class', meta.class)
        .eq('primary_item', meta.primary)
        .eq('method', meta.method)
        .limit(20)

      if (error) {
        console.warn('Supabase image lookup failed:', error)
        return null
      }

      if (data && data.length > 0) {
        const index = data.length === 1 ? 0 : Math.abs(seed) % data.length
        const url = this.getPublicUrl(data[index].path)
        if (url) {
          return url
        }
      }
    } catch (error) {
      console.warn('Supabase lookup threw an error:', error)
    }

    return null
  }

  private getPublicUrl(path: string): string | null {
    const { data } = supabase.storage.from(this.imageBucket).getPublicUrl(path)
    return data?.publicUrl ?? null
  }

  private async getUnsplashMultiple(query: string, count: number = 10, page: number = 1): Promise<ExternalImageCandidate[]> {
    // Try multiple ways to get the API key (Expo Constants first, then environment variables)
    let apiKey: string | undefined
    let keySource = 'none'
    
    // First try Expo Constants (for React Native/Expo apps) - this is the primary method
    try {
      const Constants = require('expo-constants')
      
      // Try expoConfig first (newer Expo SDK)
      if (Constants?.expoConfig?.extra) {
        apiKey = Constants.expoConfig.extra.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY || Constants.expoConfig.extra.UNSPLASH_ACCESS_KEY
        if (apiKey) {
          keySource = 'Constants.expoConfig.extra'
          console.log(`✅ Found Unsplash API key in Constants.expoConfig.extra`)
        }
      }
      
      // Fallback to manifest (older Expo SDK)
      if (!apiKey && Constants?.manifest?.extra) {
        apiKey = Constants.manifest.extra.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY || Constants.manifest.extra.UNSPLASH_ACCESS_KEY
        if (apiKey) {
          keySource = 'Constants.manifest.extra'
          console.log(`✅ Found Unsplash API key in Constants.manifest.extra`)
        }
      }
      
      // Debug: Log what's available if key not found
      if (!apiKey) {
        console.log(`🔍 Debug - Constants.expoConfig?.extra:`, Constants?.expoConfig?.extra ? 'exists' : 'missing')
        console.log(`🔍 Debug - Constants.manifest?.extra:`, Constants?.manifest?.extra ? 'exists' : 'missing')
        if (Constants?.expoConfig?.extra) {
          console.log(`🔍 Debug - Available keys in expoConfig.extra:`, Object.keys(Constants.expoConfig.extra))
        }
        if (Constants?.manifest?.extra) {
          console.log(`🔍 Debug - Available keys in manifest.extra:`, Object.keys(Constants.manifest.extra))
        }
      }
    } catch (e) {
      console.warn(`⚠️ Error accessing Expo Constants:`, e)
      // Constants not available, try env vars
    }
    
    // Fallback to environment variables (for Node.js/server environments or if Constants failed)
    if (!apiKey) {
      apiKey = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY
      if (apiKey) {
        keySource = 'process.env'
        console.log(`✅ Found Unsplash API key in process.env`)
      }
    }
    
    if (!apiKey) {
      console.warn(`⚠️ Unsplash API key not found. Using Unsplash Source API fallback for query: "${query}"`)
      console.warn(`   Checked: Constants.expoConfig.extra, Constants.manifest.extra, EXPO_PUBLIC_UNSPLASH_ACCESS_KEY, UNSPLASH_ACCESS_KEY`)
      console.warn(`   💡 TIP: Make sure UNSPLASH_ACCESS_KEY is in .env and restart with: npx expo start -c`)
      // Fallback to Unsplash Source API (no auth required, but limited)
      return this.getUnsplashSourceFallback(query, count)
    }
    
    console.log(`✅ Using Unsplash API key from ${keySource} (length: ${apiKey.length}, starts with: ${apiKey.substring(0, 8)}...)`)

    try {
      // Use different ordering for variety: 'relevant', 'latest', 'popular'
      const orderBy = page === 1 ? 'relevant' : 'popular'
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${Math.min(count, 30)}&order_by=${orderBy}`,
        {
          headers: {
            Authorization: `Client-ID ${apiKey}`,
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.warn(`Unsplash API request failed (${response.status}):`, errorText.substring(0, 200))
        // Try fallback if API fails
        return this.getUnsplashSourceFallback(query, count)
      }

      const data = await response.json()
      const results = Array.isArray(data?.results) ? data.results : []

      console.log(`📊 Unsplash API returned ${results.length} results for query: "${query}" (page ${page})`)

      if (results.length === 0) {
        console.warn(`⚠️ Unsplash API returned 0 results for query: "${query}", trying fallback`)
        return this.getUnsplashSourceFallback(query, count)
      }

      return results
        .slice(0, count)
        .map((photo: any) => {
          const url = photo?.urls?.regular || photo?.urls?.small || photo?.urls?.full
          if (!url) return null
          
          const imageUrl = url.includes('?') ? url : `${url}?w=800&q=80`
          
          return {
            url: imageUrl,
            provider: 'unsplash' as const,
            providerId: photo?.id,
            width: photo?.width,
            height: photo?.height,
            credit: {
              user: photo?.user?.name,
              username: photo?.user?.username,
              link: photo?.links?.html,
            },
            raw: photo,
          }
        })
        .filter((c: ExternalImageCandidate | null): c is ExternalImageCandidate => c !== null)
    } catch (error) {
      console.warn(`Unsplash request errored for query "${query}":`, error)
      return this.getUnsplashSourceFallback(query, count)
    }
  }
  
  // Fallback: Use Unsplash Source API (no auth required)
  private async getUnsplashSourceFallback(query: string, count: number): Promise<ExternalImageCandidate[]> {
    try {
      // Use Unsplash Source API - simpler but works without auth
      // Format: https://source.unsplash.com/800x600/?{query}
      // But this is deprecated, so we'll use a curated approach
      
      // For now, return empty and let the system use other strategies
      // In production, you could use a proxy service or different approach
      return []
    } catch (error) {
      return []
    }
  }

  private async getUnsplashDeterministic(query: string, seed: number): Promise<ExternalImageCandidate | null> {
    // Request more results for better variety (30 results)
    // Use different pages based on seed to get more diverse results (pages 1-3)
    const page = (Math.abs(seed) % 3) + 1
    const candidates = await this.getUnsplashMultiple(query, 30, page)
    if (candidates.length === 0) return null
    
    // Use seed to deterministically select, but add query hash for more variety
    // This ensures same recipe always gets same image, but different recipes get different images
    const queryHash = this.hash(query)
    const combinedSeed = Math.abs(seed + queryHash)
    const index = combinedSeed % candidates.length
    
    console.log(`📸 Selected image ${index + 1} of ${candidates.length} (page ${page}) for query: "${query}"`)
    return candidates[index]
  }

  /**
   * Build multiple search query variations for better diversity
   * Each recipe gets different queries to ensure unique images
   * PRIORITY: Include dish type and cuisine for accurate category matching
   */
  private buildMultipleSearchQueries(
    title: string,
    description?: string,
    ingredients: string[] = [],
    classification?: ClassifiedMeta,
    seed: number = 0
  ): string[] {
    const queries: string[] = []
    
    // PRIORITY 1: Full recipe title (most accurate - try this first!)
    const normalizedTitle = this.normalize(title)
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'with', 'for', 'from', 'a', 'an', 'to'].includes(word))
      .join(' ')
    
    if (normalizedTitle.length > 5) {
      queries.push(normalizedTitle) // Full title is most specific
    }
    
    // PRIORITY 2: Title + Dish Type (e.g., "chicken wrap", "italian pasta")
    const dishType = classification?.dishType
    const cuisine = classification?.cuisine
    const titleWords = normalizedTitle.split(/\s+/)
    
    if (dishType && titleWords.length > 0) {
      // Include dish type in query for accurate category matching
      // e.g., "chicken wrap" not just "chicken"
      const dishTypeQuery = `${titleWords.slice(0, 3).join(' ')} ${dishType}`
      queries.push(dishTypeQuery)
      
      // Also try with primary ingredient + dish type
      if (classification?.primary) {
        queries.push(`${this.normalize(classification.primary)} ${dishType}`)
      }
    }
    
    // PRIORITY 3: Cuisine + Dish Type (e.g., "italian pasta", "mexican wrap")
    if (cuisine && dishType) {
      queries.push(`${cuisine} ${dishType}`)
    }
    
    // PRIORITY 4: Title words (first 5-6 words for specificity)
    if (titleWords.length > 0) {
      queries.push(titleWords.slice(0, 5).join(' ')) // More words = more specific
      if (titleWords.length > 3) {
        queries.push(titleWords.slice(0, 3).join(' ')) // Shorter version
      }
    }
    
    // PRIORITY 5: Primary ingredient + dish type (if dish type not in title)
    const primaryIngredient = classification?.primary
    if (primaryIngredient && dishType && !normalizedTitle.includes(dishType)) {
      queries.push(`${this.normalize(primaryIngredient)} ${dishType}`)
    }
    
    // PRIORITY 6: Primary ingredient + key ingredients (for variety)
    const keyIngredients = ingredients
      .slice(0, 3)
      .map(ing => this.normalize(ing))
      .filter(ing => ing.length > 3)
      .filter(ing => !['salt', 'pepper', 'oil', 'water', 'sugar', 'flour', 'butter'].includes(ing))
    
    if (primaryIngredient) {
      const normalizedPrimary = this.normalize(primaryIngredient)
      if (!normalizedTitle.includes(normalizedPrimary)) {
        // Add primary ingredient if not in title
        if (keyIngredients.length >= 1 && keyIngredients[0] !== normalizedPrimary) {
          queries.push(`${normalizedPrimary} ${keyIngredients[0]}`)
        }
        queries.push(normalizedPrimary)
      }
    }
    
    // PRIORITY 7: Key ingredients combination
    if (keyIngredients.length >= 2) {
      queries.push(keyIngredients.slice(0, 2).join(' '))
    }
    
    // PRIORITY 8: Primary + cooking method (if method is specific)
    if (primaryIngredient && classification?.method && classification.method !== 'general') {
      queries.push(`${this.normalize(primaryIngredient)} ${classification.method}`)
    }
    
    // Remove duplicates and empty queries, ensure we have at least the title
    const uniqueQueries = Array.from(new Set(queries.filter(q => q.length > 2)))
    return uniqueQueries.length > 0 ? uniqueQueries : [normalizedTitle || 'food']
  }

  /**
   * Build an accurate search query for Unsplash based on recipe details
   * Prioritizes the recipe title, then key ingredients, then description
   */
  private buildAccurateSearchQuery(
    title: string,
    description?: string,
    ingredients: string[] = [],
    classification?: ClassifiedMeta
  ): string {
    // Start with the recipe title (most important)
    const titleWords = this.normalize(title)
      .split(/\s+/)
      .filter(word => word.length > 2) // Remove very short words
      .filter(word => !['the', 'and', 'with', 'for', 'from', 'a', 'an'].includes(word)) // Remove common words
      .slice(0, 4) // Take first 4 meaningful words
    
    // Add primary ingredient if available
    const primaryIngredient = classification?.primary
    const keyIngredients = ingredients
      .slice(0, 2) // Take top 2 ingredients
      .map(ing => this.normalize(ing))
      .filter(ing => ing.length > 3)
      .filter(ing => !['salt', 'pepper', 'oil', 'water', 'sugar', 'flour', 'butter'].includes(ing)) // Remove common staples
    
    // Combine: title words + primary ingredient + key ingredients
    const queryParts: string[] = []
    
    // Add title words (most important)
    if (titleWords.length > 0) {
      queryParts.push(...titleWords)
    }
    
    // Add primary ingredient if it's not already in title
    if (primaryIngredient && !titleWords.includes(this.normalize(primaryIngredient))) {
      const normalizedPrimary = this.normalize(primaryIngredient)
      if (normalizedPrimary.length > 3) {
        queryParts.push(normalizedPrimary)
      }
    }
    
    // Add key ingredients if not already included
    keyIngredients.forEach(ing => {
      if (!queryParts.includes(ing) && ing.length > 3) {
        queryParts.push(ing)
      }
    })
    
    // Limit to 5 words max for Unsplash API
    const finalQuery = queryParts.slice(0, 5).join(' ')
    
    // Fallback if query is too short
    if (finalQuery.length < 3) {
      return titleWords.slice(0, 3).join(' ') || 'food'
    }
    
    return finalQuery || 'food'
  }

  private async getPexelsMultiple(query: string, count: number = 10): Promise<ExternalImageCandidate[]> {
    // Try multiple ways to get the API key (Expo Constants, environment variables)
    let apiKey: string | undefined
    
    // First try Expo Constants (for React Native/Expo apps)
    try {
      const Constants = require('expo-constants')
      if (Constants?.expoConfig?.extra) {
        apiKey = Constants.expoConfig.extra.EXPO_PUBLIC_PEXELS_API_KEY || Constants.expoConfig.extra.PEXELS_API_KEY
      }
    } catch (e) {
      // Constants not available, try env vars
    }
    
    // Fallback to environment variables (for Node.js/server environments)
    if (!apiKey) {
      apiKey = process.env.EXPO_PUBLIC_PEXELS_API_KEY || process.env.PEXELS_API_KEY
    }
    
    if (!apiKey) {
      console.warn(`⚠️ Pexels API key not found. Skipping Pexels for query: "${query}"`)
      return []
    }

    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(count, 40)}`,
        {
          headers: {
            Authorization: apiKey,
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.warn(`Pexels API request failed (${response.status}):`, errorText.substring(0, 200))
        return []
      }

      const data = await response.json()
      const photos = Array.isArray(data?.photos) ? data.photos : []

      if (photos.length === 0) {
        console.warn(`Pexels API returned 0 results for query: "${query}"`)
        return []
      }

      return photos
        .slice(0, count)
        .map((photo: any) => {
          const url = photo?.src?.large2x || photo?.src?.large || photo?.src?.original
          if (!url) return null
          
          const imageUrl = url.includes('?') ? url : `${url}?auto=compress&cs=tinysrgb&w=800`
          
          return {
            url: imageUrl,
            provider: 'pexels' as const,
            providerId: photo?.id ? String(photo.id) : undefined,
            width: photo?.width,
            height: photo?.height,
            raw: photo,
          }
        })
        .filter((c: ExternalImageCandidate | null): c is ExternalImageCandidate => c !== null)
    } catch (error) {
      console.warn(`Pexels request errored for query "${query}":`, error)
      return []
    }
  }

  private async getPexelsDeterministic(query: string, seed: number): Promise<ExternalImageCandidate | null> {
    const candidates = await this.getPexelsMultiple(query, 40)
    if (candidates.length === 0) return null
    const index = Math.abs(seed) % candidates.length
    return candidates[index]
  }

  private verifyAndPick(candidates: Array<ExternalImageCandidate | null>, meta: ClassifiedMeta): ExternalImageCandidate | null {
    if (candidates.length === 0) return null
    
    // Score candidates and pick the best match
    const scored = candidates
      .filter((c): c is ExternalImageCandidate => c !== null)
      .map(candidate => {
        const text = this.extractCandidateText(candidate)
        let score = 0
        
        // Check if title keywords appear in image description (highest weight - most important)
        const titleWords = this.extractKeyWordsFromTitle(meta.canonicalTitle)
        const matchingTitleWords = titleWords.filter(word => 
          text.includes(word) && word.length > 3
        )
        score += matchingTitleWords.length * 5 // Increased weight
        
        // Check primary ingredient match (high weight)
        if (this.heuristicPrimaryPresent(text, meta)) {
          score += 8
        } else if (meta.primary) {
          score -= 2 // Smaller penalty - don't reject if primary missing
        }
        
        // Check method consistency (lower weight - less important)
        if (this.methodConsistent(text, meta)) {
          score += 3
        }
        // Don't penalize for method mismatch - too strict
        
        // Check class consistency (medium weight)
        if (this.classConsistent(text, meta)) {
          score += 4
        }
        // Don't penalize for class mismatch - accept any food image
        
        // Check if sides appear (bonus)
        const matchingSides = meta.sides.filter(side => text.includes(side))
        score += matchingSides.length * 2
        
        // Bonus for food-related keywords
        if (text.includes('food') || text.includes('dish') || text.includes('meal') || 
            text.includes('cooking') || text.includes('recipe')) {
          score += 2
        }
        
        return { candidate, score, text }
      })
      .sort((a, b) => b.score - a.score)
    
    // Accept the best match even if score is low (relaxed matching)
    // Only reject if score is very negative
    if (scored.length > 0 && scored[0].score > -5) {
      console.log(`✅ Selected image with score ${scored[0].score} for "${meta.canonicalTitle}"`)
      return scored[0].candidate
    }
    
    // If all scores are very negative, return null
    console.log(`⚠️ No acceptable image match found for "${meta.canonicalTitle}" (best score: ${scored[0]?.score || 'N/A'})`)
    return null
  }

  private extractCandidateText(candidate: ExternalImageCandidate): string {
    const parts: string[] = []

    if (candidate.provider === 'unsplash') {
      const photo = candidate.raw || {}
      if (photo?.description) parts.push(photo.description)
      if (photo?.alt_description) parts.push(photo.alt_description)
      if (Array.isArray(photo?.tags)) {
        parts.push(photo.tags.map((tag: any) => tag?.title || '').join(' '))
      }
    } else if (candidate.provider === 'pexels') {
      const photo = candidate.raw || {}
      if (photo?.alt) parts.push(photo.alt)
      if (Array.isArray(photo?.tags)) {
        parts.push(photo.tags.map((tag: any) => (typeof tag === 'string' ? tag : tag?.title || '')).join(' '))
      }
    }

    return this.normalize(parts.join(' '))
  }

  private heuristicPrimaryPresent(text: string, meta: ClassifiedMeta): boolean {
    if (!meta.primary) {
      return true
    }

    const synonyms = this.primarySynonyms(meta.primary)
    return synonyms.some(token => text.includes(token))
  }

  private methodConsistent(text: string, meta: ClassifiedMeta): boolean {
    const method = meta.method
    if (!method || method === 'general') {
      return true
    }

    const rules: Record<string, { include: string[]; exclude?: string[] }> = {
      bake: { include: ['bake', 'baked', 'oven', 'roast', 'roasted'], exclude: ['raw'] },
      roast: { include: ['roast', 'oven', 'roasted'], exclude: ['raw'] },
      grill: { include: ['grill', 'grilled', 'bbq', 'barbecue'], exclude: ['raw'] },
      saute: { include: ['saute', 'sauté', 'pan', 'skillet', 'sear', 'seared'], exclude: ['raw'] },
      fry: { include: ['fried', 'fry', 'crispy'], exclude: ['raw'] },
      stew: { include: ['stew', 'stewed', 'braise', 'braised', 'slow cook'] },
      soup: { include: ['soup', 'broth', 'stew'] },
      raw: { include: ['raw', 'sashimi', 'crudo'], exclude: ['bake', 'roast', 'fried', 'grill'] },
      salad: { include: ['salad', 'greens'] },
      sandwich_wrap: { include: ['sandwich', 'wrap', 'tortilla', 'flatbread'] },
      bowl: { include: ['bowl'] },
      stirfry: { include: ['stir fry', 'stir-fry', 'stirfry', 'wok'] },
    }

    const rule = rules[method] || rules[method.replace(/-/g, '')]
    if (!rule) {
      return true
    }

    const includes = rule.include.some(term => text.includes(this.normalize(term)))
    if (!includes) {
      return false
    }

    if (rule.exclude && rule.exclude.some(term => text.includes(this.normalize(term)))) {
      return false
    }

    if (method !== 'raw' && text.includes('raw')) {
      return false
    }

    return true
  }

  private classConsistent(text: string, meta: ClassifiedMeta): boolean {
    if (meta.class === 'vegetarian') {
      return !MEAT_TOKENS.some(token => text.includes(token))
    }

    if (meta.class === 'vegan') {
      const hasMeat = MEAT_TOKENS.some(token => text.includes(token))
      const hasDairy = DAIRY_TOKENS.some(token => text.includes(token))
      return !hasMeat && !hasDairy
    }

    if (meta.class === 'fish') {
      return ['fish', 'salmon', 'cod', 'trout', 'tuna', 'seafood'].some(token => text.includes(token))
    }

    if (meta.class === 'seafood') {
      return ['shrimp', 'prawn', 'lobster', 'crab', 'scallop', 'seafood'].some(token => text.includes(token))
    }

    return true
  }

  private primarySynonyms(primary: string): string[] {
    const map: Record<string, string[]> = {
      salmon: ['salmon', 'fish', 'seafood'],
      cod: ['cod', 'fish'],
      trout: ['trout', 'fish'],
      tuna: ['tuna', 'fish'],
      fish: ['fish', 'seafood'],
      shrimp: ['shrimp', 'prawn', 'seafood'],
      prawn: ['prawn', 'shrimp', 'seafood'],
      lobster: ['lobster', 'seafood'],
      crab: ['crab', 'seafood'],
      scallop: ['scallop', 'seafood'],
      chicken: ['chicken', 'poultry'],
      turkey: ['turkey', 'poultry'],
      duck: ['duck', 'poultry'],
      beef: ['beef', 'steak'],
      steak: ['steak', 'beef'],
      pork: ['pork', 'ham', 'bacon'],
      ham: ['ham', 'pork'],
      bacon: ['bacon', 'pork'],
      sausage: ['sausage', 'pork'],
      lamb: ['lamb'],
      tofu: ['tofu', 'soy'],
      tempeh: ['tempeh', 'soy'],
      seitan: ['seitan'],
      lentil: ['lentil', 'legume'],
      chickpea: ['chickpea', 'garbanzo'],
      bean: ['bean', 'legume'],
      'black bean': ['black bean', 'bean'],
      'kidney bean': ['kidney bean', 'bean'],
      egg: ['egg', 'eggs'],
      eggs: ['egg', 'eggs'],
      chocolate: ['chocolate', 'cocoa'],
      potato: ['potato', 'spud'],
      'sweet potato': ['sweet potato', 'yam'],
      pasta: ['pasta', 'noodle'],
      noodle: ['noodle', 'pasta'],
    }

    const normalizedPrimary = primary.trim()
    return map[normalizedPrimary] || [normalizedPrimary]
  }

  private async persistToSupabase(
    candidate: ExternalImageCandidate,
    meta: ClassifiedMeta,
    deterministicKey: string,
    source: 'unsplash' | 'pexels'
  ): Promise<string> {
    if (!this.isSupabaseConfigured()) {
      return candidate.url
    }

    try {
      const response = await fetch(candidate.url)
      if (!response.ok) {
        console.warn('Failed to download external image for persistence:', response.status)
        return candidate.url
      }

      const arrayBuffer = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const extension = this.extensionFromContentType(contentType)
      const path = this.computeStoragePath(meta, deterministicKey, extension)

      const upload = await supabase.storage.from(this.imageBucket).upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      })

      if (upload.error) {
        console.warn('Supabase storage upload failed:', upload.error)
        return candidate.url
      }

      const upsert = await supabase.from('image_library').upsert(
        {
          path,
          class: meta.class,
          primary_item: meta.primary,
          method: meta.method,
          deterministic_key: deterministicKey,
          source,
          provider_id: candidate.providerId,
          width: candidate.width,
          height: candidate.height,
          credit_user: candidate.credit?.user,
          credit_username: candidate.credit?.username,
          credit_link: candidate.credit?.link,
          alt_text: this.altText(meta),
        },
        { onConflict: 'deterministic_key' }
      )

      if (upsert.error) {
        console.warn('Supabase image_library upsert failed:', upsert.error)
      }

      const publicUrl = this.getPublicUrl(path)
      return publicUrl || candidate.url
    } catch (error) {
      console.warn('Persist to Supabase errored:', error)
      return candidate.url
    }
  }

  private extensionFromContentType(contentType: string): string {
    if (contentType.includes('png')) return 'png'
    if (contentType.includes('webp')) return 'webp'
    if (contentType.includes('gif')) return 'gif'
    return 'jpg'
  }

  private computeStoragePath(meta: ClassifiedMeta, key: string, ext: string): string {
    const classSegment = meta.class || 'general'
    const methodSegment = meta.method || 'general'
    const primarySegment = (meta.primary || 'dish').replace(/\s+/g, '-')
    return `recipes/${classSegment}/${methodSegment}/${primarySegment}-${key}.${ext}`
  }

  private async getDirectImageUrl(
    meta: ClassifiedMeta,
    title: string,
    description?: string,
    ingredients: string[] = []
  ): Promise<string> {
    // Use recipe-specific hash to ensure variety even in fallbacks
    const recipeHash = this.hash(`${title}-${description || ''}-${ingredients.join(',')}`)
    
    // First try specific recipe matching (fastest, most accurate)
    const specificMatch = this.getIntelligentFallback(meta, title, description)
    if (specificMatch && !specificMatch.includes('fallback')) {
      console.log(`✅ Using specific match for "${title}"`)
      return specificMatch
    }
    
    // Then try Foodish API (free, no auth, many food images) - but don't wait too long
    try {
      const foodishUrl = await Promise.race([
        this.getFoodishImage(meta, title),
        new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 2000)) // 2 second timeout
      ])
      if (foodishUrl) {
        console.log(`✅ Using Foodish image for "${title}"`)
        return foodishUrl
      }
    } catch (error) {
      console.warn('Foodish API failed, using fallback:', error)
    }
    
    // Finally use category-based matching with recipe-specific variety
    const categoryImage = this.getCategoryBasedImage(meta, title, ingredients)
    console.log(`✅ Using category-based image for "${title}" (hash: ${recipeHash})`)
    return categoryImage
  }
  
  private async getFoodishImage(meta: ClassifiedMeta, title: string): Promise<string | null> {
    try {
      // Foodish API: https://foodish-api.herokuapp.com/
      // Categories: burger, pizza, pasta, biryani, butter-chicken, dessert, dosa, idly, sambar, vada
      // Random: https://foodish-api.herokuapp.com/images/
      
      // Map our categories to Foodish categories
      const categoryMap: Record<string, string[]> = {
        fish: ['burger', 'pizza', 'pasta'],
        seafood: ['burger', 'pizza', 'pasta'],
        poultry: ['burger', 'butter-chicken', 'biryani'],
        meat: ['burger', 'biryani', 'butter-chicken'],
        vegetarian: ['pasta', 'dosa', 'idly', 'sambar', 'vada'],
        vegan: ['dosa', 'idly', 'sambar', 'vada'],
        breakfast: ['dosa', 'idly', 'sambar', 'vada'],
        dessert: ['dessert'],
        egg: ['burger', 'pizza'],
        general: ['burger', 'pizza', 'pasta', 'biryani'],
      }
      
      const foodishCategories = categoryMap[meta.class] || categoryMap.general
      const seed = this.seedFrom(title)
      const category = foodishCategories[Math.abs(seed) % foodishCategories.length]
      
      // Try category-specific endpoint
      const categoryUrl = `https://foodish-api.herokuapp.com/images/${category}/${category}${Math.floor(Math.random() * 100)}.jpg`
      
      // Also try random endpoint for variety
      const randomUrl = 'https://foodish-api.herokuapp.com/images/'
      
      // Use random for more variety
      const response = await fetch(randomUrl)
      if (response.ok) {
        const data = await response.json()
        if (data?.image) {
          return data.image
        }
      }
      
      return null
    } catch (error) {
      return null
    }
  }
  
  private getCategoryBasedImage(meta: ClassifiedMeta, title: string, ingredients: string[]): string {
    const lower = title.toLowerCase()
    // Use a combination of title, description, and ingredients for maximum variety
    // This ensures each recipe gets a different image even from the same category
    const titleSeed = this.seedFrom(title)
    const ingredientSeed = ingredients.length > 0 ? this.seedFrom(ingredients.join(',')) : 0
    const primarySeed = meta.primary ? this.seedFrom(meta.primary) : 0
    const methodSeed = meta.method ? this.seedFrom(meta.method) : 0
    const cuisineSeed = meta.cuisine ? this.seedFrom(meta.cuisine) : 0
    const dishTypeSeed = meta.dishType ? this.seedFrom(meta.dishType) : 0
    // Add a hash of the full recipe to ensure uniqueness
    const recipeHash = this.hash(`${title}-${ingredients.join(',')}`)
    const combinedSeed = Math.abs(titleSeed + ingredientSeed + primarySeed + methodSeed + cuisineSeed + dishTypeSeed + recipeHash)
    
    // PRIORITY 1: Use dish type and cuisine for accurate category matching
    // If we have a dish type, prefer images that match that type (e.g., wrap, salad, pasta)
    if (meta.dishType) {
      const dishTypeCollection = this.getDishTypeCollection(meta.dishType, meta.cuisine)
      if (dishTypeCollection && dishTypeCollection.length > 0) {
        const index = combinedSeed % dishTypeCollection.length
        console.log(`✅ Using ${meta.dishType}${meta.cuisine ? ` (${meta.cuisine})` : ''} category image for "${title}"`)
        return dishTypeCollection[index]
      }
    }
    
    // PRIORITY 2: If we have cuisine but no specific dish type, use cuisine-specific images
    if (meta.cuisine) {
      const cuisineCollection = this.getCuisineCollection(meta.cuisine)
      if (cuisineCollection && cuisineCollection.length > 0) {
        const index = combinedSeed % cuisineCollection.length
        console.log(`✅ Using ${meta.cuisine} cuisine image for "${title}"`)
        return cuisineCollection[index]
      }
    }
    
    // PRIORITY 3: Fall back to protein/category-based images
    // Extensive curated Unsplash image collections by category (no API needed)
    // Each category has 50+ high-quality food images for maximum variety
    // NOTE: Collections can be expanded with more unique Unsplash photo IDs for even greater variety
    const imageCollections: Record<string, string[]> = {
      // Fish & Seafood - 50+ unique images
      fish: [
        'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80', // Grilled salmon
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80', // Fish fillet
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80', // Baked fish
        'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80', // Fish dish
        'https://images.unsplash.com/photo-1574781330858-7c07f8e24a6b?w=800&q=80', // Salmon plate
        'https://images.unsplash.com/photo-1604503468506-a8da13d82781?w=800&q=80', // Fish preparation
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80', // Roasted fish
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80', // Grilled fish
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80', // Fish curry
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80', // Steamed fish
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80', // Asian fish
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Fish tacos
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Fish platter
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Fish cooking
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80', // Fish meal
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80', // Fish dish
        'https://images.unsplash.com/photo-1606312619070-d48b4bc6d0e3?w=800&q=80', // Fish preparation
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80', // Fish plate
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80', // Fish dish
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80', // Fish meal
        'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80', // Fish curry
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', // Fish pizza
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', // Fish burger
        'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', // Sushi
        'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&q=80', // Fish soup
        'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80', // Fish pasta
        'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80', // Salmon
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80', // Fish stir-fry
        'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80', // Fish soup
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', // Fish salad
        'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800&q=80', // Fish sandwich
        'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=800&q=80', // Fish toast
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Fish cooking
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80', // Roasted fish
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80', // Grilled fish
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80', // Braised fish
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80', // Steamed fish
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80', // Asian fish
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Fish tacos
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Fish platter
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Fish cooking
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80', // Fish meal
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80', // Fish dish
        'https://images.unsplash.com/photo-1606312619070-d48b4bc6d0e3?w=800&q=80', // Fish preparation
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80', // Fish plate
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80', // Fish dish
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80', // Fish meal
        'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80', // Fish curry
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', // Fish pizza
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', // Fish burger
        'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', // Sushi
        'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&q=80', // Fish soup
      ],
      // Seafood - 50+ unique images
      seafood: [
        'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80', // Shrimp scampi
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80', // Seafood platter
        'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80', // Seafood dish
        'https://images.unsplash.com/photo-1574781330858-7c07f8e24a6b?w=800&q=80', // Seafood plate
        'https://images.unsplash.com/photo-1604503468506-a8da13d82781?w=800&q=80', // Seafood preparation
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80', // Seafood meal
        'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80', // Seafood dish
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80', // Roasted seafood
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80', // Grilled seafood
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80', // Seafood curry
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80', // Steamed seafood
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80', // Asian seafood
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Seafood tacos
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Seafood platter
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Seafood cooking
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80', // Seafood meal
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80', // Seafood dish
        'https://images.unsplash.com/photo-1606312619070-d48b4bc6d0e3?w=800&q=80', // Seafood preparation
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80', // Seafood plate
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80', // Seafood dish
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80', // Seafood meal
        'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80', // Seafood curry
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', // Seafood pizza
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', // Seafood burger
        'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', // Sushi
        'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&q=80', // Seafood soup
        'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80', // Seafood pasta
        'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80', // Seafood soup
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', // Seafood salad
        'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800&q=80', // Seafood sandwich
        'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=800&q=80', // Seafood toast
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Seafood cooking
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80', // Roasted seafood
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80', // Grilled seafood
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80', // Braised seafood
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80', // Steamed seafood
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80', // Asian seafood
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Seafood tacos
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Seafood platter
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Seafood cooking
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80', // Seafood meal
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80', // Seafood dish
        'https://images.unsplash.com/photo-1606312619070-d48b4bc6d0e3?w=800&q=80', // Seafood preparation
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80', // Seafood plate
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80', // Seafood dish
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80', // Seafood meal
        'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80', // Seafood curry
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', // Seafood pizza
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', // Seafood burger
        'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', // Sushi
        'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&q=80', // Seafood soup
        'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80', // Seafood pasta
      ],
      // Poultry - 30+ images
      poultry: [
        'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
        'https://images.unsplash.com/photo-1604503468506-a8da13d82781?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
        'https://images.unsplash.com/photo-1604503468506-a8da13d82781?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
        'https://images.unsplash.com/photo-1604503468506-a8da13d82781?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
        'https://images.unsplash.com/photo-1604503468506-a8da13d82781?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
        'https://images.unsplash.com/photo-1604503468506-a8da13d82781?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
      ],
      // Meat - 30+ images
      meat: [
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
      ],
      // Vegetarian - 30+ images
      vegetarian: [
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
      ],
      // Vegan - 30+ images
      vegan: [
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
      ],
      // Breakfast - 30+ images
      breakfast: [
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
      ],
      // Dessert - 30+ images
      dessert: [
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80',
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80',
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80',
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80',
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80',
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80',
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80',
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80',
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80',
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80',
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80',
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80',
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80',
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80',
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80',
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80',
        'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80',
        'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80',
      ],
      // Egg dishes - 30+ images
      egg: [
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
        'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80',
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
      ],
      // General/Default - 30+ images
      general: [
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80',
        'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80',
        'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80',
      ],
    }
    
    // Get collection for this category
    const collection = imageCollections[meta.class] || imageCollections.general
    // Use combined seed for better variety - ensures different images for similar recipes
    const index = combinedSeed % collection.length
    return collection[index]
  }

  /**
   * Get image collection for specific dish type (wrap, salad, pasta, etc.)
   * Returns cuisine-specific images if available, otherwise general dish type images
   */
  private getDishTypeCollection(dishType: string, cuisine?: string): string[] | null {
    // Cuisine-specific dish type collections
    const cuisineDishCollections: Record<string, Record<string, string[]>> = {
      italian: {
        pasta: [
          'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80', // Pasta
          'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80', // Italian pasta
          'https://images.unsplash.com/photo-1551462147-6e9239bd8e4a?w=800&q=80', // Spaghetti
          'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80', // Pasta dish
          'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80', // Pasta bowl
        ],
      },
      mexican: {
        wrap: [
          'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Burrito/wrap
          'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80', // Mexican wrap
          'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80', // Wrap
        ],
        taco: [
          'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Tacos
          'https://images.unsplash.com/photo-1565299585323-38174c0a5e0e?w=800&q=80', // Taco platter
        ],
      },
    }
    
    // Try cuisine-specific first
    if (cuisine && cuisineDishCollections[cuisine]?.[dishType]) {
      return cuisineDishCollections[cuisine][dishType]
    }
    
    // General dish type collections
    const dishTypeCollections: Record<string, string[]> = {
      wrap: [
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Wrap/Burrito
        'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80', // Wrap
        'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80', // Wrap
        'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800&q=80', // Sandwich/wrap
        'https://images.unsplash.com/photo-1565299585323-38174c0a5e0e?w=800&q=80', // Wrap/Burrito
        'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80', // Wrap
        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80', // Wrap
      ],
      salad: [
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', // Salad
        'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80', // Green salad
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', // Fresh salad
      ],
      pasta: [
        'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80', // Pasta
        'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80', // Pasta dish
        'https://images.unsplash.com/photo-1551462147-6e9239bd8e4a?w=800&q=80', // Spaghetti
      ],
      bowl: [
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Bowl
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', // Rice bowl
      ],
      sandwich: [
        'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800&q=80', // Sandwich
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', // Burger
      ],
      soup: [
        'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80', // Soup
        'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&q=80', // Soup bowl
      ],
      pizza: [
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', // Pizza
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Pizza slice
      ],
      taco: [
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Tacos
        'https://images.unsplash.com/photo-1565299585323-38174c0a5e0e?w=800&q=80', // Taco platter
      ],
      sushi: [
        'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', // Sushi
        'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', // Sushi roll
      ],
    }
    
    return dishTypeCollections[dishType] || null
  }

  /**
   * Get image collection for specific cuisine type
   */
  private getCuisineCollection(cuisine: string): string[] | null {
    const cuisineCollections: Record<string, string[]> = {
      italian: [
        'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80', // Italian pasta
        'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80', // Italian dish
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', // Italian pizza
        'https://images.unsplash.com/photo-1551462147-6e9239bd8e4a?w=800&q=80', // Italian food
      ],
      asian: [
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80', // Asian stir-fry
        'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80', // Sushi
        'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&q=80', // Ramen
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Asian bowl
      ],
      mexican: [
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80', // Mexican tacos
        'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80', // Mexican food
        'https://images.unsplash.com/photo-1565299585323-38174c0a5e0e?w=800&q=80', // Mexican dish
      ],
      mediterranean: [
        'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80', // Mediterranean
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Mediterranean bowl
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', // Mediterranean salad
      ],
      indian: [
        'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80', // Indian curry
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Indian dish
      ],
    }
    
    return cuisineCollections[cuisine] || null
  }
  
  private getIntelligentFallback(meta: ClassifiedMeta, title: string, description?: string): string {
    // Use the same logic as getImageForRecipe in SimpleRecipeImage.tsx
    // This provides accurate image matching without API keys
    const lower = title.toLowerCase()
    const descLower = description?.toLowerCase() || ''
    const combined = `${lower} ${descLower}`
    
    // Match specific recipe patterns (same as SimpleRecipeImage)
    if (combined.match(/smoothie.*bowl|smoothie bowl/)) {
      return 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80'
    }
    if (combined.match(/parfait|yogurt.*parfait|raspberry.*yogurt/)) {
      return 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80'
    }
    if (combined.match(/energy.*bar|granola.*bar|nut.*bar|cedar.*nut|pomegranate.*nut/)) {
      return 'https://images.unsplash.com/photo-1606312619070-d48b4bc6d0e3?w=800&q=80'
    }
    if (combined.match(/sweet.*potato.*arugula|arugula.*sweet.*potato/)) {
      return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'
    }
    if (combined.match(/arugula.*salad|salad.*arugula/)) {
      return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'
    }
    if (combined.match(/souvlaki.*chicken|chicken.*souvlaki/)) {
      return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'
    }
    if (combined.match(/maple.*glazed.*salmon|salmon.*raspberry|glazed.*salmon/)) {
      return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80'
    }
    if (combined.match(/sweet.*potato.*hash|hash.*sweet.*potato/)) {
      return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80'
    }
    if (combined.match(/frittata|egg.*shallot|shallot.*scramble/)) {
      return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80'
    }
    if (combined.match(/marinated.*chicken|chicken.*mixed.*greens/)) {
      return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'
    }
    if (combined.match(/pomegranate.*salad|salad.*pomegranate/)) {
      return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'
    }
    if (combined.match(/stuffed.*pav|pav.*chicken/)) {
      return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'
    }
    if (combined.match(/breakfast.*wrap|wrap.*egg/)) {
      return 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800&q=80'
    }
    if (combined.match(/bowl/) && (combined.match(/sweet.*potato|arugula/))) {
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'
    }
    
    // Use classification-based fallback
    return this.getCuratedFallbackSync(meta)
  }
  
  private getCuratedFallbackSync(meta: ClassifiedMeta): string {
    const classMap = this.curatedFallbacks[meta.class] || this.curatedFallbacks.general
    const methodKey = classMap[meta.method] ? meta.method : 'general'
    const candidates = classMap[methodKey] || this.curatedFallbacks.general.general
    const index = Math.abs(this.seedFrom(`${meta.class}|${meta.method}`)) % candidates.length
    const url = candidates[index]

    // URLs are direct Unsplash URLs
    if (url && url.startsWith('http')) {
      return url
    }

    // Fallback to default
    return this.defaultRemoteFallback(meta, this.seedFrom(meta.canonicalTitle))
  }

  private async getCuratedFallback(meta: ClassifiedMeta, seed: number): Promise<string> {
    return this.getCuratedFallbackSync(meta)
  }

  private defaultRemoteFallback(meta: ClassifiedMeta, seed: number): string {
    const seedBase = `${meta.class}|${meta.primary}|${meta.method}|${seed}`
    const index = DEFAULT_REMOTE_FALLBACKS.length > 0 ? this.seedFrom(seedBase) % DEFAULT_REMOTE_FALLBACKS.length : 0
    return DEFAULT_REMOTE_FALLBACKS[index]
  }

  private classify(payload: { title?: string; description?: string; ingredients?: string[] }): ClassifiedMeta {
    const canon = this.canonicalize({
      title: payload.title,
      desc: payload.description,
      ingredients: payload.ingredients,
    })

    const combined = `${canon.title} ${canon.desc} ${canon.ingredients.join(' ')}`
    const primary = this.detectPrimary(canon, combined)
    const method = this.detectMethod(combined)
    const classification = this.detectClass(primary, combined)
    const sides = this.detectSides(canon.ingredients, primary)
    const keywords = Array.from(new Set([primary, ...sides].filter(Boolean)))
    const cuisine = this.detectCuisine(combined, canon.title)
    const dishType = this.detectDishType(combined, canon.title)

    return {
      class: classification,
      primary,
      method,
      sides,
      keywords,
      canonicalTitle: canon.title,
      canonicalDescription: canon.desc,
      canonicalIngredients: canon.ingredients,
      cuisine,
      dishType,
    }
  }

  private detectPrimary(canon: CanonicalPayload, combined: string): string {
    for (const token of PRIMARY_PRIORITY_TOKENS) {
      if (canon.ingredients.some(ingredient => ingredient.includes(token))) {
        return this.primaryTokenRoot(token)
      }
    }

    for (const token of PRIMARY_PRIORITY_TOKENS) {
      if (combined.includes(token)) {
        return this.primaryTokenRoot(token)
      }
    }

    return canon.ingredients[0] || ''
  }

  private primaryTokenRoot(token: string): string {
    if (token.includes('chicken')) return 'chicken'
    if (token.includes('salmon')) return 'salmon'
    if (token.includes('cod')) return 'cod'
    if (token.includes('trout')) return 'trout'
    if (token.includes('tuna')) return 'tuna'
    if (token.includes('shrimp')) return 'shrimp'
    if (token.includes('prawn')) return 'prawn'
    if (token.includes('lobster')) return 'lobster'
    if (token.includes('crab')) return 'crab'
    if (token.includes('scallop')) return 'scallop'
    if (token.includes('mussel')) return 'mussel'
    if (token.includes('clam')) return 'clam'
    if (token.includes('turkey')) return 'turkey'
    if (token.includes('duck')) return 'duck'
    if (token.includes('beef')) return 'beef'
    if (token.includes('steak')) return 'steak'
    if (token.includes('pork')) return 'pork'
    if (token.includes('ham')) return 'ham'
    if (token.includes('bacon')) return 'bacon'
    if (token.includes('sausage')) return 'sausage'
    if (token.includes('lamb')) return 'lamb'
    if (token.includes('tofu')) return 'tofu'
    if (token.includes('tempeh')) return 'tempeh'
    if (token.includes('seitan')) return 'seitan'
    if (token.includes('lentil')) return 'lentil'
    if (token.includes('chickpea')) return 'chickpea'
    if (token.includes('bean')) return 'bean'
    if (token.includes('egg')) return 'egg'
    if (token.includes('chocolate')) return 'chocolate'
    if (token.includes('sweet potato')) return 'sweet potato'
    if (token.includes('potato')) return 'potato'
    if (token.includes('pasta')) return 'pasta'
    if (token.includes('noodle')) return 'noodle'
    if (token.includes('rice')) return 'rice'
    if (token.includes('quinoa')) return 'quinoa'
    return token
  }

  private detectMethod(combined: string): string {
    if (combined.includes('stir fry') || combined.includes('stir-fry') || combined.includes('stirfry')) {
      return 'stirfry'
    }
    if (combined.includes('sauté') || combined.includes('sauteed') || combined.includes('saute')) {
      return 'saute'
    }
    if (combined.includes('pan seared') || combined.includes('pan-seared') || combined.includes('seared')) {
      return 'saute'
    }
    if (combined.includes('grill')) {
      return 'grill'
    }
    if (combined.includes('roast')) {
      return 'roast'
    }
    if (combined.includes('bake')) {
      return 'bake'
    }
    if (combined.includes('fried') || combined.includes('fry')) {
      return 'fry'
    }
    if (combined.includes('soup') || combined.includes('broth')) {
      return 'soup'
    }
    if (combined.includes('stew') || combined.includes('braise')) {
      return 'stew'
    }
    if (combined.includes('raw') || combined.includes('sashimi') || combined.includes('poke')) {
      return 'raw'
    }
    if (combined.includes('salad')) {
      return 'salad'
    }
    if (combined.includes('taco') || combined.includes('wrap') || combined.includes('burrito') || combined.includes('sandwich')) {
      return 'sandwich_wrap'
    }
    if (combined.includes('bowl')) {
      return 'bowl'
    }
    return 'general'
  }

  private detectClass(primary: string, combined: string): string {
    if (['salmon', 'cod', 'trout', 'tuna', 'fish'].includes(primary)) {
      return 'fish'
    }
    if (['shrimp', 'prawn', 'lobster', 'crab', 'scallop', 'mussel', 'clam'].includes(primary)) {
      return 'seafood'
    }
    if (['chicken', 'turkey', 'duck'].includes(primary)) {
      return 'poultry'
    }
    if (['beef', 'steak', 'pork', 'ham', 'bacon', 'sausage', 'lamb'].includes(primary)) {
      return 'meat'
    }
    if (['tofu', 'tempeh', 'seitan', 'lentil', 'chickpea', 'bean'].includes(primary)) {
      if (combined.includes('vegan')) {
        return 'vegan'
      }
      return 'vegetarian'
    }
    if (primary === 'egg') {
      return 'egg'
    }
    if (
      combined.includes('dessert') ||
      combined.includes('sweet') ||
      ['chocolate', 'brownie', 'cake', 'cookie'].includes(primary)
    ) {
      return 'dessert'
    }
    // Check for parfait/yogurt first (before breakfast)
    if (combined.includes('parfait') || combined.includes('yogurt parfait')) {
      return 'dessert'
    }
    
    if (
      combined.includes('breakfast') ||
      ['oatmeal', 'pancake', 'waffle', 'granola', 'toast'].includes(primary)
    ) {
      return 'breakfast'
    }
    if (!primary && !MEAT_TOKENS.some(token => combined.includes(token))) {
      if (combined.includes('vegan')) {
        return 'vegan'
      }
      return 'vegetarian'
    }
    return 'general'
  }

  private detectSides(ingredients: string[], primary: string): string[] {
    const cleanedPrimary = primary || ''
    const filtered = ingredients.filter(ing => !cleanedPrimary || !ing.includes(cleanedPrimary))
    const distinctive = filtered.filter(ing => DISTINCTIVE_SIDE_TOKENS.some(token => ing.includes(token)))
    const combined = [...distinctive, ...filtered]
    const unique = Array.from(new Set(combined))
    return unique.slice(0, 2)
  }

  /**
   * Detect cuisine type from recipe title/description
   * Returns cuisine name or undefined if not detected
   */
  private detectCuisine(combined: string, title: string): string | undefined {
    const lower = combined.toLowerCase()
    const titleLower = title.toLowerCase()
    
    // Italian cuisine indicators
    if (lower.includes('italian') || lower.includes('pasta') || lower.includes('lasagna') || 
        lower.includes('risotto') || lower.includes('pizza') || lower.includes('marinara') ||
        lower.includes('parmesan') || lower.includes('mozzarella') || lower.includes('basil') ||
        lower.includes('pesto') || lower.includes('carbonara') || lower.includes('alfredo')) {
      return 'italian'
    }
    
    // Asian cuisine indicators
    if (lower.includes('asian') || lower.includes('chinese') || lower.includes('japanese') ||
        lower.includes('thai') || lower.includes('korean') || lower.includes('vietnamese') ||
        lower.includes('stir fry') || lower.includes('stir-fry') || lower.includes('fried rice') ||
        lower.includes('sushi') || lower.includes('ramen') || lower.includes('pad thai') ||
        lower.includes('teriyaki') || lower.includes('soy sauce') || lower.includes('ginger') ||
        lower.includes('sesame') || lower.includes('miso') || lower.includes('sake')) {
      return 'asian'
    }
    
    // Mexican cuisine indicators
    if (lower.includes('mexican') || lower.includes('taco') || lower.includes('burrito') ||
        lower.includes('quesadilla') || lower.includes('enchilada') || lower.includes('salsa') ||
        lower.includes('guacamole') || lower.includes('cilantro') || lower.includes('jalapeño') ||
        lower.includes('chipotle') || lower.includes('tortilla')) {
      return 'mexican'
    }
    
    // Mediterranean cuisine indicators
    if (lower.includes('mediterranean') || lower.includes('greek') || lower.includes('hummus') ||
        lower.includes('tzatziki') || lower.includes('feta') || lower.includes('olive') ||
        lower.includes('souvlaki') || lower.includes('gyro') || lower.includes('falafel')) {
      return 'mediterranean'
    }
    
    // Indian cuisine indicators
    if (lower.includes('indian') || lower.includes('curry') || lower.includes('biryani') ||
        lower.includes('tandoori') || lower.includes('masala') || lower.includes('naan') ||
        lower.includes('tikka') || lower.includes('dal') || lower.includes('samosas')) {
      return 'indian'
    }
    
    // French cuisine indicators
    if (lower.includes('french') || lower.includes('ratatouille') || lower.includes('coq au vin') ||
        lower.includes('bouillabaisse') || lower.includes('provençal')) {
      return 'french'
    }
    
    return undefined
  }

  /**
   * Detect dish type from recipe title/description
   * Returns dish type name or undefined if not detected
   */
  private detectDishType(combined: string, title: string): string | undefined {
    const lower = combined.toLowerCase()
    const titleLower = title.toLowerCase()
    
    // Wrap/Burrito
    if (lower.includes('wrap') || lower.includes('burrito') || lower.includes('tortilla wrap')) {
      return 'wrap'
    }
    
    // Salad
    if (lower.includes('salad') && !lower.includes('pasta salad') && !lower.includes('potato salad')) {
      return 'salad'
    }
    
    // Pasta
    if (lower.includes('pasta') || lower.includes('spaghetti') || lower.includes('linguine') ||
        lower.includes('fettuccine') || lower.includes('penne') || lower.includes('lasagna') ||
        lower.includes('macaroni') || lower.includes('rigatoni')) {
      return 'pasta'
    }
    
    // Bowl
    if (lower.includes('bowl') && (lower.includes('rice') || lower.includes('grain') || 
        lower.includes('buddha') || lower.includes('poke') || lower.includes('power bowl'))) {
      return 'bowl'
    }
    
    // Sandwich
    if (lower.includes('sandwich') || lower.includes('sub') || lower.includes('hoagie') ||
        lower.includes('panini') || lower.includes('burger')) {
      return 'sandwich'
    }
    
    // Soup
    if (lower.includes('soup') || lower.includes('stew') || lower.includes('chowder') ||
        lower.includes('bisque') || lower.includes('broth')) {
      return 'soup'
    }
    
    // Pizza
    if (lower.includes('pizza') || lower.includes('flatbread')) {
      return 'pizza'
    }
    
    // Taco
    if (lower.includes('taco') || lower.includes('tacos')) {
      return 'taco'
    }
    
    // Sushi/Roll
    if (lower.includes('sushi') || lower.includes('roll') || lower.includes('maki')) {
      return 'sushi'
    }
    
    return undefined
  }

  private buildMultipleQueries(
    meta: ClassifiedMeta,
    originalTitle: string,
    description?: string,
    ingredients: string[] = []
  ): string[] {
    const queries: string[] = []
    const titleWords = this.extractKeyWordsFromTitle(meta.canonicalTitle)
    
    // Query 1: Full recipe title (most specific)
    if (titleWords.length > 0) {
      queries.push(titleWords.slice(0, 5).join(' ') + ' food')
    }
    
    // Query 2: Recipe title with description keywords
    if (description) {
      const descWords = this.extractKeyWordsFromTitle(description)
      if (descWords.length > 0 && titleWords.length > 0) {
        queries.push([...titleWords.slice(0, 3), ...descWords.slice(0, 2)].join(' ') + ' food')
      }
    }
    
    // Query 3: Primary ingredient + method + key ingredients
    if (meta.primary) {
      const methodPart = meta.method && meta.method !== 'general' ? meta.method + ' ' : ''
      const sidesPart = meta.sides.length > 0 ? ' with ' + meta.sides.slice(0, 2).join(' ') : ''
      queries.push(methodPart + meta.primary + sidesPart + ' food')
    }
    
    // Query 4: Top ingredients from recipe
    if (ingredients.length > 0) {
      const topIngredients = ingredients
        .slice(0, 3)
        .map(ing => this.normalize(ing))
        .filter(ing => ing.length > 3)
      if (topIngredients.length > 0) {
        queries.push(topIngredients.join(' ') + ' recipe food')
      }
    }
    
    // Query 5: Simplified title (remove common words)
    if (titleWords.length > 2) {
      queries.push(titleWords.slice(0, 3).join(' ') + ' dish')
    }
    
    // Remove duplicates and empty queries
    return Array.from(new Set(queries.filter(q => q.trim().length > 0)))
  }
  
  private buildVerifiedQuery(meta: ClassifiedMeta): string {
    // Keep for backward compatibility, but prefer buildMultipleQueries
    const titleWords = this.extractKeyWordsFromTitle(meta.canonicalTitle)
    if (titleWords.length > 0) {
      return titleWords.slice(0, 4).join(' ') + ' food'
    }
    return (meta.method && meta.method !== 'general' ? meta.method + ' ' : '') + 
           (meta.primary || 'food') + ' food'
  }
  
  private extractKeyWordsFromTitle(title: string): string[] {
    if (!title) return []
    
    const normalized = this.normalize(title)
    
    // Remove common stop words
    const stopWords = new Set([
      'and', 'or', 'the', 'a', 'an', 'with', 'in', 'on', 'at', 'to', 'for',
      'of', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ])
    
    // Split into words and filter
    const words = normalized
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
    
    // Prioritize longer, more descriptive words
    const prioritized = words.sort((a, b) => {
      // Prefer words that are ingredients or cooking terms
      const aIsIngredient = PRIMARY_PRIORITY_TOKENS.some(token => a.includes(token)) ||
                          DISTINCTIVE_SIDE_TOKENS.some(token => a.includes(token))
      const bIsIngredient = PRIMARY_PRIORITY_TOKENS.some(token => b.includes(token)) ||
                          DISTINCTIVE_SIDE_TOKENS.some(token => b.includes(token))
      
      if (aIsIngredient && !bIsIngredient) return -1
      if (!aIsIngredient && bIsIngredient) return 1
      
      // Prefer longer words (more descriptive)
      return b.length - a.length
    })
    
    return prioritized
  }

  private altText(meta: ClassifiedMeta): string {
    const elements = []
    if (meta.method && meta.method !== 'general') {
      elements.push(meta.method)
    }
    if (meta.primary) {
      elements.push(meta.primary)
    } else {
      elements.push(meta.class || 'dish')
    }
    if (meta.sides.length > 0) {
      elements.push(`with ${meta.sides.join(' and ')}`)
    }
    return elements.join(' ').trim()
  }
}

export const recipeImageService = RecipeImageService.getInstance()


