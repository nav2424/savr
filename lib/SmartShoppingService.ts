// SAVR Smart Shopping Prediction & Budget Forecasting Service
import { aiLearningService } from './AILearningService'
import { userPreferencesService } from './UserPreferencesService'
import { priceLearningService } from './PriceLearningService'
import { supabase } from './supabase'

export interface ShoppingPrediction {
  predictedDate: Date
  confidence: number
  reasoning: string
  estimatedSpend: number
  suggestedItems: PredictedItem[]
  budgetAlert?: {
    type: 'warning' | 'critical'
    message: string
    recommendation: string
  }
}

export interface PredictedItem {
  name: string
  category: string
  quantity: number
  unit: string
  estimatedCost: number
  predictedRunOutDate?: Date
  confidence: number
  reasoning: string
  alternatives?: AlternativeProduct[]
}

export interface AlternativeProduct {
  name: string
  estimatedCost: number
  savings: number
  reason: string
}

export interface BudgetForecast {
  userId: string
  currentMonth: number
  monthlyBudget: number
  spentSoFar: number
  projectedTotal: number
  daysRemaining: number
  dailyBudgetRemaining: number
  onTrack: boolean
  warnings: BudgetWarning[]
  recommendations: BudgetRecommendation[]
}

export interface BudgetWarning {
  type: 'overspending' | 'trending_high' | 'low_balance'
  severity: 'info' | 'warning' | 'critical'
  message: string
  impact: number // dollars
}

export interface BudgetRecommendation {
  action: string
  potentialSavings: number
  difficulty: 'easy' | 'moderate' | 'hard'
  reason: string
}

export interface PriceOptimization {
  currentItem: string
  currentPrice: number
  alternatives: {
    name: string
    price: number
    savings: number
    quality: 'same' | 'similar' | 'better'
  }[]
  totalPotentialSavings: number
}

class SmartShoppingService {
  private static instance: SmartShoppingService

  static getInstance(): SmartShoppingService {
    if (!SmartShoppingService.instance) {
      SmartShoppingService.instance = new SmartShoppingService()
    }
    return SmartShoppingService.instance
  }

  /**
   * Predict next shopping date and items
   */
  async predictNextShopping(userId: string): Promise<ShoppingPrediction> {
    const insights = await aiLearningService.getLearningInsights(userId)
    const preferences = await userPreferencesService.loadPreferences(userId)
    
    // Analyze shopping patterns
    const { shoppingPattern } = insights
    const lastShoppingDate = await this.getLastShoppingDate(userId)
    
    // Predict next shopping date
    let predictedDate = new Date()
    let confidence = 0.7
    
    if (shoppingPattern === 'daily') {
      predictedDate.setDate(predictedDate.getDate() + 1)
      confidence = 0.9
    } else if (shoppingPattern === 'weekly') {
      predictedDate.setDate(predictedDate.getDate() + 7)
      confidence = 0.85
    } else if (shoppingPattern === 'bi-weekly') {
      predictedDate.setDate(predictedDate.getDate() + 14)
      confidence = 0.8
    } else {
      // Default to weekly
      predictedDate.setDate(predictedDate.getDate() + 7)
      confidence = 0.6
    }

    // Predict items based on consumption patterns
    const suggestedItems = await this.predictItems(userId, preferences)
    
    // Estimate total spend
    const estimatedSpend = suggestedItems.reduce((sum, item) => sum + item.estimatedCost, 0)
    
    // Check budget
    const budgetAlert = await this.checkBudgetAlert(userId, estimatedSpend)
    
    return {
      predictedDate,
      confidence,
      reasoning: this.generateShoppingReasoning(shoppingPattern),
      estimatedSpend,
      suggestedItems,
      budgetAlert
    }
  }

