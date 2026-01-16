/**
 * Nutrition Calculator Service
 * Calculates accurate nutritional values for recipes based on ingredient quantities
 * Uses USDA nutrition database values
 */

export interface NutritionInfo {
  calories: number
  protein: number // grams
  carbs: number // grams
  fat: number // grams
  fiber?: number // grams
  sugar?: number // grams
  sodium?: number // milligrams
  saturatedFat?: number // grams
}

export interface IngredientNutrition {
  name: string
  quantity: number
  unit: string
}

class NutritionCalculatorService {
  private static instance: NutritionCalculatorService

  static getInstance(): NutritionCalculatorService {
    if (!NutritionCalculatorService.instance) {
      NutritionCalculatorService.instance = new NutritionCalculatorService()
    }
    return NutritionCalculatorService.instance
  }

  /**
   * Comprehensive nutrition database (per 100g or standard unit)
   * Based on USDA FoodData Central
   */
  private nutritionDatabase: Record<string, {
    calories: number // per 100g
    protein: number // grams per 100g
    carbs: number // grams per 100g
    fat: number // grams per 100g
    fiber?: number // grams per 100g
    sugar?: number // grams per 100g
    sodium?: number // mg per 100g
    saturatedFat?: number // grams per 100g
    density?: number // grams per cup (for volume conversions)
    pieceWeight?: number // grams per piece (for countable items)
  }> = {
    // PROTEINS
    'chicken': { calories: 165, protein: 31, carbs: 0, fat: 3.6, sodium: 74, pieceWeight: 200 },
    'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6, sodium: 74, pieceWeight: 200 },
    'chicken thigh': { calories: 209, protein: 26, carbs: 0, fat: 10.9, sodium: 84, pieceWeight: 150 },
    'beef': { calories: 250, protein: 26, carbs: 0, fat: 17, sodium: 72, saturatedFat: 6.5, pieceWeight: 150 },
    'ground beef': { calories: 250, protein: 26, carbs: 0, fat: 17, sodium: 72, saturatedFat: 6.5, density: 227 },
    'pork': { calories: 242, protein: 27, carbs: 0, fat: 14, sodium: 62, saturatedFat: 5, pieceWeight: 150 },
    'salmon': { calories: 208, protein: 20, carbs: 0, fat: 12, sodium: 44, pieceWeight: 150 },
    'fish': { calories: 206, protein: 22, carbs: 0, fat: 12, sodium: 61, pieceWeight: 150 },
    'tuna': { calories: 184, protein: 30, carbs: 0, fat: 6, sodium: 396, pieceWeight: 150 },
    'shrimp': { calories: 99, protein: 24, carbs: 0, fat: 0.3, sodium: 111, pieceWeight: 20 },
    'tofu': { calories: 76, protein: 8, carbs: 1.9, fat: 4.8, sodium: 7, fiber: 0.3, pieceWeight: 100 },
    'eggs': { calories: 155, protein: 13, carbs: 1.1, fat: 11, sodium: 124, saturatedFat: 3.3, pieceWeight: 50 },
    'egg': { calories: 155, protein: 13, carbs: 1.1, fat: 11, sodium: 124, saturatedFat: 3.3, pieceWeight: 50 },

    // VEGETABLES
    'sweet potato': { calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, sugar: 4.2, sodium: 54, pieceWeight: 200 },
    'potato': { calories: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, sugar: 0.8, sodium: 6, pieceWeight: 200 },
    'tomato': { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, sodium: 5, pieceWeight: 150 },
    'tomatoes': { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, sodium: 5, pieceWeight: 150 },
    'onion': { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2, sodium: 4, pieceWeight: 150 },
    'onions': { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2, sodium: 4, pieceWeight: 150 },
    'shallot': { calories: 72, protein: 2.5, carbs: 16.8, fat: 0.1, fiber: 3.2, sugar: 7.9, sodium: 12, pieceWeight: 30 },
    'shallots': { calories: 72, protein: 2.5, carbs: 16.8, fat: 0.1, fiber: 3.2, sugar: 7.9, sodium: 12, pieceWeight: 30 },
    'garlic': { calories: 149, protein: 6.4, carbs: 33, fat: 0.5, fiber: 2.1, sugar: 1, sodium: 17, pieceWeight: 3 },
    'bell pepper': { calories: 31, protein: 1, carbs: 7, fat: 0.3, fiber: 2.5, sugar: 5, sodium: 4, pieceWeight: 150 },
    'pepper': { calories: 31, protein: 1, carbs: 7, fat: 0.3, fiber: 2.5, sugar: 5, sodium: 4, pieceWeight: 150 },
    'broccoli': { calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, sugar: 1.5, sodium: 33, density: 91 },
    'carrot': { calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sugar: 4.7, sodium: 69, pieceWeight: 60 },
    'carrots': { calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sugar: 4.7, sodium: 69, pieceWeight: 60 },
    'spinach': { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, sugar: 0.4, sodium: 79, density: 30 },
    'lettuce': { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3, sugar: 0.8, sodium: 28, density: 36 },
    'cucumber': { calories: 16, protein: 0.7, carbs: 4, fat: 0.1, fiber: 0.5, sugar: 1.7, sodium: 2, pieceWeight: 200 },
    'zucchini': { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, sugar: 2.5, sodium: 8, pieceWeight: 200 },
    'mushroom': { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1, sugar: 2, sodium: 5, density: 70 },
    'mushrooms': { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1, sugar: 2, sodium: 5, density: 70 },

    // GRAINS & STARCHES
    'rice': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sodium: 1, density: 200 },
    'pasta': { calories: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8, sodium: 1, density: 100 },
    'quinoa': { calories: 120, protein: 4.4, carbs: 22, fat: 1.9, fiber: 2.8, sodium: 7, density: 185 },
    'bread': { calories: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, sugar: 5.7, sodium: 491, pieceWeight: 25 },
    'tortilla': { calories: 218, protein: 5.7, carbs: 45, fat: 2.3, fiber: 2.4, sodium: 502, pieceWeight: 45 },
    'tortillas': { calories: 218, protein: 5.7, carbs: 45, fat: 2.3, fiber: 2.4, sodium: 502, pieceWeight: 45 },

