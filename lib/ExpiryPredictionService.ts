// ExpiryPredictionService - Master Expiry Engine with Comprehensive Shelf-Life Database
import { supabase } from './supabase'

interface ShelfLifeData {
  pantry?: number // Days in pantry
  fridge?: number // Days in fridge
  freezer?: number // Days in freezer
  notes?: string
  variants?: string[] // Alternative names
  confidence: 'high' | 'medium' | 'low' // Confidence level for this item
}

interface ExpiryPrediction {
  expiryDate: string
  days: number
  confidence: 'high' | 'medium' | 'low'
  notes?: string
  canFreeze?: boolean
  freezeExtensionDays?: number
}

export class ExpiryPredictionService {
  // COMPREHENSIVE SHELF-LIFE DATABASE (BASELINE RULES)
  // Priority: User Manual Entry > AI Suggestion > Default Range
  private shelfLifeDatabase: Record<string, ShelfLifeData> = {
    // ============================================
    // PRODUCE
    // ============================================
    'berries': { pantry: 1, fridge: 5, freezer: 300, confidence: 'high', variants: ['strawberries', 'blueberries', 'raspberries', 'blackberries'] },
    'strawberries': { pantry: 1, fridge: 5, freezer: 300, confidence: 'high' },
    'blueberries': { pantry: 1, fridge: 7, freezer: 300, confidence: 'high' },
    'raspberries': { pantry: 1, fridge: 3, freezer: 300, confidence: 'high' },
    'blackberries': { pantry: 1, fridge: 3, freezer: 300, confidence: 'high' },
    
    'leafy greens': { pantry: 1, fridge: 4, freezer: 300, confidence: 'high', variants: ['lettuce', 'spinach', 'kale', 'arugula', 'mixed greens'] },
    'lettuce': { pantry: 1, fridge: 5, freezer: 300, confidence: 'high', variants: ['romaine', 'iceberg', 'butter lettuce'] },
    'spinach': { pantry: 1, fridge: 5, freezer: 300, confidence: 'high' },
    'kale': { pantry: 1, fridge: 7, freezer: 300, confidence: 'high' },
    'arugula': { pantry: 1, fridge: 3, freezer: 300, confidence: 'high' },
    
    'apples': { pantry: 7, fridge: 28, freezer: 330, confidence: 'high' },
    'citrus': { pantry: 14, fridge: 30, freezer: 330, confidence: 'high', variants: ['oranges', 'lemons', 'limes', 'grapefruits'] },
    'oranges': { pantry: 14, fridge: 30, freezer: 330, confidence: 'high' },
    'lemons': { pantry: 14, fridge: 30, freezer: 330, confidence: 'high' },
    'limes': { pantry: 14, fridge: 30, freezer: 330, confidence: 'high' },
    'grapefruits': { pantry: 14, fridge: 30, freezer: 330, confidence: 'high' },
    
    'pomegranates': { pantry: 30, fridge: 60, freezer: 330, confidence: 'high' },
    
    'onions': { pantry: 42, fridge: 14, confidence: 'high', notes: 'Not recommended for freezer' },
    'shallots': { pantry: 42, fridge: 14, confidence: 'high', notes: 'Not recommended for freezer' },
    'potatoes': { pantry: 45, fridge: 75, confidence: 'high', notes: 'Not recommended for freezer' },
    'tomatoes': { pantry: 4, fridge: 10, freezer: 330, confidence: 'medium' },
    'garlic': { pantry: 75, fridge: 60, confidence: 'high', notes: 'Not recommended for freezer' },
    
    // ============================================
    // DAIRY & EGGS
    // ============================================
    'eggs': { fridge: 28, freezer: 330, confidence: 'high', notes: '3-5 weeks from purchase' },
    'milk': { fridge: 7, freezer: 90, confidence: 'high', notes: '5-7 days after opening' },
    'greek yogurt': { fridge: 14, freezer: 60, confidence: 'high' },
    'yogurt': { fridge: 14, freezer: 60, confidence: 'high' },
    'cheese hard': { fridge: 120, freezer: 300, confidence: 'high', variants: ['cheddar', 'swiss', 'parmesan', 'gouda'] },
    'cheese soft': { fridge: 14, confidence: 'high', notes: 'Not recommended for freezer', variants: ['brie', 'feta', 'goat cheese', 'ricotta'] },
    'cheddar cheese': { fridge: 120, freezer: 300, confidence: 'high' },
    'parmesan cheese': { fridge: 180, freezer: 300, confidence: 'high' },
    'swiss cheese': { fridge: 120, freezer: 300, confidence: 'high' },
    'brie cheese': { fridge: 14, confidence: 'high' },
    'feta cheese': { fridge: 14, confidence: 'high' },
    'goat cheese': { fridge: 14, confidence: 'high' },
    'ricotta cheese': { fridge: 7, confidence: 'high' },
    
    // ============================================
    // MEAT, POULTRY & SEAFOOD
    // ============================================
    'chicken': { fridge: 2, freezer: 330, confidence: 'high' },
    'chicken breast': { fridge: 2, freezer: 330, confidence: 'high' },
    'chicken thighs': { fridge: 2, freezer: 330, confidence: 'high' },
    'ground beef': { fridge: 2, freezer: 120, confidence: 'high' },
    'steak': { fridge: 5, freezer: 330, confidence: 'high' },
    'beef steak': { fridge: 5, freezer: 330, confidence: 'high' },
    'salmon': { fridge: 2, freezer: 90, confidence: 'high' },
    'fish': { fridge: 2, freezer: 90, confidence: 'high' },
    'shrimp': { fridge: 2, freezer: 180, confidence: 'high' },
    
    // ============================================
    // PANTRY STAPLES
    // ============================================
    'rice': { pantry: 1095, confidence: 'high', notes: '2-4 years' },
    'pasta': { pantry: 730, confidence: 'high', notes: '1-2 years' },
    'flour': { pantry: 270, confidence: 'high', notes: '6-12 months' },
    'sugar': { pantry: 9999, confidence: 'high', notes: 'Indefinite' },
    'salt': { pantry: 9999, confidence: 'high', notes: 'Indefinite' },
    'dried fruit': { pantry: 270, fridge: 365, freezer: 730, confidence: 'high', notes: '6-12 months' },
    'nuts': { pantry: 180, fridge: 365, freezer: 730, confidence: 'high', notes: '3-6 months pantry, 6-12 months fridge, 1-2 years freezer' },
    'almonds': { pantry: 180, fridge: 365, freezer: 730, confidence: 'high' },
    'walnuts': { pantry: 180, fridge: 180, freezer: 365, confidence: 'high' },
    'canned goods': { pantry: 1460, confidence: 'high', notes: '1-4 years' },
    
    // ============================================
    // CONDIMENTS
    // ============================================
    'ketchup': { fridge: 270, confidence: 'high', notes: '6-12 months' },
    'mustard': { fridge: 450, confidence: 'high', notes: '12-18 months' },
    'mayo': { fridge: 60, confidence: 'high', notes: '2 months' },
    'mayonnaise': { fridge: 60, confidence: 'high', notes: '2 months' },
    'soy sauce': { pantry: 1095, confidence: 'high', notes: '2-3 years' },
    'hot sauce': { pantry: 730, confidence: 'high', notes: '1-2 years' },
    
    // ============================================
    // SNACKS
    // ============================================
    'chips': { pantry: 28, confidence: 'high', notes: '2-4 weeks' },
    'crackers': { pantry: 90, confidence: 'high', notes: '2-3 months' },
    'granola bars': { pantry: 270, confidence: 'high', notes: '6-12 months' },
  }