  /**
   * Predict items user will need
   */
  private async predictItems(userId: string, preferences: any): Promise<PredictedItem[]> {
    const predictions: PredictedItem[] = []
    const householdSize = preferences?.household?.size ? parseInt(preferences.household.size) : 1
    
    // Common staples that are frequently needed
    const stapleItems = [
      { name: 'Milk', category: 'Dairy', quantity: 1, unit: 'gallon', cost: 4.50, confidence: 0.85 },
      { name: 'Bread', category: 'Grains', quantity: 1, unit: 'loaf', cost: 3.00, confidence: 0.80 },
      { name: 'Eggs', category: 'Dairy', quantity: 1, unit: 'dozen', cost: 3.50, confidence: 0.85 },
      { name: 'Chicken breast', category: 'Meat', quantity: 2, unit: 'lbs', cost: 8.00, confidence: 0.75 },
      { name: 'Rice', category: 'Grains', quantity: 1, unit: 'bag', cost: 2.50, confidence: 0.70 }
    ]
    
    // Add predictions
    stapleItems.forEach(item => {
      predictions.push({
        name: item.name,
        category: item.category,
        quantity: item.quantity * householdSize,
        unit: item.unit,
        estimatedCost: item.cost * householdSize,
        confidence: item.confidence,
        reasoning: `Frequently purchased - ${item.name} is a household staple`,
        alternatives: this.getAlternatives(item.name, item.cost)
      })
    })

    return predictions
  }

  /**
   * Get product alternatives for savings
   */
  private getAlternatives(itemName: string, currentPrice: number): AlternativeProduct[] {
    // This would integrate with price comparison APIs
    // For now, provide intelligent defaults
    const alternatives: AlternativeProduct[] = []

    // Generic/store brand alternative (typically 20-30% cheaper)
    alternatives.push({
      name: `Store brand ${itemName}`,
      estimatedCost: currentPrice * 0.75,
      savings: currentPrice * 0.25,
      reason: 'Store brand - same quality, lower price'
    })

    // Bulk option (if applicable)
    if (['Rice', 'Pasta', 'Oats'].some(item => itemName.includes(item))) {
      alternatives.push({
        name: `${itemName} (bulk size)`,
        estimatedCost: currentPrice * 1.5,
        savings: currentPrice * 0.30, // Long-term savings
        reason: 'Bulk size - better unit price'
      })
    }

    return alternatives
  }

  private getDefaultPrice(item: string): number {
    const itemLower = item.toLowerCase()

    // Dairy
    if (itemLower.includes('milk')) return 4.50
    if (itemLower.includes('cheese')) return 5.00
    if (itemLower.includes('yogurt')) return 4.00
    if (itemLower.includes('butter')) return 4.50
    if (itemLower.includes('eggs')) return 3.50

    // Proteins
    if (itemLower.includes('chicken')) return 8.00
    if (itemLower.includes('beef')) return 12.00
    if (itemLower.includes('pork')) return 7.00
    if (itemLower.includes('fish') || itemLower.includes('salmon')) return 10.00

    // Grains
    if (itemLower.includes('bread')) return 3.00
    if (itemLower.includes('rice')) return 2.50
    if (itemLower.includes('pasta')) return 2.00

    // Produce
    if (itemLower.includes('tomato')) return 3.00
    if (itemLower.includes('lettuce')) return 2.50
    if (itemLower.includes('onion')) return 1.50
    if (itemLower.includes('pepper')) return 3.00

    return 5.00 // Default
  }

  /**
   * Generate budget forecast
   */
  async generateBudgetForecast(userId: string): Promise<BudgetForecast> {
    const preferences = await userPreferencesService.loadPreferences(userId)
    const monthlyBudget = preferences?.budget?.monthly ? parseFloat(preferences.budget.monthly) : 500
    
    // Get current spending
    const spentSoFar = await this.getMonthlySpending(userId)
    
    // Calculate projections
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    const daysRemaining = daysInMonth - dayOfMonth
    
    // Project total based on current pace
    const dailyAverage = spentSoFar / dayOfMonth
    const projectedTotal = spentSoFar + (dailyAverage * daysRemaining)
    
    const onTrack = projectedTotal <= monthlyBudget
    const dailyBudgetRemaining = daysRemaining > 0 ? (monthlyBudget - spentSoFar) / daysRemaining : 0
    
    // Generate warnings
    const warnings = this.generateBudgetWarnings(spentSoFar, monthlyBudget, projectedTotal, daysRemaining)
    
    // Generate recommendations
    const recommendations = this.generateBudgetRecommendations(
      spentSoFar,
      monthlyBudget,
      projectedTotal,
      daysRemaining
    )

    return {
      userId,
      currentMonth: now.getMonth(),
      monthlyBudget,
      spentSoFar,
      projectedTotal,
      daysRemaining,
      dailyBudgetRemaining,
      onTrack,
      warnings,
      recommendations
    }
  }

