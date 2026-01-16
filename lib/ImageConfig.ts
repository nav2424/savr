/**
 * Image Configuration - Choose your preferred image source
 */

export interface ImageConfig {
  // Primary image service
  primaryService: 'openai' | 'stability' | 'replicate' | 'unsplash' | 'pexels' | 'foodish' | 'spoonacular' | 'stock'
  
  // Fallback services (in order of preference)
  fallbackServices: Array<'openai' | 'stability' | 'replicate' | 'unsplash' | 'pexels' | 'foodish' | 'spoonacular' | 'stock'>
  
  // API Keys (add your keys here)
  apiKeys: {
    openai?: string
    stability?: string
    replicate?: string
    unsplash?: string
    pexels?: string
    spoonacular?: string
  }
  
  // Image settings
  settings: {
    enableCaching: boolean
    cacheExpiry: number // in hours
    imageQuality: 'low' | 'medium' | 'high'
    imageSize: 'small' | 'medium' | 'large'
  }
}

// Default configuration
export const defaultImageConfig: ImageConfig = {
  primaryService: 'unsplash', // Start with free Unsplash
  fallbackServices: ['stock', 'foodish'],
  
  apiKeys: {
    // Add your API keys here:
    // openai: process.env.OPENAI_API_KEY,
    // stability: process.env.STABILITY_API_KEY,
    // replicate: process.env.REPLICATE_API_KEY,
    unsplash: process.env.UNSPLASH_ACCESS_KEY,
    pexels: process.env.PEXELS_API_KEY,
    spoonacular: process.env.SPOONACULAR_API_KEY
  },
  
  settings: {
    enableCaching: true,
    cacheExpiry: 24, // 24 hours
    imageQuality: 'high',
    imageSize: 'large'
  }
}

// Pre-configured setups for different use cases
export const imageConfigs = {
  // Free setup - uses only free services
  free: {
    ...defaultImageConfig,
    primaryService: 'unsplash' as const,
    fallbackServices: ['stock', 'foodish']
  },
  
  // AI-powered setup - uses AI image generation
  ai: {
    ...defaultImageConfig,
    primaryService: 'openai' as const,
    fallbackServices: ['stability', 'replicate', 'unsplash', 'stock']
  },
  
  // Professional setup - uses paid APIs for best quality
  professional: {
    ...defaultImageConfig,
    primaryService: 'openai' as const,
    fallbackServices: ['stability', 'replicate', 'unsplash', 'pexels', 'stock']
  },
  
  // Budget setup - uses free/cheap services
  budget: {
    ...defaultImageConfig,
    primaryService: 'unsplash' as const,
    fallbackServices: ['pexels', 'foodish', 'stock']
  }
}

// Get current configuration
export function getCurrentImageConfig(): ImageConfig {
  // You can change this to switch between different setups
  return imageConfigs.free // Change to 'ai', 'professional', or 'budget'
}