  /**
   * Get freeze extension information (internal method without recursion)
   */
  private getFreezeExtensionWithoutRecursion(
    itemName: string,
    category: string,
    currentLocation: 'fridge' | 'freezer' | 'pantry'
  ): { canFreeze: boolean; extensionDays: number; notes?: string } {
    // Items that cannot be frozen
    const nonFreezable = ['eggs in shell', 'mayonnaise', 'soft cheese', 'lettuce', 'cucumber']
    const normalizedName = itemName.toLowerCase()
    
    if (nonFreezable.some(item => normalizedName.includes(item))) {
      return { canFreeze: false, extensionDays: 0 }
    }
    
    // If already in freezer, no extension needed
    if (currentLocation === 'freezer') {
      return { canFreeze: false, extensionDays: 0, notes: 'Already frozen' }
    }
    
    // Calculate freeze extension based on category (without calling predictExpiry)
    const normalizedCategory = category.toLowerCase()
    let extensionDays = 0
    let notes = ''
    
    if (normalizedCategory === 'meat' || normalizedCategory === 'poultry') {
      extensionDays = 270 // 9 months
      notes = 'Freeze to extend life by 9 months'
    } else if (normalizedCategory === 'produce') {
      extensionDays = 300 // 10-12 months
      notes = 'Freeze to extend life by 10-12 months'
    } else if (normalizedCategory === 'dairy') {
      extensionDays = 60 // 2 months
      notes = 'Freeze to extend life by 2 months (texture may change)'
    } else if (normalizedCategory === 'pantry staples' || normalizedCategory === 'pantry') {
      extensionDays = 0 // Already long shelf life
      notes = 'No need to freeze - already has long shelf life'
    } else {
      extensionDays = 180 // Default 6 months
      notes = 'Freeze to extend life by 6 months'
    }
    
    return { canFreeze: true, extensionDays, notes }
  }