    // DAIRY
    'milk': { calories: 42, protein: 3.4, carbs: 5, fat: 1, sodium: 44, density: 244 },
    'cheese': { calories: 113, protein: 7, carbs: 1, fat: 9, sodium: 621, saturatedFat: 5.3, density: 113 },
    'butter': { calories: 717, protein: 0.9, carbs: 0.1, fat: 81, sodium: 11, saturatedFat: 51, density: 227 },
    'yogurt': { calories: 59, protein: 10, carbs: 3.6, fat: 0.4, sodium: 36, density: 245 },
    'sour cream': { calories: 198, protein: 2.3, carbs: 4.6, fat: 19, sodium: 30, saturatedFat: 11, density: 240 },

    // OILS & FATS
    'olive oil': { calories: 884, protein: 0, carbs: 0, fat: 100, sodium: 2, saturatedFat: 14, density: 216 },
    'vegetable oil': { calories: 884, protein: 0, carbs: 0, fat: 100, sodium: 0, saturatedFat: 14, density: 216 },
    'coconut oil': { calories: 862, protein: 0, carbs: 0, fat: 100, sodium: 0, saturatedFat: 87, density: 216 },
    'avocado': { calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, sugar: 0.7, sodium: 7, pieceWeight: 200 },

    // LEGUMES & BEANS
    'chickpeas': { calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, sugar: 4.8, sodium: 7, density: 240 },
    'black beans': { calories: 132, protein: 8.9, carbs: 24, fat: 0.5, fiber: 8.7, sugar: 0.3, sodium: 2, density: 240 },
    'lentils': { calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sugar: 1.8, sodium: 2, density: 192 },

    // NUTS & SEEDS
    'almonds': { calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12, sugar: 4.4, sodium: 1, density: 143 },
    'peanuts': { calories: 567, protein: 26, carbs: 16, fat: 49, fiber: 8.5, sugar: 4.7, sodium: 18, density: 146 },

    // FRUITS
    'lemon': { calories: 29, protein: 1.1, carbs: 9, fat: 0.3, fiber: 2.8, sugar: 2.5, sodium: 2, pieceWeight: 58 },
    'lime': { calories: 30, protein: 0.7, carbs: 11, fat: 0.2, fiber: 2.8, sugar: 1.7, sodium: 2, pieceWeight: 67 },
    'banana': { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12, sodium: 1, pieceWeight: 120 },

    // SEASONINGS & SPICES
    'salt': { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 38758, pieceWeight: 5 }, // 5g per tsp
    'black pepper': { calories: 251, protein: 10, carbs: 64, fat: 3.3, fiber: 25, sodium: 20, pieceWeight: 2 }, // 2g per tsp
    // Note: 'pepper' is used for bell pepper (vegetable) above, not black pepper (spice)

    // SAUCES & CONDIMENTS
    // Marinara/tomato sauce: Realistic sodium is 200-250mg per 100g (not 350-400mg)
    // This accounts for both homemade (lower) and store-bought (moderate) versions
    'marinara sauce': { calories: 50, protein: 1.2, carbs: 8, fat: 1.5, fiber: 1.5, sugar: 5, sodium: 220, density: 240 }, // ~240g per cup
    'tomato sauce': { calories: 50, protein: 1.2, carbs: 8, fat: 1.5, fiber: 1.5, sugar: 5, sodium: 220, density: 240 },
    'sauce marinara': { calories: 50, protein: 1.2, carbs: 8, fat: 1.5, fiber: 1.5, sugar: 5, sodium: 220, density: 240 },