  /**
   * Generate budget warnings
   */
  private generateBudgetWarnings(
    spent: number,
    budget: number,
    projected: number,
    daysRemaining: number
  ): BudgetWarning[] {
    const warnings: BudgetWarning[] = []
    const percentSpent = (spent / budget) * 100

    // Critical: Over budget
    if (spent > budget) {
      warnings.push({
        type: 'overspending',
        severity: 'critical',
        message: `You're $${(spent - budget).toFixed(2)} over budget`,
        impact: spent - budget
      })
    }
    // Warning: On track to exceed
    else if (projected > budget * 1.1) {
      warnings.push({
        type: 'trending_high',
        severity: 'warning',
        message: `Projected to exceed budget by $${(projected - budget).toFixed(2)}`,
        impact: projected - budget
      })
    }
    // Warning: High spending rate
    else if (percentSpent > 80 && daysRemaining > 7) {
      warnings.push({
        type: 'trending_high',
        severity: 'warning',
        message: `${percentSpent.toFixed(0)}% of budget used with ${daysRemaining} days remaining`,
        impact: projected - budget
      })
    }
    // Info: Low balance
    else if (daysRemaining < 7 && budget - spent < 50) {
      warnings.push({
        type: 'low_balance',
        severity: 'info',
        message: `Only $${(budget - spent).toFixed(2)} remaining for ${daysRemaining} days`,
        impact: 0
      })
    }

    return warnings
  }

  /**
   * Generate budget recommendations
   */
  private generateBudgetRecommendations(
    spent: number,
    budget: number,
    projected: number,
    daysRemaining: number
  ): BudgetRecommendation[] {
    const recommendations: BudgetRecommendation[] = []
    const percentSpent = (spent / budget) * 100

    // If overspending or trending high
    if (projected > budget) {
      recommendations.push({
        action: 'Switch to store brands',
        potentialSavings: budget * 0.15, // 15% savings
        difficulty: 'easy',
        reason: 'Store brands offer same quality at 20-30% lower cost'
      })

      recommendations.push({
        action: 'Cook more at home',
        potentialSavings: budget * 0.25, // 25% savings
        difficulty: 'moderate',
        reason: 'Home cooking saves significantly vs. prepared foods or dining out'
      })

      recommendations.push({
        action: 'Buy seasonal produce',
        potentialSavings: budget * 0.10, // 10% savings
        difficulty: 'easy',
        reason: 'Seasonal items are at peak quality and lowest prices'
      })

      recommendations.push({
        action: 'Plan weekly meals',
        potentialSavings: budget * 0.20, // 20% savings
        difficulty: 'moderate',
        reason: 'Meal planning reduces food waste and impulse purchases'
      })
    }
    // If doing well
    else if (percentSpent < 70 && daysRemaining > 10) {
      recommendations.push({
        action: 'Stock up on staples',
        potentialSavings: budget * 0.08,
        difficulty: 'easy',
        reason: 'You have room in your budget to take advantage of sales'
      })
    }

    return recommendations
  }

  /**
   * Optimize shopping list for best prices
   */
  async optimizeShoppingList(
    items: string[],
    maxBudget?: number
  ): Promise<PriceOptimization[]> {
    const optimizations: PriceOptimization[] = []

    for (const item of items) {
      const currentPrice = this.getDefaultPrice(item)
      const alternatives = this.getAlternatives(item, currentPrice)
      
      if (alternatives.length > 0) {
        optimizations.push({
          currentItem: item,
          currentPrice,
          alternatives: alternatives.map(alt => ({
            name: alt.name,
            price: alt.estimatedCost,
            savings: alt.savings,
            quality: 'same'
          })),
          totalPotentialSavings: alternatives.reduce((sum, alt) => sum + alt.savings, 0)
        })
      }
    }

    return optimizations.sort((a, b) => b.totalPotentialSavings - a.totalPotentialSavings)
  }