  /**
   * Calculate expiry date with confidence levels
   * Priority: 1. User Manual Entry, 2. AI Suggestion, 3. Default Range
   */
  predictExpiry(
    itemName: string,
    category: string,
    location: 'fridge' | 'freezer' | 'pantry',
    purchaseDate?: string,
    userManualExpiry?: string // Highest priority - user set date
  ): ExpiryPrediction {
    // PRIORITY 1: User Manual Entry (Highest Priority)
    if (userManualExpiry) {
      return {
        expiryDate: userManualExpiry,
        days: this.calculateDaysUntil(userManualExpiry),
        confidence: 'high',
        notes: 'User-set expiry date'
      }
    }

    const normalizedName = itemName.toLowerCase().trim()
    const normalizedCategory = category.toLowerCase().trim()
    
    // Find matching item in database
    let shelfLifeData: ShelfLifeData | null = null
    let matchType: 'exact' | 'variant' | 'category' = 'category'
    
    // Try exact match
    shelfLifeData = this.shelfLifeDatabase[normalizedName] || null
    if (shelfLifeData) matchType = 'exact'
    
    // Try variant matching
    if (!shelfLifeData) {
      for (const [key, data] of Object.entries(this.shelfLifeDatabase)) {
        if (data.variants?.some(variant => 
          normalizedName.includes(variant.toLowerCase()) || 
          variant.toLowerCase().includes(normalizedName)
        )) {
          shelfLifeData = data
          matchType = 'variant'
          break
        }
      }
    }
    
    // Try partial matching (fuzzy)
    if (!shelfLifeData) {
      for (const [key, data] of Object.entries(this.shelfLifeDatabase)) {
        const keyWords = key.split(' ').filter(w => w.length > 2)
        const nameWords = normalizedName.split(' ').filter(w => w.length > 2)
        
        if (keyWords.some(kw => nameWords.some(nw => 
          kw === nw || kw.includes(nw) || nw.includes(kw)
        ))) {
          shelfLifeData = data
          matchType = 'variant'
          break
        }
      }
    }
    
    let days: number
    let confidence: 'high' | 'medium' | 'low' = 'low'
    let notes: string | undefined
    
    if (shelfLifeData) {
      // Get shelf life for the specific location
      days = shelfLifeData[location] || shelfLifeData.fridge || shelfLifeData.pantry || 14
      confidence = shelfLifeData.confidence
      notes = shelfLifeData.notes
      
      // Adjust confidence based on match type
      if (matchType === 'exact') confidence = 'high'
      else if (matchType === 'variant') {
        // Keep high if already high, otherwise upgrade to medium
        if (confidence === 'high') confidence = 'high'
        else confidence = 'medium'
      }
      
      // Apply freshness multiplier for perishable items
      if (location === 'fridge' && (normalizedCategory === 'produce' || normalizedCategory === 'dairy' || normalizedCategory === 'meat')) {
        days = Math.floor(days * 0.9) // Subtract 10% for safety
      }
    } else {
      // PRIORITY 3: Default Range When Data is Missing
      days = this.getDefaultShelfLife(normalizedCategory, location)
      confidence = 'low'
      notes = `Estimated based on ${category} category. Consider verifying expiry date.`
    }
    
    // Calculate expiry date
    const startDate = purchaseDate ? new Date(purchaseDate) : new Date()
    const expiryDate = new Date(startDate)
    expiryDate.setDate(expiryDate.getDate() + days)
    
    // Check if item can be frozen (without calling predictExpiry to avoid recursion)
    const freezeInfo = this.getFreezeExtensionWithoutRecursion(itemName, category, location)
    
    return {
      expiryDate: expiryDate.toISOString().split('T')[0],
      days,
      confidence,
      notes,
      canFreeze: freezeInfo.canFreeze,
      freezeExtensionDays: freezeInfo.extensionDays
    }
  }

