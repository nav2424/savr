// SAVR Price Learning Service - Learn actual prices from receipts for accurate budget predictions
import { supabase } from './supabase'

export interface LearnedPrice {
  item: string
  store: string
  price: number
  quantity: number
  unit: string
  lastSeen: Date
  confidence: number
  source: 'receipt' | 'manual' | 'estimated'
}

export interface PriceEstimate {
  item: string
  estimatedPrice: number
  confidence: number
  source: 'user_learned' | 'store_average' | 'default'
  alternatives?: {
    store: string
    price: number
    savings: number
  }[]
}

export interface StorePriceComparison {
  item: string
  prices: {
    store: string
    price: number
    lastSeen: Date
  }[]
  cheapestStore: string
  potentialSavings: number
}

class PriceLearningService {
  private static instance: PriceLearningService
  private priceCache: Map<string, LearnedPrice[]> = new Map()

  static getInstance(): PriceLearningService {
    if (!PriceLearningService.instance) {
      PriceLearningService.instance = new PriceLearningService()
    }
    return PriceLearningService.instance
  }

  /**
   * Learn prices from a receipt
   */
  async learnFromReceipt(
    userId: string,
    receipt: {
      store: string
      date: Date
      items: Array<{
        name: string
        quantity: number
        price: number
        unit?: string
      }>
    }
  ): Promise<void> {
    try {
      // Save prices to database
      const pricesToInsert = receipt.items.map(item => ({
        user_id: userId,
        item_name: this.normalizeItemName(item.name),
        store: receipt.store,
        price: item.price,
        quantity: item.quantity,
        unit: item.unit || 'units',
        learned_at: receipt.date.toISOString(),
        source: 'receipt'
      }))

      const { error } = await supabase
        .from('learned_prices')
        .insert(pricesToInsert)

      if (error) {
        console.error('Error saving learned prices:', error)
        return
      }

      // Clear cache to force reload
      this.priceCache.delete(userId)

      console.log(`✅ Learned ${receipt.items.length} prices from ${receipt.store}`)
    } catch (error) {
      console.error('Error learning from receipt:', error)
    }
  }

  /**
   * Get price estimate for an item
   */
  async getPriceEstimate(
    userId: string,
    itemName: string,
    store?: string
  ): Promise<PriceEstimate> {
    try {
      const normalizedName = this.normalizeItemName(itemName)

      // Try to get from user's learned prices
      const { data, error} = await supabase
        .from('learned_prices')
        .select('*')
        .eq('user_id', userId)
        .ilike('item_name', `%${normalizedName}%`)
        .order('learned_at', { ascending: false })
        .limit(10)

      if (!error && data && data.length > 0) {
        // If store specified, try to find price from that store
        let targetPrices = data
        if (store) {
          const storeSpecific = data.filter(p => p.store.toLowerCase() === store.toLowerCase())
          if (storeSpecific.length > 0) {
            targetPrices = storeSpecific
          }
        }

        // Calculate average price from recent purchases
        const avgPrice = targetPrices.reduce((sum, p) => sum + p.price, 0) / targetPrices.length

        // Find alternative stores
        const alternatives = this.findAlternativeStores(data, store)

        return {
          item: itemName,
          estimatedPrice: avgPrice,
          confidence: 0.90, // High confidence - learned from actual receipts
          source: 'user_learned',
          alternatives
        }
      }

      // Fall back to default estimates
      return {
        item: itemName,
        estimatedPrice: this.getDefaultPrice(itemName),
        confidence: 0.50, // Lower confidence - using defaults
        source: 'default'
      }
    } catch (error) {
      console.error('Error getting price estimate:', error)
      return {
        item: itemName,
        estimatedPrice: 5.00,
        confidence: 0.30,
        source: 'default'
      }
    }
  }

  /**
   * Get shopping list total estimate
   */
  async estimateShoppingListCost(
    userId: string,
    items: Array<{ name: string; quantity: number }>
  ): Promise<{
    totalEstimate: number
    itemEstimates: Array<{
      name: string
      estimate: number
      confidence: number
    }>
    overallConfidence: number
  }> {
    const itemEstimates: Array<{ name: string; estimate: number; confidence: number }> = []
    let totalEstimate = 0
    let totalConfidence = 0

    for (const item of items) {
      const priceEst = await this.getPriceEstimate(userId, item.name)
      const itemTotal = priceEst.estimatedPrice * item.quantity

      itemEstimates.push({
        name: item.name,
        estimate: itemTotal,
        confidence: priceEst.confidence
      })

      totalEstimate += itemTotal
      totalConfidence += priceEst.confidence
    }

    const overallConfidence = items.length > 0 
      ? totalConfidence / items.length 
      : 0

    return {
      totalEstimate,
      itemEstimates,
      overallConfidence
    }
  }