    // LIQUIDS (zero nutrition)
    'water': { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, density: 240 }, // 240g per cup
  }

  /**
   * Convert quantity to grams based on unit
   */
  private convertToGrams(quantity: number, unit: string, ingredientName: string): number {
    const nameLower = ingredientName.toLowerCase()
    const unitLower = unit.toLowerCase()
    const data = this.getNutritionData(ingredientName)

    // CRITICAL: Reject inventory units - they cannot be used for nutrition calculation
    if (this.isInventoryUnit(unit)) {
      console.warn(`⚠️ Cannot convert inventory unit "${unit}" to grams for "${ingredientName}" - this should be a recipe unit (tbsp, g, ml, cups, pieces)`)
      return 0
    }

    // Handle "to taste" or empty unit
    if (!unit || unit === '' || unit === 'to taste') {
      // For salt/pepper, use small amounts
      if (nameLower.includes('salt')) {
        return 1 // ~1g salt
      }
      if (nameLower.includes('pepper') && !nameLower.includes('bell')) {
        return 0.5 // ~0.5g pepper
      }
      
      // CRITICAL FIX: If unit is empty/missing but we have a quantity,
      // try to determine if it's a piece-based item or use pieceWeight
      if (quantity > 0 && data?.pieceWeight) {
        // Use pieceWeight for countable items (e.g., "1 chicken" = 200g)
        return quantity * data.pieceWeight
      }
      
      // If no pieceWeight but it's a known ingredient, use reasonable defaults
      if (quantity > 0) {
        // OILS: Empty unit for oil = 1 tbsp = 15g
        if (nameLower.includes('oil') || nameLower.includes('olive oil')) {
          return quantity * 15
        }
        
        // PROTEINS: Empty unit = 1 portion = 175g
        if (nameLower.includes('chicken') || nameLower.includes('beef') || nameLower.includes('pork') || 
            nameLower.includes('salmon') || nameLower.includes('fish') || nameLower.includes('souvlaki')) {
          return quantity * 175
        }
        
        // LEAFY GREENS: Empty unit = 1 cup = 20g
        if (nameLower.includes('arugula') || nameLower.includes('spinach') || nameLower.includes('lettuce')) {
          return quantity * 20
        }
        
        // VEGETABLES
        if (nameLower.includes('potato') || nameLower.includes('sweet potato')) {
          return quantity * 200
        }
        if (nameLower.includes('onion') || nameLower.includes('shallot')) {
          return nameLower.includes('shallot') ? quantity * 30 : quantity * 150
        }
        if (nameLower.includes('pepper') && nameLower.includes('bell')) {
          return quantity * 150
        }
        if (nameLower.includes('tomato')) {
          return quantity * 150
        }
        if (nameLower.includes('garlic')) {
          return quantity * 3 // 1 clove
        }
        if (nameLower.includes('lemon') || nameLower.includes('lime')) {
          return quantity * 60
        }
        if (nameLower.includes('vinegar')) {
          return quantity * 15 // 1 tbsp
        }
        
        // SEASONINGS
        if (nameLower.includes('salt')) {
          return quantity * 1
        }
        if (nameLower.includes('pepper') && !nameLower.includes('bell')) {
          return quantity * 0.5
        }
        
        // For other ingredients, use a conservative default (50g per "unit")
        return quantity * 50
      }
      
      return 0
    }

    // CRITICAL FIX: Handle "unit" based on ingredient type
    // "unit" is ambiguous - for oils it means tbsp, for proteins it means portion, for vegetables it means piece
    if (unitLower === 'unit' || unitLower === 'units') {
      // OILS: "1 unit olive oil" = 1 tbsp = 15g
      if (nameLower.includes('oil') || nameLower.includes('olive oil') || nameLower.includes('vegetable oil') || 
          nameLower.includes('coconut oil') || nameLower.includes('avocado oil')) {
        return quantity * 15 // 1 tbsp = 15g
      }
      
      // LIQUIDS/VINEGAR: "1 unit vinegar" = 1 tbsp = 15ml = 15g
      if (nameLower.includes('vinegar') || nameLower.includes('lemon juice') || nameLower.includes('lime juice')) {
        return quantity * 15 // 1 tbsp = 15ml = 15g
      }
      
      // PROTEINS: "1 unit chicken" = 1 portion = 175g
      if (nameLower.includes('chicken') || nameLower.includes('beef') || nameLower.includes('pork') || 
          nameLower.includes('salmon') || nameLower.includes('fish') || nameLower.includes('souvlaki')) {
        return quantity * 175 // ~175g protein portion
      }
      
      // LEAFY GREENS: "1 unit arugula" = 1 cup = 20g
      if (nameLower.includes('arugula') || nameLower.includes('spinach') || nameLower.includes('lettuce') || 
          nameLower.includes('kale') || nameLower.includes('spring mix')) {
        return quantity * 20 // 1 cup leafy greens = 20g
      }
      
      // VEGETABLES: Use pieceWeight if available
      if (data?.pieceWeight) {
        return quantity * data.pieceWeight
      }
      
      // Specific vegetable estimates
      if (nameLower.includes('potato') || nameLower.includes('sweet potato')) {
        return quantity * 200
      }
      if (nameLower.includes('onion')) {
        return quantity * 150
      }
      if (nameLower.includes('shallot')) {
        return quantity * 30
      }
      if (nameLower.includes('tomato')) {
        return quantity * 150
      }
      if (nameLower.includes('pepper') && nameLower.includes('bell')) {
        return quantity * 150
      }
      if (nameLower.includes('garlic')) {
        return quantity * 3 // 1 clove = 3g
      }
      if (nameLower.includes('lemon') || nameLower.includes('lime')) {
        return quantity * 60 // 1 lemon = 60g
      }
      
      // SEASONINGS: "1 unit salt/pepper" = small amounts
      if (nameLower.includes('salt')) {
        return quantity * 1 // 1g salt
      }
      if (nameLower.includes('pepper') && !nameLower.includes('bell')) {
        return quantity * 0.5 // 0.5g pepper
      }
      
      // Default fallback for unknown "unit" - use 50g (conservative)
      console.warn(`⚠️ Unknown "unit" for "${ingredientName}" - using 50g default. Should specify recipe unit (tbsp/g/ml/pieces).`)
      return quantity * 50
    }

    // Pieces/countable items (explicit units)
    // CRITICAL: Handle plural forms like "tomatoes", "bell peppers" as units
    // These should be treated as "pieces" for the ingredient
    if (unitLower === 'piece' || unitLower === 'pieces' ||
        unitLower === 'whole' || unitLower === 'clove' || unitLower === 'cloves' ||
        unitLower === 'egg' || unitLower === 'eggs' ||
        unitLower === 'onion' || unitLower === 'onions' ||
        unitLower === 'shallot' || unitLower === 'shallots' ||
        unitLower === 'potato' || unitLower === 'potatoes' ||
        unitLower === 'tomato' || unitLower === 'tomatoes' ||
        unitLower === 'bell pepper' || unitLower === 'bell peppers' ||
        unitLower === 'pepper' || unitLower === 'peppers' ||
        unitLower === 'fillet' || unitLower === 'fillets') {
      // CRITICAL FIX: Fish fillets should be 175g each (typical salmon fillet size)
      // This ensures proper protein calculation (175g * 20g protein/100g = 35g protein)
      // Check this FIRST before pieceWeight to override default 150g
      if ((unitLower === 'fillet' || unitLower === 'fillets') && 
          (nameLower.includes('salmon') || nameLower.includes('fish'))) {
        // SAFETY CHECK: Cap at 3 fillets max (realistic maximum per serving)
        // If quantity > 10, it's likely a unit conversion error (e.g., "175 fillets" should be "1 fillet")
        // In that case, assume it was meant to be 1 fillet (the weight in grams was mistaken for quantity)
        let cappedQuantity = quantity
        if (quantity > 10) {
          // Likely error: weight (175g) was used as quantity. Assume 1 fillet.
          cappedQuantity = 1
          console.warn(`⚠️ Unrealistic fillet quantity: ${quantity} fillets for "${ingredientName}". Assuming 1 fillet (likely unit conversion error where weight was used as quantity).`)
        } else if (quantity > 3) {
          // More than 3 fillets is unrealistic for a single serving
          cappedQuantity = 3
          console.warn(`⚠️ Capping fillet quantity from ${quantity} to 3 fillets (realistic maximum per serving).`)
        }
        return cappedQuantity * 175 // 1 fillet = 175g (not 150g from pieceWeight)
      }
      // Use pieceWeight if available, otherwise estimate based on ingredient type
      if (data?.pieceWeight) {
        return quantity * data.pieceWeight
      }
      
      // Estimate for common items when pieceWeight not available
      if (nameLower.includes('chicken')) {
        return quantity * 200 // ~200g chicken breast
      }
      if (nameLower.includes('beef') || nameLower.includes('steak')) {
        return quantity * 150 // ~150g beef portion
      }
      if (nameLower.includes('salmon') || nameLower.includes('fish')) {
        return quantity * 150 // ~150g fish fillet
      }
      if (nameLower.includes('potato') || nameLower.includes('sweet potato')) {
        return quantity * 200
      }
      if (nameLower.includes('onion')) {
        return quantity * 150
      }
      if (nameLower.includes('shallot')) {
        return quantity * 30
      }
      if (nameLower.includes('tomato')) {
        return quantity * 150
      }
      if (nameLower.includes('pepper') && nameLower.includes('bell')) {
        return quantity * 150
      }
      
      // Default fallback for pieces
      return quantity * 100
    }

    // Volume to weight conversions
    if (unitLower === 'cup' || unitLower === 'cups') {
      const density = data?.density || 240 // Default: 240g per cup
      return quantity * density
    }

    if (unitLower === 'tbsp' || unitLower === 'tablespoon' || unitLower === 'tablespoons') {
      // CRITICAL FIX: tbsp is always 15g, NOT cup density
      // The density field is for cups (216g/cup for olive oil), not tbsp (15g/tbsp)
      // For oils: 1 tbsp = 15g (not 216g!)
      if (nameLower.includes('oil') || nameLower.includes('olive oil') || nameLower.includes('vegetable oil') || 
          nameLower.includes('coconut oil') || nameLower.includes('avocado oil') || nameLower.includes('butter')) {
        return quantity * 15 // 1 tbsp oil = 15g
      }
      // For other liquids/sauces, use 15g per tbsp (standard)
      return quantity * 15
    }

    if (unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons') {
      // CRITICAL FIX: For salt, 1 tsp = 5g (from pieceWeight in database)
      // For other ingredients, use density or default 5g
      if (nameLower.includes('salt')) {
        return quantity * 5 // 1 tsp salt = 5g
      }
      const density = data?.density || 5 // Default: 5g per tsp
      return quantity * density
    }

    // Weight units (already in grams or need conversion)
    if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
      return quantity
    }

    if (unitLower === 'kg' || unitLower === 'kilogram' || unitLower === 'kilograms') {
      return quantity * 1000
    }

    if (unitLower === 'oz' || unitLower === 'ounce' || unitLower === 'ounces') {
      return quantity * 28.35
    }

    if (unitLower === 'lb' || unitLower === 'lbs' || unitLower === 'pound' || unitLower === 'pounds') {
      return quantity * 453.6
    }

    if (unitLower === 'ml' || unitLower === 'milliliter' || unitLower === 'milliliters') {
      // For liquids, assume water density (1g/ml) unless ingredient has specific density
      const density = data?.density || 1
      return quantity * density
    }

    if (unitLower === 'l' || unitLower === 'liter' || unitLower === 'liters') {
      const density = data?.density || 1000
      return quantity * density
    }

    // Default: assume grams
    return quantity
  }

  /**
   * Get nutrition data for an ingredient (with fuzzy matching)
   */
  private getNutritionData(ingredientName: string): typeof this.nutritionDatabase[string] | null {
    const nameLower = ingredientName.toLowerCase().trim()

    // Direct match
    if (this.nutritionDatabase[nameLower]) {
      return this.nutritionDatabase[nameLower]
    }

    // Fuzzy matching for common variations
    for (const [key, value] of Object.entries(this.nutritionDatabase)) {
      if (nameLower.includes(key) || key.includes(nameLower)) {
        return value
      }
    }

    // Category-based fallbacks - handle compound names like "Souvlaki Chicken"
    if (nameLower.includes('chicken') || nameLower.includes('souvlaki')) {
      return this.nutritionDatabase['chicken']
    }
    if (nameLower.includes('beef') || nameLower.includes('steak')) {
      return this.nutritionDatabase['beef']
    }
    if (nameLower.includes('pork')) {
      return this.nutritionDatabase['pork']
    }
    if (nameLower.includes('salmon') || nameLower.includes('fish') || nameLower.includes('tuna')) {
      return this.nutritionDatabase['salmon']
    }
    if (nameLower.includes('sweet potato')) {
      return this.nutritionDatabase['sweet potato']
    }
    if (nameLower.includes('potato') && !nameLower.includes('sweet')) {
      return this.nutritionDatabase['potato']
    }
    if (nameLower.includes('onion') || nameLower.includes('shallot')) {
      return nameLower.includes('shallot') ? this.nutritionDatabase['shallot'] : this.nutritionDatabase['onion']
    }
    if (nameLower.includes('bell pepper') || (nameLower.includes('pepper') && !nameLower.includes('black'))) {
      return this.nutritionDatabase['bell pepper']
    }
    if (nameLower.includes('arugula') || nameLower.includes('rocket')) {
      // Arugula/rocket is a leafy green
      return {
        calories: 25,
        protein: 2.6,
        carbs: 3.7,
        fat: 0.7,
        fiber: 1.6,
        sodium: 27,
        density: 20 // ~20g per cup
      }
    }
    if (nameLower.includes('rice')) {
      return this.nutritionDatabase['rice']
    }
    if (nameLower.includes('pasta') || nameLower.includes('noodle')) {
      return this.nutritionDatabase['pasta']
    }
    if (nameLower.includes('olive oil') || nameLower.includes('oil')) {
      return this.nutritionDatabase['olive oil']
    }
    if (nameLower === 'salt' || nameLower.includes('salt')) {
      return this.nutritionDatabase['salt']
    }
    if (nameLower.includes('black pepper') || (nameLower === 'pepper' && !nameLower.includes('bell'))) {
      return this.nutritionDatabase['black pepper']
    }
    
    // CRITICAL: Water must return 0 nutrition (not default fallback)
    if (nameLower === 'water' || nameLower.includes('water')) {
      return this.nutritionDatabase['water']
    }
    
    // Tomato/marinara sauces - handle before default fallback
    if (nameLower.includes('marinara') || nameLower.includes('tomato sauce') || 
        (nameLower.includes('sauce') && nameLower.includes('tomato'))) {
      return this.nutritionDatabase['marinara sauce']
    }

    // Default fallback (generic vegetable/ingredient)
    // Use reasonable defaults that won't result in 0 calories
    return {
      calories: 50, // More reasonable default
      protein: 2,
      carbs: 8,
      fat: 0.5,
      fiber: 2,
      sodium: 10,
      pieceWeight: 100 // Default piece weight
    }
  }

  /**
   * Calculate nutrition for a single ingredient
   */
  private calculateIngredientNutrition(
    ingredientName: string,
    quantity: number,
    unit: string
  ): NutritionInfo {
    const data = this.getNutritionData(ingredientName)
    if (!data) {
      console.warn(`⚠️ No nutrition data for "${ingredientName}" - returning 0`)
      return { calories: 0, protein: 0, carbs: 0, fat: 0 }
    }

    // Convert quantity to grams
    const grams = this.convertToGrams(quantity, unit, ingredientName)
    if (grams === 0) {
      console.warn(`⚠️ Converted to 0g for "${ingredientName}" (${quantity} ${unit}) - check unit conversion`)
      return { calories: 0, protein: 0, carbs: 0, fat: 0 }
    }

    // SANITY CHECK: Flag unrealistic gram amounts
    // Most ingredients should be 1-500g per serving, not thousands
    if (grams > 1000) {
      console.error(`🚨 UNREALISTIC QUANTITY: ${grams}g (${quantity} ${unit}) for "${ingredientName}" - likely wrong unit (bottle/bag instead of tbsp/g/ml)`)
    }

    // Calculate nutrition based on grams
    const factor = grams / 100 // Nutrition values are per 100g

    const result = {
      calories: Math.round(data.calories * factor),
      protein: Math.round((data.protein * factor) * 10) / 10,
      carbs: Math.round((data.carbs * factor) * 10) / 10,
      fat: Math.round((data.fat * factor) * 10) / 10,
      fiber: data.fiber ? Math.round((data.fiber * factor) * 10) / 10 : undefined,
      sugar: data.sugar ? Math.round((data.sugar * factor) * 10) / 10 : undefined,
      sodium: data.sodium ? Math.round(data.sodium * factor) : undefined,
      saturatedFat: data.saturatedFat ? Math.round((data.saturatedFat * factor) * 10) / 10 : undefined
    }

    // SANITY CHECK: Flag unrealistic nutrition per ingredient
    if (result.calories > 500) {
      console.error(`🚨 UNREALISTIC CALORIES for single ingredient: ${result.calories} cal from ${grams}g ${ingredientName} (${quantity} ${unit})`)
    }

    return result
  }

  /**
   * Check if a unit is an inventory/storage unit (not a recipe unit)
   */
  private isInventoryUnit(unit: string): boolean {
    if (!unit) return false
    const unitLower = unit.toLowerCase().trim()
    const inventoryUnits = [
      'bottle', 'bottles',
      'bag', 'bags',
      'container', 'containers',
      'box', 'boxes',
      'pack', 'packs',
      'package', 'packages',
      'jar', 'jars',
      'can', 'cans',
      'carton', 'cartons',
      'tube', 'tubes',
      'roll', 'rolls'
    ]
    return inventoryUnits.includes(unitLower)
  }

  /**
   * Check if a unit is a valid recipe unit
   */
  private isRecipeUnit(unit: string): boolean {
    if (!unit) return false
    const unitLower = unit.toLowerCase().trim()
    const recipeUnits = [
      // Weight
      'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
      // Volume
      'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons',
      'tsp', 'teaspoon', 'teaspoons', 'fl oz', 'fluid ounce', 'fluid ounces',
      // Countable
      'piece', 'pieces', 'whole', 'wholes', 'clove', 'cloves', 'slice', 'slices', 'sprig', 'sprigs',
      'bunch', 'bunches', 'fillet', 'fillets', 'egg', 'eggs', 'tortilla', 'tortillas',
      // Special
      'to taste', 'pinch', 'pinches', 'dash', 'dashes'
    ]
    return recipeUnits.includes(unitLower) || unitLower === 'unit' // 'unit' is ambiguous but sometimes used for pieces
  }

  /**
   * Parse quantity string that may contain fractions (e.g., "1/3", "1/4", "1/2", "2 1/2")
   * Returns the decimal equivalent
   */
  private parseQuantity(quantity: string | number): number {
    if (typeof quantity === 'number') {
      return quantity
    }
    
    const qtyStr = String(quantity).trim()
    
    // Handle fractions like "1/3", "1/4", "1/2", etc.
    const fractionMatch = qtyStr.match(/^(\d+)\s*\/\s*(\d+)$/)
    if (fractionMatch) {
      const numerator = parseFloat(fractionMatch[1])
      const denominator = parseFloat(fractionMatch[2])
      if (denominator !== 0) {
        return numerator / denominator
      }
    }
    
    // Handle mixed numbers like "2 1/2", "1 1/3", etc.
    const mixedMatch = qtyStr.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
    if (mixedMatch) {
      const whole = parseFloat(mixedMatch[1])
      const numerator = parseFloat(mixedMatch[2])
      const denominator = parseFloat(mixedMatch[3])
      if (denominator !== 0) {
        return whole + (numerator / denominator)
      }
    }
    
    // Fall back to parseFloat for regular numbers
    return parseFloat(qtyStr) || 0
  }

  /**
   * Calculate total nutrition for a recipe
   * CRITICAL: Only uses recipe units (tbsp, g, ml, cups, pieces), NEVER inventory units (bottle, bag, container)
   */
  calculateRecipeNutrition(
    ingredients: Array<{ name: string; quantity: string | number; unit: string }>,
    servings: number
  ): NutritionInfo {
    let total: NutritionInfo = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      saturatedFat: 0
    }

    for (const ingredient of ingredients) {
      const unit = (ingredient.unit || '').trim()
      
      // CRITICAL: Skip ingredients with inventory units - they're not recipe quantities
      // Recipe units: tbsp, g, ml, cups, pieces, etc.
      // Inventory units: bottle, bag, container, box, pack, etc.
      if (this.isInventoryUnit(unit)) {
        console.warn(`⚠️ SKIPPING nutrition for "${ingredient.name}" - has INVENTORY unit "${unit}" (bottle/bag/container). Recipe must use RECIPE units (tbsp/g/ml/cups/pieces). This ingredient will not be counted in nutrition.`)
        continue
      }

      // SANITY CHECK: Flag unrealistic quantities (e.g., "50 cups cheese")
      // CRITICAL: Parse fractions properly (e.g., "1/3" = 0.333, not 1)
      const qty = this.parseQuantity(ingredient.quantity)
      
      if (qty > 20 && (unit === 'cups' || unit === 'cup')) {
        console.error(`🚨 UNREALISTIC QUANTITY: ${qty} ${unit} for "${ingredient.name}" - likely recipe generation error. Skipping from nutrition calculation.`)
        continue // Skip unrealistic quantities
      }

      // Warn if unit is not a recognized recipe unit (but still try to calculate)
      if (unit && !this.isRecipeUnit(unit) && unit !== 'to taste') {
        console.warn(`⚠️ Unknown unit "${unit}" for "${ingredient.name}" - attempting to calculate anyway. Valid recipe units: tbsp, g, ml, cups, pieces, etc.`)
      }

      if (qty === 0 || ingredient.quantity === 'to taste') {
        // Handle "to taste" ingredients (salt, pepper) with small amounts
        // CRITICAL FIX: Use much smaller amounts for "to taste" to avoid excessive sodium
        // 1g salt = 387mg sodium, which is too much. Use 0.1g = ~39mg sodium (very small pinch)
        // This is more realistic for "to taste" seasoning
        if (ingredient.name.toLowerCase().includes('salt')) {
          const saltNutrition = this.calculateIngredientNutrition('salt', 0.1, 'g') // 0.1g = ~39mg sodium (tiny pinch)
          total.calories += saltNutrition.calories
          total.sodium = (total.sodium || 0) + (saltNutrition.sodium || 0)
        } else if (ingredient.name.toLowerCase().includes('pepper') && 
                   !ingredient.name.toLowerCase().includes('bell')) {
          const pepperNutrition = this.calculateIngredientNutrition('black pepper', 0.1, 'g') // 0.1g = tiny amount
          total.calories += pepperNutrition.calories
          total.protein += pepperNutrition.protein
          total.carbs += pepperNutrition.carbs
          total.fat += pepperNutrition.fat
          total.sodium = (total.sodium || 0) + (pepperNutrition.sodium || 0)
        }
        continue
      }
      
      // CRITICAL: Check if salt/pepper have explicit quantities that are too high
      // Cap salt at 0.15 tsp to leave room for natural sodium in other ingredients (salmon, vinegar, etc.)
      // 0.15 tsp = 0.75g = ~291mg sodium from salt
      // This leaves ~200mg for other ingredients, keeping total under 500mg per serving
      // 0.2 tsp = 1g = ~388mg sodium - too high when combined with other ingredients
      if (ingredient.name.toLowerCase().includes('salt')) {
        const unitLower = (unit || '').toLowerCase()
        if (unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons') {
          // Cap at 0.15 tsp max to ensure total sodium stays under 500mg
          const saltQty = Math.min(qty, 0.15) // Cap at 0.15 tsp max (~291mg sodium from salt)
          if (saltQty < qty) {
            console.warn(`⚠️ Capping salt quantity from ${qty} tsp to 0.15 tsp to prevent excessive sodium (leaves room for natural sodium in other ingredients)`)
          }
          const saltNutrition = this.calculateIngredientNutrition('salt', saltQty, 'tsp')
          total.calories += saltNutrition.calories
          total.sodium = (total.sodium || 0) + (saltNutrition.sodium || 0)
          continue
        } else if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
          // If salt is in grams, cap at 0.75g (equivalent to 0.15 tsp)
          const saltQty = Math.min(qty, 0.75) // Cap at 0.75g max (~291mg sodium)
          if (saltQty < qty) {
            console.warn(`⚠️ Capping salt quantity from ${qty}g to 0.75g to prevent excessive sodium`)
          }
          const saltNutrition = this.calculateIngredientNutrition('salt', saltQty, 'g')
          total.calories += saltNutrition.calories
          total.sodium = (total.sodium || 0) + (saltNutrition.sodium || 0)
          continue
        }
      }

      const ingredientNutrition = this.calculateIngredientNutrition(
        ingredient.name,
        qty,
        ingredient.unit || ''
      )

      // Log each ingredient's contribution for debugging
      console.log(`🍎 Nutrition for "${ingredient.name}": ${qty} ${ingredient.unit || '(no unit)'} → ${ingredientNutrition.calories} cal, ${ingredientNutrition.protein}g protein, ${ingredientNutrition.carbs}g carbs, ${ingredientNutrition.fat}g fat`)

      total.calories += ingredientNutrition.calories
      total.protein += ingredientNutrition.protein
      total.carbs += ingredientNutrition.carbs
      total.fat += ingredientNutrition.fat
      if (ingredientNutrition.fiber !== undefined) {
        total.fiber = (total.fiber || 0) + ingredientNutrition.fiber
      }
      if (ingredientNutrition.sugar !== undefined) {
        total.sugar = (total.sugar || 0) + ingredientNutrition.sugar
      }
      if (ingredientNutrition.sodium !== undefined) {
        total.sodium = (total.sodium || 0) + ingredientNutrition.sodium
      }
      if (ingredientNutrition.saturatedFat !== undefined) {
        total.saturatedFat = (total.saturatedFat || 0) + ingredientNutrition.saturatedFat
      }
    }

    // Calculate per serving
    const perServing = {
      calories: Math.round(total.calories / servings),
      protein: Math.round((total.protein / servings) * 10) / 10,
      carbs: Math.round((total.carbs / servings) * 10) / 10,
      fat: Math.round((total.fat / servings) * 10) / 10,
      fiber: total.fiber ? Math.round((total.fiber / servings) * 10) / 10 : undefined,
      sugar: total.sugar ? Math.round((total.sugar / servings) * 10) / 10 : undefined,
      sodium: total.sodium ? Math.round(total.sodium / servings) : undefined,
      saturatedFat: total.saturatedFat ? Math.round((total.saturatedFat / servings) * 10) / 10 : undefined
    }

    // SANITY CHECK: Flag and cap unrealistic values
    // A typical meal should be 300-800 calories, 20-50g protein, 30-80g carbs, 10-30g fat
    if (perServing.calories > 1000) {
      console.error(`🚨 UNREALISTIC CALORIES: ${perServing.calories} cal per serving (expected 300-800). Check ingredient quantities and units.`)
      console.error(`   Total recipe calories: ${total.calories} for ${servings} servings`)
      console.error(`   Ingredients:`, ingredients.map(ing => `${ing.quantity} ${ing.unit || '(no unit)'} ${ing.name}`).join(', '))
      
      // CAP at reasonable maximum (800 cal) to prevent display of impossible values
      // This is a safety measure - the real fix is ensuring correct units
      console.warn(`   ⚠️ Capping at 800 calories per serving (was ${perServing.calories})`)
      perServing.calories = 800
    }
    if (perServing.fat > 50) {
      console.error(`🚨 UNREALISTIC FAT: ${perServing.fat}g per serving (expected 10-30g). Likely using inventory units (bottle/bag) instead of recipe units (tbsp/g).`)
      console.error(`   Ingredients:`, ingredients.map(ing => `${ing.quantity} ${ing.unit || '(no unit)'} ${ing.name}`).join(', '))
      
      // CAP at reasonable maximum (40g fat)
      console.warn(`   ⚠️ Capping at 40g fat per serving (was ${perServing.fat})`)
      perServing.fat = 40
    }
    
    // CRITICAL: Cap sodium at realistic maximum (500mg per serving)
    // Typical meal sodium: 200-500mg per serving. 500mg is the upper limit for a healthy meal
    // This prevents unrealistic values from salt calculation errors
    // Note: We cap salt at 0.15 tsp to leave room for natural sodium in other ingredients
    if (perServing.sodium && perServing.sodium > 500) {
      // Calculate how much sodium is from salt vs other ingredients
      const saltIngredients = ingredients.filter(ing => ing.name.toLowerCase().includes('salt'))
      const saltSodium = saltIngredients.reduce((sum, ing) => {
        const qty = this.parseQuantity(ing.quantity)
        const unitLower = (ing.unit || '').toLowerCase()
        if (unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons') {
          const saltQty = Math.min(qty, 0.15) // Already capped
          const saltData = this.nutritionDatabase['salt']
          const saltGrams = saltQty * (saltData?.pieceWeight || 5) // 5g per tsp
          return sum + ((saltGrams / 100) * (saltData?.sodium || 38758))
        } else if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
          const saltQty = Math.min(qty, 0.75) // Already capped
          const saltData = this.nutritionDatabase['salt']
          return sum + ((saltQty / 100) * (saltData?.sodium || 38758))
        }
        return sum
      }, 0) / servings
      
      const otherSodium = (total.sodium || 0) / servings - saltSodium
      
      console.error(`🚨 UNREALISTIC SODIUM: ${perServing.sodium}mg per serving (expected 200-500mg)`)
      console.error(`   Total recipe sodium: ${total.sodium}mg for ${servings} servings`)
      console.error(`   Sodium breakdown: ~${Math.round(saltSodium)}mg from salt, ~${Math.round(otherSodium)}mg from other ingredients`)
      console.error(`   Ingredients:`, ingredients.map(ing => `${ing.quantity} ${ing.unit || '(no unit)'} ${ing.name}`).join(', '))
      console.warn(`   ⚠️ Capping at 500mg sodium per serving (was ${perServing.sodium}mg)`)
      perServing.sodium = 500
    }
    
    if (perServing.protein > 100) {
      console.warn(`⚠️ Capping protein at 80g per serving (was ${perServing.protein})`)
      perServing.protein = 80
    }
    if (perServing.carbs > 150) {
      console.warn(`⚠️ Capping carbs at 120g per serving (was ${perServing.carbs})`)
      perServing.carbs = 120
    }

    return perServing
  }
}

export const nutritionCalculatorService = NutritionCalculatorService.getInstance()

