/**
 * Cost-Effective Recipe Image Service
 * Uses only free APIs and smart fallbacks
 */

export class CostEffectiveImageService {
  private static instance: CostEffectiveImageService
  private cache = new Map<string, string>()
  private imagePool = new Map<string, string[]>()

  static getInstance(): CostEffectiveImageService {
    if (!CostEffectiveImageService.instance) {
      CostEffectiveImageService.instance = new CostEffectiveImageService()
    }
    return CostEffectiveImageService.instance
  }

  /**
   * Get recipe image using free services only
   */
  async getRecipeImage(title: string, description?: string): Promise<string> {
    const cacheKey = `${title}_${description || ''}`
    
    // Check cache first (but skip cache for now to test the fix)
    // if (this.cache.has(cacheKey)) {
    //   return this.cache.get(cacheKey)!
    // }

    try {
      // Try free services in order of preference
      let imageUrl: string | null = null

      // 1. Try Unsplash (free with API key)
      imageUrl = await this.getUnsplashImage(title)
      if (imageUrl) {
        this.cache.set(cacheKey, imageUrl)
        return imageUrl
      }

      // 2. Use smart stock image selection (always works)
      imageUrl = this.getSmartStockImage(title, description)
      this.cache.set(cacheKey, imageUrl)
      return imageUrl

    } catch (error) {
      console.error('Error getting recipe image:', error)
      return this.getSmartStockImage(title, description)
    }
  }

  /**
   * 1. 📸 Unsplash API - Free with API key
   */
  private async getUnsplashImage(title: string): Promise<string | null> {
    try {
      // You can get a free API key from unsplash.com/developers
      const apiKey = process.env.UNSPLASH_ACCESS_KEY
      if (!apiKey) {
        console.log('No Unsplash API key found, skipping...')
        return null
      }

      const query = encodeURIComponent(`${title} food recipe`)
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&client_id=${apiKey}`)
      
      const data = await response.json()
      return data.results[0]?.urls?.regular || null
    } catch (error) {
      console.error('Unsplash API failed:', error)
      return null
    }
  }

  /**
   * 3. 🎯 Smart Stock Image Selection - Always works, completely free
   */
  private getSmartStockImage(title: string, description?: string): string {
    const lower = title.toLowerCase()
    const descLower = description?.toLowerCase() || ''
    
    // PRIORITY 1: Specific dishes (check FIRST)
    if (lower.match(/quesadilla|taco|burrito/)) {
      return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80' // Mexican food
    }
    if (lower.match(/curry/)) {
      return 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80' // Curry
    }
    if (lower.match(/pizza/)) {
      return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80' // Pizza
    }
    if (lower.match(/burger/)) {
      return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80' // Burger
    }
    if (lower.match(/pasta|spaghetti/)) {
      return 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80' // Pasta
    }
    if (lower.match(/sushi/)) {
      return 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80' // Sushi
    }
    if (lower.match(/ramen/)) {
      return 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&q=80' // Ramen
    }
    
    // PRIORITY 2: Cooking methods
    if (lower.match(/sautéed|sauteed/)) {
      return 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80'
    }
    if (lower.match(/roasted/)) {
      return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80'
    }
    if (lower.match(/grilled/)) {
      return 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80'
    }
    if (lower.match(/baked/)) {
      return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80'
    }
    
    // PRIORITY 3: Proteins
    if (lower.match(/chicken/)) {
      return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'
    }
    if (lower.match(/beef|steak/)) {
      return 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80'
    }
    if (lower.match(/fish|salmon/)) {
      return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80'
    }
    if (lower.match(/pork/)) {
      return 'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80'
    }
    
    // PRIORITY 4: Meal types
    if (lower.match(/breakfast/)) {
      return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80'
    }
    if (lower.match(/salad/)) {
      return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'
    }
    if (lower.match(/soup/)) {
      return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80'
    }
    
    // PRIORITY 5: Default with variety
    const defaultImages = [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Food platter
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Cooking
      'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80', // Roasted
      'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80', // Grilled
      'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80', // Braised
      'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80', // Steamed
      'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80', // Asian
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80'  // Mexican
    ]
    
    // Use hash to select from default images
    const recipeHash = title.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return defaultImages[Math.abs(recipeHash) % defaultImages.length]
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number, keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

export const costEffectiveImageService = CostEffectiveImageService.getInstance()