  /**
   * Compare prices across stores
   */
  async comparePricesAcrossStores(
    userId: string,
    items: string[]
  ): Promise<StorePriceComparison[]> {
    const comparisons: StorePriceComparison[] = []

    for (const item of items) {
      try {
        const normalizedName = this.normalizeItemName(item)

        const { data } = await supabase
          .from('learned_prices')
          .select('*')
          .eq('user_id', userId)
          .ilike('item_name', `%${normalizedName}%`)
          .order('learned_at', { ascending: false })
          .limit(20)

        if (data && data.length > 1) {
          // Group by store
          const storeMap = new Map<string, { total: number; count: number; lastSeen: Date }>()

          data.forEach(price => {
            const existing = storeMap.get(price.store) || { total: 0, count: 0, lastSeen: new Date(0) }
            storeMap.set(price.store, {
              total: existing.total + price.price,
              count: existing.count + 1,
              lastSeen: new Date(Math.max(existing.lastSeen.getTime(), new Date(price.learned_at).getTime()))
            })
          })

          // Calculate average prices per store
          const prices = Array.from(storeMap.entries()).map(([store, stats]) => ({
            store,
            price: stats.total / stats.count,
            lastSeen: stats.lastSeen
          }))

          if (prices.length > 1) {
            const cheapest = prices.reduce((min, p) => p.price < min.price ? p : min)
            const mostExpensive = prices.reduce((max, p) => p.price > max.price ? p : max)

            comparisons.push({
              item,
              prices,
              cheapestStore: cheapest.store,
              potentialSavings: mostExpensive.price - cheapest.price
            })
          }
        }
      } catch (error) {
        console.error(`Error comparing prices for ${item}:`, error)
      }
    }

    return comparisons.filter(c => c.potentialSavings > 0.50) // Only show if savings > $0.50
  }

  /**
   * Get savings opportunities
   */
  async getSavingsOpportunities(userId: string): Promise<{
    totalPotentialSavings: number
    recommendations: Array<{
      action: string
      savings: number
      reason: string
    }>
  }> {
    try {
      // Find items where user could save by switching stores
      const { data } = await supabase
        .from('shopping_lists')
        .select('items')
        .eq('user_id', userId)
        .single()

      if (!data || !data.items) {
        return { totalPotentialSavings: 0, recommendations: [] }
      }

      const itemNames = data.items.map((item: any) => item.name)
      const comparisons = await this.comparePricesAcrossStores(userId, itemNames)

      const totalSavings = comparisons.reduce((sum, c) => sum + c.potentialSavings, 0)

      const recommendations = comparisons.map(comp => ({
        action: `Buy ${comp.item} at ${comp.cheapestStore}`,
        savings: comp.potentialSavings,
        reason: `${comp.cheapestStore} is $${comp.potentialSavings.toFixed(2)} cheaper`
      }))

      return {
        totalPotentialSavings: totalSavings,
        recommendations: recommendations.sort((a, b) => b.savings - a.savings)
      }
    } catch (error) {
      console.error('Error getting savings opportunities:', error)
      return { totalPotentialSavings: 0, recommendations: [] }
    }
  }

  /**
   * Helper: Normalize item name for matching
   */
  private normalizeItemName(name: string): string {
    return name.toLowerCase()
      .trim()
      .replace(/\d+(\.\d+)?\s*(oz|lb|g|kg|lbs)/gi, '') // Remove quantities
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Helper: Find alternative stores with better prices
   */
  private findAlternativeStores(
    allPrices: any[],
    currentStore?: string
  ): Array<{ store: string; price: number; savings: number }> {
    if (!currentStore || allPrices.length <= 1) return []

    // Group by store
    const storeMap = new Map<string, number[]>()
    allPrices.forEach(p => {
      if (!storeMap.has(p.store)) {
        storeMap.set(p.store, [])
      }
      storeMap.get(p.store)!.push(p.price)
    })

    // Get current store price
    const currentPrices = storeMap.get(currentStore)
    if (!currentPrices) return []

    const currentAvg = currentPrices.reduce((sum, p) => sum + p) / currentPrices.length

    // Find cheaper alternatives
    const alternatives: Array<{ store: string; price: number; savings: number }> = []

    storeMap.forEach((prices, store) => {
      if (store === currentStore) return

      const avg = prices.reduce((sum, p) => sum + p) / prices.length
      if (avg < currentAvg) {
        alternatives.push({
          store,
          price: avg,
          savings: currentAvg - avg
        })
      }
    })

    return alternatives.sort((a, b) => b.savings - a.savings)
  }

  /**
   * Helper: Default price estimates (fallback)
   */
  private getDefaultPrice(itemName: string): number {
    const item = itemName.toLowerCase()

    // Dairy
    if (item.includes('milk')) return 4.50
    if (item.includes('cheese')) return 5.00
    if (item.includes('yogurt')) return 4.00
    if (item.includes('butter')) return 4.50
    if (item.includes('eggs')) return 3.50

    // Proteins
    if (item.includes('chicken')) return 8.00
    if (item.includes('beef')) return 12.00
    if (item.includes('pork')) return 7.00
    if (item.includes('fish') || item.includes('salmon')) return 10.00

    // Grains
    if (item.includes('bread')) return 3.00
    if (item.includes('rice')) return 2.50
    if (item.includes('pasta')) return 2.00

    // Produce
    if (item.includes('tomato')) return 3.00
    if (item.includes('lettuce')) return 2.50
    if (item.includes('onion')) return 1.50
    if (item.includes('pepper')) return 3.00
    if (item.includes('potato')) return 2.00

    // Default
    return 5.00
  }
}

export const priceLearningService = PriceLearningService.getInstance()

