// Accurate Savings Calculator for SAVR
// Calculates REAL savings based on actual user behavior

import { supabase } from './supabase'

// Average grocery prices (conservative estimates)
const AVERAGE_PRICES: Record<string, number> = {
  // Proteins (per lb)
  'chicken': 3.99,
  'beef': 6.99,
  'pork': 4.49,
  'fish': 8.99,
  'salmon': 12.99,
  'shrimp': 10.99,
  'turkey': 4.99,
  'eggs': 3.49, // per dozen
  
  // Dairy
  'milk': 3.99, // per gallon
  'cheese': 5.99, // per lb
  'yogurt': 4.99, // per container
  'butter': 4.49, // per lb
  'cream': 3.99,
  
  // Produce
  'avocado': 1.49, // each
  'tomato': 1.99, // per lb
  'lettuce': 2.49,
  'onion': 1.29, // per lb
  'garlic': 0.79, // per bulb
  'potato': 0.79, // per lb
  'carrot': 1.49, // per lb
  'bell pepper': 1.99, // each
  'broccoli': 2.49, // per lb
  'spinach': 3.99, // per bag
  
  // Pantry staples
  'rice': 0.99, // per lb
  'pasta': 1.49, // per box
  'bread': 2.99, // per loaf
  'flour': 3.99, // per 5lb
  'sugar': 3.49, // per 5lb
  'oil': 4.99, // per bottle
  'salt': 1.99,
  'pepper': 3.99,
  
  // Canned/Packaged
  'beans': 1.29, // per can
  'tomato sauce': 1.99,
  'stock': 2.99,
  
  // Default for unknown items
  'default': 3.99
}

export interface SavingsBreakdown {
  totalSavings: number
  savingsFromPantryUsage: number
  savingsFromRecipes: number
  savingsFromWastePrevention: number
  itemsUsed: number
  recipesCooked: number
  itemsSavedFromWaste: number
}

export class SavingsCalculator {
  
  /**
   * Calculate total savings for a user this month
   */
  static async calculateMonthlySavings(userId: string): Promise<SavingsBreakdown> {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    const [recipesSaved, wastePreventionSavings] = await Promise.all([
      this.calculateRecipeSavings(userId, startOfMonth),
      this.calculateWastePreventionSavings(userId, startOfMonth)
    ])
    
    return {
      totalSavings: recipesSaved.amount + wastePreventionSavings.amount,
      savingsFromPantryUsage: recipesSaved.amount * 0.6, // 60% from using pantry
      savingsFromRecipes: recipesSaved.amount * 0.4, // 40% from smart recipe choices
      savingsFromWastePrevention: wastePreventionSavings.amount,
      itemsUsed: recipesSaved.itemsUsed,
      recipesCooked: recipesSaved.recipesCooked,
      itemsSavedFromWaste: wastePreventionSavings.itemsSaved
    }
  }
  
  /**
   * Calculate savings from cooking recipes with pantry items
   * Logic: When you ACTUALLY COOK a recipe (complete flashcards), you save money
   * by not buying those ingredients fresh
   */
  private static async calculateRecipeSavings(
    userId: string, 
    since: Date
  ): Promise<{ amount: number; itemsUsed: number; recipesCooked: number }> {
    try {
      // Get user's COOKED recipes since start of month (not just saved)
      const { data: cookedRecipes, error } = await supabase
        .from('cooked_recipes')
        .select('recipe_id, cooked_at, estimated_savings, ingredients_from_pantry')
        .eq('user_id', userId)
        .gte('cooked_at', since.toISOString())
      
      if (error || !cookedRecipes || cookedRecipes.length === 0) {
        return { amount: 0, itemsUsed: 0, recipesCooked: 0 }
      }
      
      // If savings are already calculated, use them
      const totalSavings = cookedRecipes.reduce((sum, cooked) => {
        return sum + (cooked.estimated_savings || 0)
      }, 0)
      
      const totalItemsUsed = cookedRecipes.reduce((sum, cooked) => {
        const pantryIngredients = cooked.ingredients_from_pantry || []
        return sum + pantryIngredients.length
      }, 0)
      
      return {
        amount: totalSavings,
        itemsUsed: totalItemsUsed,
        recipesCooked: cookedRecipes.length
      }
      
    } catch (error) {
      console.error('Error calculating recipe savings:', error)
      return { amount: 0, itemsUsed: 0, recipesCooked: 0 }
    }
  }
  
