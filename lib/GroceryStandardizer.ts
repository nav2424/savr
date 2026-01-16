// SAVR Grocery Standardizer - Converts recipe quantities to shopping quantities
// Makes shopping lists intelligent and realistic

export interface StandardizedGroceryItem {
  name: string
  quantity: string
  unit: string
  displayName: string
  category: string
  notes?: string
}

class GroceryStandardizer {
  private static instance: GroceryStandardizer

  static getInstance(): GroceryStandardizer {
    if (!GroceryStandardizer.instance) {
      GroceryStandardizer.instance = new GroceryStandardizer()
    }
    return GroceryStandardizer.instance
  }

  // Convert recipe ingredient to shopping list item
  standardizeForShopping(
    ingredientName: string,
    recipeQuantity: string,
    recipeUnit: string,
    recipeName: string
  ): StandardizedGroceryItem {
    const nameLower = ingredientName.toLowerCase().trim()
    
    // CRITICAL: Even if recipe says "to taste" or has no unit,
    // always return purchasable store quantities (never "to taste")
    
    // DAIRY PRODUCTS
    if (nameLower.includes('sour cream')) {
      return {
        name: 'Sour cream',
        quantity: '1',
        unit: 'container',
        displayName: 'Sour cream',
        category: 'Dairy',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('heavy cream') || nameLower.includes('whipping cream')) {
      return {
        name: 'Heavy cream',
        quantity: '1',
        unit: 'pint',
        displayName: 'Heavy cream',
        category: 'Dairy',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('milk')) {
      return {
        name: 'Milk',
        quantity: '1',
        unit: 'gallon',
        displayName: 'Milk',
        category: 'Dairy',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('yogurt')) {
      return {
        name: 'Yogurt',
        quantity: '1',
        unit: 'container',
        displayName: 'Yogurt',
        category: 'Dairy',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('butter')) {
      return {
        name: 'Butter',
        quantity: '1',
        unit: 'stick',
        displayName: 'Butter',
        category: 'Dairy',
        notes: `For ${recipeName}`
      }
    }
    
    // CHEESE
    if (nameLower.includes('cheese')) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '1',
        unit: 'bag',
        displayName: this.capitalize(ingredientName),
        category: 'Dairy',
        notes: `For ${recipeName}`
      }
    }
    
    // SEASONINGS & SPICES
    if (nameLower === 'salt' || nameLower.includes('salt')) {
      return {
        name: 'Salt',
        quantity: '1',
        unit: 'container',
        displayName: 'Salt',
        category: 'Condiments',
        notes: `For ${recipeName}`
      }
    }
    
    // CRITICAL: Black pepper can NEVER be "to taste" - always return purchasable unit
    // Even if recipe says "to taste" or has no unit, return "1 container"
    if (nameLower === 'pepper' || nameLower === 'black pepper' || 
        nameLower.includes('black pepper') || nameLower.includes('peppercorn')) {
      return {
        name: 'Black pepper',
        quantity: '1',
        unit: 'container',
        displayName: 'Black pepper',
        category: 'Condiments',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('cumin') || nameLower.includes('paprika') || 
        nameLower.includes('oregano') || nameLower.includes('basil') ||
        nameLower.includes('thyme') || nameLower.includes('rosemary')) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '1',
        unit: 'jar',
        displayName: this.capitalize(ingredientName),
        category: 'Condiments',
        notes: `For ${recipeName}`
      }
    }
    
    // OILS & SAUCES
    if (nameLower.includes('oil')) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '1',
        unit: 'bottle',
        displayName: this.capitalize(ingredientName),
        category: 'Condiments',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('sauce') || nameLower.includes('salsa')) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '1',
        unit: 'jar',
        displayName: this.capitalize(ingredientName),
        category: 'Condiments',
        notes: `For ${recipeName}`
      }
    }
    
    // VEGETABLES
    if (nameLower.includes('lettuce')) {
      return {
        name: 'Lettuce',
        quantity: '1',
        unit: 'head',
        displayName: 'Lettuce',
        category: 'Produce',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('tomato') && !nameLower.includes('sauce')) {
      // If it says "diced tomatoes", get canned
      if (nameLower.includes('diced') || nameLower.includes('crushed') || nameLower.includes('canned')) {
        return {
          name: this.capitalize(ingredientName),
          quantity: '1',
          unit: 'can',
          displayName: this.capitalize(ingredientName),
          category: 'Canned Goods',
          notes: `For ${recipeName}`
        }
      }
      // Fresh tomatoes
      return {
        name: 'Tomatoes',
        quantity: '4',
        unit: 'pieces',
        displayName: 'Tomatoes',
        category: 'Produce',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('onion') || nameLower.includes('shallot')) {
      const displayName = nameLower.includes('shallot') ? 'Shallots' : this.capitalize(ingredientName)
      return {
        name: displayName,
        quantity: '1',
        unit: 'bunch',
        displayName: displayName,
        category: 'Produce',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('garlic')) {
      return {
        name: 'Garlic',
        quantity: '1',
        unit: 'bulb',
        displayName: 'Garlic',
        category: 'Produce',
        notes: `For ${recipeName}`
      }
    }
    
    // Sweet potatoes
    if (nameLower.includes('sweet potato')) {
      return {
        name: 'Sweet potatoes',
        quantity: '2',
        unit: 'pieces',
        displayName: 'Sweet potatoes',
        category: 'Produce',
        notes: `For ${recipeName}`
      }
    }
    
    if (nameLower.includes('pepper') && (nameLower.includes('bell') || nameLower.includes('red') || nameLower.includes('green'))) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '2',
        unit: 'pieces',
        displayName: this.capitalize(ingredientName),
        category: 'Produce',
        notes: `For ${recipeName}`
      }
    }
    
    // CITRUS
    if (nameLower.includes('lime') || nameLower.includes('lemon')) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '3',
        unit: 'pieces',
        displayName: this.capitalize(ingredientName),
        category: 'Produce',
        notes: `For ${recipeName}`
      }
    }
    
    // CILANTRO, PARSLEY
    if (nameLower.includes('cilantro') || nameLower.includes('parsley')) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '1',
        unit: 'bunch',
        displayName: this.capitalize(ingredientName),
        category: 'Produce',
        notes: `For ${recipeName}`
      }
    }
    
    // PROTEINS - Keep as-is but round to whole pounds
    if (nameLower.includes('chicken') || nameLower.includes('beef') || 
        nameLower.includes('pork') || nameLower.includes('fish') ||
        nameLower.includes('salmon') || nameLower.includes('shrimp')) {
      const qty = parseFloat(recipeQuantity) || 1
      return {
        name: this.capitalize(ingredientName),
        quantity: String(Math.ceil(qty)),
        unit: 'lb',
        displayName: this.capitalize(ingredientName),
        category: 'Meat',
        notes: `For ${recipeName}`
      }
    }
    
    // TORTILLAS
    if (nameLower.includes('tortilla')) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '1',
        unit: 'pack',
        displayName: this.capitalize(ingredientName),
        category: 'Grains',
        notes: `For ${recipeName}`
      }
    }
    
    // BREAD
    if (nameLower.includes('bread')) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '1',
        unit: 'loaf',
        displayName: this.capitalize(ingredientName),
        category: 'Grains',
        notes: `For ${recipeName}`
      }
    }
    
    // RICE, PASTA
    if (nameLower.includes('rice') || nameLower.includes('pasta')) {
      return {
        name: this.capitalize(ingredientName),
        quantity: '1',
        unit: 'box',
        displayName: this.capitalize(ingredientName),
        category: 'Grains',
        notes: `For ${recipeName}`
      }
    }
    
    // EGGS
    if (nameLower.includes('egg')) {
      return {
        name: 'Eggs',
        quantity: '1',
        unit: 'dozen',
        displayName: 'Eggs',
        category: 'Dairy',
        notes: `For ${recipeName}`
      }
    }
    
    // DEFAULT: Use original but clean it up
    return {
      name: this.capitalize(ingredientName),
      quantity: recipeQuantity,
      unit: recipeUnit,
      displayName: this.capitalize(ingredientName),
      category: 'Other',
      notes: `For ${recipeName}`
    }
  }

  // Helper: Capitalize ingredient name
  private capitalize(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }
}

export const groceryStandardizer = GroceryStandardizer.getInstance()