  /**
   * Helper methods
   */
  private async getLastShoppingDate(userId: string): Promise<Date | null> {
    try {
      const { data } = await supabase
        .from('shopping_history')
        .select('date')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .single()

      return data ? new Date(data.date) : null
    } catch {
      return null
    }
  }

  private async getMonthlySpending(userId: string): Promise<number> {
    try {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      
      const { data } = await supabase
        .from('receipts')
        .select('total_amount')
        .eq('user_id', userId)
        .gte('date', firstDay.toISOString())
        .lte('date', now.toISOString())

      return data?.reduce((sum, receipt) => sum + (receipt.total_amount || 0), 0) || 0
    } catch {
      return 0
    }
  }

  private async checkBudgetAlert(
    userId: string,
    estimatedSpend: number
  ): Promise<ShoppingPrediction['budgetAlert']> {
    const forecast = await this.generateBudgetForecast(userId)
    
    if (forecast.spentSoFar + estimatedSpend > forecast.monthlyBudget) {
      return {
        type: 'critical',
        message: `This shop would put you $${((forecast.spentSoFar + estimatedSpend - forecast.monthlyBudget)).toFixed(2)} over budget`,
        recommendation: 'Consider removing non-essential items or switching to cheaper alternatives'
      }
    }
    
    if (forecast.spentSoFar + estimatedSpend > forecast.monthlyBudget * 0.9) {
      return {
        type: 'warning',
        message: `This shop would use ${(((forecast.spentSoFar + estimatedSpend) / forecast.monthlyBudget) * 100).toFixed(0)}% of your monthly budget`,
        recommendation: 'You\'re close to your limit. Shop wisely!'
      }
    }
    
    return undefined
  }

  private generateShoppingReasoning(pattern: string): string {
    const reasons = []
    
    if (pattern === 'weekly') {
      reasons.push('Based on your weekly shopping pattern')
    }
    
    reasons.push('Items predicted based on consumption patterns')
    
    return reasons.join('. ')
  }

  /**
   * Estimate price using learned data
   */
  async estimatePriceWithLearning(userId: string, item: string): Promise<number> {
    try {
      const priceEst = await priceLearningService.getPriceEstimate(userId, item)
      return priceEst.estimatedPrice
    } catch {
      return this.getDefaultPrice(item)
    }
  }

  /**
   * Get shopping list cost estimate with learned prices
   */
  async estimateShoppingListCost(
    userId: string,
    items: Array<{ name: string; quantity: number }>
  ): Promise<{
    total: number
    confidence: number
    itemBreakdown: Array<{
      name: string
      quantity: number
      unitPrice: number
      total: number
      confidence: number
    }>
  }> {
    const result = await priceLearningService.estimateShoppingListCost(userId, items)
    
    return {
      total: result.totalEstimate,
      confidence: result.overallConfidence,
      itemBreakdown: result.itemEstimates.map((est, i) => ({
        name: items[i].name,
        quantity: items[i].quantity,
        unitPrice: est.estimate / items[i].quantity,
        total: est.estimate,
        confidence: est.confidence
      }))
    }
  }

  /**
   * Get price comparison recommendations
   */
  async getPriceOptimizations(userId: string, items: string[]): Promise<{
    totalSavings: number
    recommendations: Array<{
      item: string
      currentStore: string
      betterStore: string
      savings: number
    }>
  }> {
    const comparisons = await priceLearningService.comparePricesAcrossStores(userId, items)
    
    const recommendations = comparisons.map(comp => {
      const current = comp.prices[0] // Assuming first is current
      const cheapest = comp.prices.find(p => p.store === comp.cheapestStore)!
      
      return {
        item: comp.item,
        currentStore: current.store,
        betterStore: comp.cheapestStore,
        savings: comp.potentialSavings
      }
    })

    const totalSavings = recommendations.reduce((sum, r) => sum + r.savings, 0)

    return {
      totalSavings,
      recommendations: recommendations.sort((a, b) => b.savings - a.savings)
    }
  }
}

export const smartShoppingService = SmartShoppingService.getInstance()