  /**
   * Get default shelf life when item is unknown
   */
  private getDefaultShelfLife(category: string, location: 'fridge' | 'freezer' | 'pantry'): number {
    const defaults: Record<string, Record<string, number>> = {
      'produce': { pantry: 7, fridge: 14, freezer: 180 },
      'dairy': { pantry: 7, fridge: 14, freezer: 90 },
      'meat': { pantry: 1, fridge: 3, freezer: 180 },
      'pantry staples': { pantry: 180, fridge: 365, freezer: 365 },
      'condiments': { pantry: 365, fridge: 180, freezer: 365 },
      'snacks': { pantry: 90, fridge: 180, freezer: 180 },
      'other': { pantry: 30, fridge: 14, freezer: 180 }
    }
    
    const categoryDefaults = defaults[category] || defaults['other']
    return categoryDefaults[location] || 14
  }

  /**
   * Get freeze extension information (public method)
   */
  getFreezeExtension(
    itemName: string,
    category: string,
    currentLocation: 'fridge' | 'freezer' | 'pantry'
  ): { canFreeze: boolean; extensionDays: number; notes?: string } {
    // Use the internal method to avoid recursion
    return this.getFreezeExtensionWithoutRecursion(itemName, category, currentLocation)
  }

  /**
   * Calculate days until a date
   */
  private calculateDaysUntil(dateString: string): number {
    const targetDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    targetDate.setHours(0, 0, 0, 0)
    const diffTime = targetDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Format expiry label with color rules
   */
  getExpiryLabel(expiryDate: string): { label: string; color: string; urgency: 'none' | 'soon' | 'urgent' | 'expired' } {
    if (!expiryDate) {
      return { label: 'No expiry date', color: '#8E8E93', urgency: 'none' }
    }
    
    const daysUntil = this.calculateDaysUntil(expiryDate)
    
    if (daysUntil < 0) {
      return { label: 'Expired', color: '#FF3B30', urgency: 'expired' }
    } else if (daysUntil === 0) {
      return { label: 'Expires today', color: '#FF3B30', urgency: 'expired' }
    } else if (daysUntil <= 6) {
      return { label: `Expires in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`, color: '#FF9500', urgency: 'urgent' }
    } else if (daysUntil <= 13) {
      return { label: 'Expires soon', color: '#FF9500', urgency: 'soon' }
    } else if (daysUntil <= 60) {
      return { label: `Expires in ${daysUntil} days`, color: '#8E8E93', urgency: 'none' }
    } else {
      const months = Math.floor(daysUntil / 30)
      return { label: `Expires in ${months} month${months > 1 ? 's' : ''}`, color: '#8E8E93', urgency: 'none' }
    }
  }

  /**
   * Analyze consumption patterns and predict when user will need more
   */
  async analyzeConsumptionPattern(itemName: string, userId: string): Promise<{
    averageDaysToConsume: number
    nextRestockDate: string
    consumptionRate: 'fast' | 'normal' | 'slow'
  } | null> {
    try {
      const { data: history, error } = await supabase
        .from('pantry_consumption_history')
        .select('*')
        .eq('user_id', userId)
        .ilike('item_name', `%${itemName}%`)
        .order('consumed_at', { ascending: false })
        .limit(10)
      
      if (error || !history || history.length < 2) {
        return null
      }
      
      const daysDifferences: number[] = []
      for (let i = 0; i < history.length - 1; i++) {
        const date1 = new Date(history[i].consumed_at)
        const date2 = new Date(history[i + 1].consumed_at)
        const diffDays = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
        daysDifferences.push(diffDays)
      }
      
      const averageDaysToConsume = daysDifferences.reduce((a, b) => a + b, 0) / daysDifferences.length
      
      const nextRestockDate = new Date()
      nextRestockDate.setDate(nextRestockDate.getDate() + Math.round(averageDaysToConsume))
      
      let consumptionRate: 'fast' | 'normal' | 'slow' = 'normal'
      if (averageDaysToConsume < 5) consumptionRate = 'fast'
      else if (averageDaysToConsume > 14) consumptionRate = 'slow'
      
      return {
        averageDaysToConsume: Math.round(averageDaysToConsume),
        nextRestockDate: nextRestockDate.toISOString().split('T')[0],
        consumptionRate
      }
    } catch (error) {
      console.error('Error analyzing consumption pattern:', error)
      return null
    }
  }

  /**
   * Record consumption for future pattern analysis
   */
  async recordConsumption(
    itemName: string,
    userId: string,
    quantityConsumed: number,
    unit: string
  ): Promise<void> {
    try {
      await supabase.from('pantry_consumption_history').insert({
        user_id: userId,
        item_name: itemName,
        quantity_consumed: quantityConsumed,
        unit,
        consumed_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error recording consumption:', error)
    }
  }
}

export const expiryPredictionService = new ExpiryPredictionService()