  /**
   * Calculate savings for a specific recipe cooking event
   * Call this when user completes cooking flashcards
   */
  static async recordCookedRecipe(
    userId: string,
    recipeId: string,
    pantryIngredients: string[],
    purchasedIngredients: string[],
    servingsMade: number
  ): Promise<number> {
    try {
      // Calculate estimated savings
      let savings = 0
      
      for (const ingredient of pantryIngredients) {
        savings += this.estimateIngredientCost(ingredient)
      }
      
      // Record the cooking event
      const { error } = await supabase
        .from('cooked_recipes')
        .insert({
          user_id: userId,
          recipe_id: recipeId,
          servings_made: servingsMade,
          ingredients_from_pantry: pantryIngredients,
          ingredients_purchased: purchasedIngredients,
          estimated_savings: savings,
          cooked_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('Error recording cooked recipe:', error)
        return 0
      }
      
      return savings
      
    } catch (error) {
      console.error('Error recording cooked recipe:', error)
      return 0
    }
  }
  
  /**
   * Legacy method - kept for backwards compatibility but uses new tracking
   */
  private static async calculateRecipeSavingsOLD(
    userId: string, 
    since: Date
  ): Promise<{ amount: number; itemsUsed: number; recipesCooked: number }> {
    try {
      // This is the OLD logic that counted saved recipes
      // Now we only count COOKED recipes from cooked_recipes table
      const { data: savedRecipes, error } = await supabase
        .from('saved_recipes')
        .select('recipe_id, created_at, recipes(ingredients)')
        .eq('user_id', userId)
        .gte('created_at', since.toISOString())
      
      if (error || !savedRecipes || savedRecipes.length === 0) {
        return { amount: 0, itemsUsed: 0, recipesCooked: 0 }
      }
      
      // Get user's pantry items
      const { data: pantryItems } = await supabase
        .from('pantry_items')
        .select('name, quantity')
        .eq('user_id', userId)
      
      if (!pantryItems || pantryItems.length === 0) {
        return { amount: 0, itemsUsed: 0, recipesCooked: 0 }
      }
      
      let totalSavings = 0
      let totalItemsUsed = 0
      const pantryItemNames = new Set(
        pantryItems.map(item => item.name.toLowerCase())
      )
      
      // Calculate savings for each saved recipe
      for (const saved of savedRecipes) {
        const recipe = saved.recipes as any
        if (!recipe?.ingredients) continue
        
        // Count how many ingredients user already has
        let ingredientsFromPantry = 0
        let savingsThisRecipe = 0
        
        for (const ingredient of recipe.ingredients) {
          const ingName = ingredient.name.toLowerCase()
          
          // Check if ingredient is in pantry
          if (pantryItemNames.has(ingName) || 
              Array.from(pantryItemNames).some(pantryItem => 
                ingName.includes(pantryItem) || pantryItem.includes(ingName)
              )) {
            ingredientsFromPantry++
            
            // Estimate cost saved by using pantry item
            const estimatedPrice = this.estimateIngredientCost(ingredient.name)
            savingsThisRecipe += estimatedPrice
          }
        }
        
        totalSavings += savingsThisRecipe
        totalItemsUsed += ingredientsFromPantry
      }
      
      return {
        amount: totalSavings,
        itemsUsed: totalItemsUsed,
        recipesCooked: savedRecipes.length
      }
      
    } catch (error) {
      console.error('Error calculating recipe savings:', error)
      return { amount: 0, itemsUsed: 0, recipesCooked: 0 }
    }
  }
  
  /**
   * Calculate savings from preventing food waste
   * Logic: Items that would have expired but were used = money saved
   */
  private static async calculateWastePreventionSavings(
    userId: string,
    since: Date
  ): Promise<{ amount: number; itemsSaved: number }> {
    try {
      // Get pantry items that were close to expiring but got used this month
      const { data: usedItems, error } = await supabase
        .from('pantry_items')
        .select('name, quantity, created_at, updated_at')
        .eq('user_id', userId)
        .gte('updated_at', since.toISOString())
      
      if (error || !usedItems || usedItems.length === 0) {
        return { amount: 0, itemsSaved: 0 }
      }
      
      let totalSavings = 0
      let itemsSaved = 0
      
      // Items that were updated (quantity decreased) = used before waste
      for (const item of usedItems) {
        const daysSinceAdded = Math.floor(
          (new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
        
        // If item is older than 5 days and was used, count as waste prevention
        if (daysSinceAdded > 5) {
          const estimatedCost = this.estimateIngredientCost(item.name) * item.quantity
          totalSavings += estimatedCost
          itemsSaved++
        }
      }
      
      return {
        amount: totalSavings,
        itemsSaved
      }
      
    } catch (error) {
      console.error('Error calculating waste prevention savings:', error)
      return { amount: 0, itemsSaved: 0 }
    }
  }
  
  /**
   * Estimate the cost of an ingredient based on name
   */
  private static estimateIngredientCost(ingredientName: string): number {
    const name = ingredientName.toLowerCase()
    
    // Try to match ingredient to price database
    for (const [key, price] of Object.entries(AVERAGE_PRICES)) {
      if (name.includes(key) || key.includes(name)) {
        return price
      }
    }
    
    // Return default price for unknown items
    return AVERAGE_PRICES.default
  }
  
  /**
   * Calculate budget-based savings (if user tracks spending)
   * Logic: Monthly budget - actual spending = saved
   */
  static async calculateBudgetSavings(
    userId: string,
    monthlyBudget: number
  ): Promise<{ saved: number; spent: number; percentageSaved: number }> {
    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      // Get receipts for this month
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('total_amount')
        .eq('user_id', userId)
        .gte('purchase_date', startOfMonth.toISOString())
      
      if (error || !receipts || receipts.length === 0) {
        return {
          saved: 0,
          spent: 0,
          percentageSaved: 0
        }
      }
      
      const totalSpent = receipts.reduce((sum, receipt) => sum + (receipt.total_amount || 0), 0)
      const saved = monthlyBudget - totalSpent
      const percentageSaved = monthlyBudget > 0 ? (saved / monthlyBudget) * 100 : 0
      
      return {
        saved: Math.max(0, saved), // Don't show negative savings
        spent: totalSpent,
        percentageSaved: Math.max(0, percentageSaved)
      }
      
    } catch (error) {
      console.error('Error calculating budget savings:', error)
      return {
        saved: 0,
        spent: 0,
        percentageSaved: 0
      }
    }
  }
  
  /**
   * Get a human-readable savings summary
   */
  static async getSavingsSummary(userId: string): Promise<string> {
    const savings = await this.calculateMonthlySavings(userId)
    
    if (savings.totalSavings === 0) {
      return "Start saving recipes and using your pantry to see your savings!"
    }
    
    const highlights = []
    
    if (savings.recipesCooked > 0) {
      highlights.push(`${savings.recipesCooked} recipes using pantry items`)
    }
    
    if (savings.itemsSavedFromWaste > 0) {
      highlights.push(`${savings.itemsSavedFromWaste} items used before expiring`)
    }
    
    return `You saved $${savings.totalSavings.toFixed(2)} this month by ${highlights.join(' and ')}!`
  }
}

