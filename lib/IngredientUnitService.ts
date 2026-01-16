// Ingredient Unit Service - Determines proper units and quantities for recipe ingredients
import { PantryItem } from './supabase'
import { ingredientMatchingService } from './IngredientMatchingService'

interface IngredientUnitResult {
  quantity: string
  unit: string
  inPantry: boolean
  pantryItem?: PantryItem
}

class IngredientUnitService {
  private static instance: IngredientUnitService

  static getInstance(): IngredientUnitService {
    if (!IngredientUnitService.instance) {
      IngredientUnitService.instance = new IngredientUnitService()
    }
    return IngredientUnitService.instance
  }

  /**
   * Clean ingredient name - remove units, brand names, and extract core ingredient
   */
  private cleanIngredientName(ingredientName: string): string {
    let cleaned = ingredientName.trim()
    
    // Remove brand names and common prefixes FIRST
    const brandPatterns = [
      /^kirkland\s+signature\s+/i,
      /^organic\s+/i,
      /^pure\s+/i,
      /^fresh\s+/i,
      /^sunrise\s+/i,
      /^[a-z]+\s+signature\s+/i,
      /\s+signature\s+/gi
    ]
    
    // Remove brand patterns
    for (const pattern of brandPatterns) {
      cleaned = cleaned.replace(pattern, ' ')
    }
    
    // Remove common unit words that might be in the name (but keep important ones like "fillet" for detection)
    const unitWords = ['unit', 'units', 'bag', 'bags', 'pack', 'packs', 
                       'package', 'packages', 'roll', 'rolls', 'container', 'containers',
                       'bottle', 'bottles', 'box', 'boxes', 'can', 'cans', 'jar', 'jars']
    
    // Split by common separators and take the main part
    const parts = cleaned.split(/\s+(?:with|and|,)\s+/i)
    cleaned = parts[0].trim()
    
    // Remove trailing unit words (but keep "fillet" in name for detection)
    const words = cleaned.split(/\s+/)
    const filteredWords = words.filter(word => {
      const lowerWord = word.toLowerCase()
      // Keep "fillet" for detection, but remove other unit words
      if (lowerWord === 'fillet' || lowerWord === 'fillets') {
        return true // Keep fillet for detection
      }
      return !unitWords.includes(lowerWord)
    })
    
    if (filteredWords.length > 0) {
      cleaned = filteredWords.join(' ')
    }
    
    return cleaned.trim() || ingredientName // Fallback to original if empty
  }

  /**
   * Get proper unit and quantity for an ingredient
   * 1. First checks if ingredient is in pantry - uses that unit
   * 2. Otherwise uses standard unit based on ingredient type
   * 3. Uses realistic base quantities (e.g., 200g pasta, 1 tbsp oil)
   */
  getIngredientUnit(
    ingredientName: string,
    pantryItems: PantryItem[],
    servings: number = 2,
    baseQuantity?: number // If not provided, will use realistic default
  ): IngredientUnitResult {
    // Clean the ingredient name first to extract core ingredient
    const cleanedName = this.cleanIngredientName(ingredientName)
    
    // If baseQuantity not provided, get realistic default based on CLEANED ingredient type
    // Pass original name too to check for words like "fillet" that might have been removed
    if (baseQuantity === undefined) {
      baseQuantity = this.getRealisticBaseQuantity(cleanedName, servings, ingredientName)
    }
    const name = cleanedName.toLowerCase()
    
    // First, try to find matching item in pantry using cleaned name
    for (const pantryItem of pantryItems) {
      const matchResult = ingredientMatchingService.matchIngredient(cleanedName, pantryItem.name)
      
      if (matchResult.isMatch && matchResult.confidence >= 0.70) {
        // Found in pantry - but ALWAYS use recipe-standard units and quantities, not pantry units/quantities
        // Convert pantry units (bag, pack, unit, etc.) to recipe units (cups, pieces, g, etc.)
        // Pass original name to check for words like "fillet" that might have been cleaned
        const standardUnit = this.getStandardUnit(cleanedName, ingredientName)
        
        // CRITICAL: ALWAYS use realistic recipe quantities, NEVER pantry quantities
        // baseQuantity is calculated from getRealisticBaseQuantity (e.g., 1 fillet, 1 tortilla, 2 cups spring mix)
        // We MUST NOT use pantryItem.quantity here - that's the storage quantity, not recipe quantity
        const finalQuantity = baseQuantity
        
        console.log(`📏 Ingredient unit calculation:`, {
          ingredientName,
          cleanedName,
          pantryItem: `${pantryItem.quantity} ${pantryItem.unit} ${pantryItem.name}`,
          baseQuantity,
          standardUnit,
          finalQuantity: this.formatQuantity(finalQuantity, standardUnit)
        })
        
        return {
          quantity: this.formatQuantity(finalQuantity, standardUnit),
          unit: standardUnit,
          inPantry: true,
          pantryItem
        }
      }
    }

    // Not in pantry - use standard unit
    // Pass original name to check for words like "fillet" that might have been cleaned
    const standardUnit = this.getStandardUnit(cleanedName, ingredientName)
    
    // For salt and pepper, use specific measurements (never "to taste")
    // Per user feedback: ¼–½ tsp salt and ¼ tsp black pepper per 1 serving (prevent overly salty/peppery dishes)
    const nameLower = cleanedName.toLowerCase()
    if (nameLower.includes('salt') || nameLower.includes('sea salt')) {
      // ¼–½ tsp salt per 1 serving (using 0.375 tsp as middle value)
      let saltTsp: number
      if (servings === 1) {
        saltTsp = 0.375 // Middle of ¼–½ tsp range
      } else if (servings === 2) {
        saltTsp = 0.5 // ½ tsp for 2 servings
      } else {
        saltTsp = 0.375 * servings // Scale proportionally: 0.375 tsp per serving
      }
      return {
        quantity: this.formatQuantity(saltTsp, 'tsp'),
        unit: 'tsp',
        inPantry: false
      }
    }
    if (nameLower.includes('pepper') && (nameLower.includes('black') || nameLower.includes('peppercorn'))) {
      // ¼ tsp black pepper per 1 serving
      let pepperTsp: number
      if (servings === 1) {
        pepperTsp = 0.25 // ¼ tsp for 1 serving
      } else if (servings === 2) {
        pepperTsp = 0.5 // ½ tsp for 2 servings
      } else {
        pepperTsp = 0.25 * servings // Scale proportionally: ¼ tsp per serving
      }
      return {
        quantity: this.formatQuantity(pepperTsp, 'tsp'),
        unit: 'tsp',
        inPantry: false
      }
    }
    
    // Format quantity based on unit type
    const formattedQuantity = this.formatQuantity(baseQuantity, standardUnit)
    
    return {
      quantity: formattedQuantity,
      unit: standardUnit,
      inPantry: false
    }
  }

  /**
   * Get realistic base quantity for an ingredient based on type
   * These match professional recipe standards (e.g., 200g pasta for 2 servings)
   */
  private getRealisticBaseQuantity(ingredientName: string, servings: number, originalName?: string): number {
    const name = ingredientName.toLowerCase()
    // Use original name if provided to check for "fillet" etc.
    const checkName = (originalName || ingredientName).toLowerCase()
    
    // PASTA - 200g per 2 servings (100g per serving)
    if (name.includes('pasta') || name.includes('fettuccine') || name.includes('spaghetti') || 
        name.includes('penne') || name.includes('linguine')) {
      return 100 * servings // 100g per serving
    }
    
    // RICE - 150g per 2 servings (75g per serving)
    if (name.includes('rice')) {
      return 75 * servings // 75g per serving
    }
    
    // OLIVE OIL - 1 tbsp per recipe (scales with servings)
    if (name.includes('olive oil') || name.includes('vegetable oil')) {
      return servings === 1 ? 1 : servings <= 2 ? 1 : Math.ceil(servings / 2) // 1 tbsp for 1-2, 2 tbsp for 3-4
    }
    
    // BUTTER - 2 tbsp per recipe
    if (name.includes('butter')) {
      return servings <= 2 ? 2 : Math.ceil(servings) // 2 tbsp for 1-2, scale up for more
    }
    
    // GARLIC - 3 cloves per recipe
    if (name.includes('garlic')) {
      return servings <= 2 ? 3 : Math.ceil(servings * 1.5) // 3 cloves for 1-2, scale up
    }
    
    // CHICKEN (all types) - 200g per serving (realistic portion size)
    // This includes: chicken breast, marinated chicken, chicken thighs, etc.
    if (name.includes('chicken')) {
      // Check for specific cuts that use pieces
      if (name.includes('chicken leg') || name.includes('chicken thigh') || 
          name.includes('drumstick') || name.includes('wing')) {
        return servings // 1 piece per serving
      }
      // All other chicken (breast, marinated, whole, etc.) = 200g per serving
      return 200 * servings
    }
    
    // SALMON/FISH FILLET - 1 fillet per serving = 175g
    // Check if the original name had "fillet" in it (even if cleaned)
    const hasFillet = checkName.includes('fillet') || name.includes('fillet')
    if (name.includes('salmon') || name.includes('fish')) {
      if (hasFillet) {
        // CRITICAL FIX: Return number of fillets (1 per serving), not weight
        // The unit will be "fillets", and convertToGrams will convert 1 fillet = 175g
        // This prevents "175 fillets" when it should be "1 fillet"
        return servings // 1 fillet per serving
      } else {
        return 150 * servings // 150g per serving (for generic salmon/fish without "fillet" in name)
      }
    }
    
    // SHRIMP - 200g per serving
    if (name.includes('shrimp')) {
      return 200 * servings
    }
    
    // BELL PEPPER - 1 per recipe
    if (name.includes('bell pepper') || name.includes('pepper')) {
      return servings <= 2 ? 1 : Math.ceil(servings / 2)
    }
    
    // ONION - 1 small onion per recipe
    if (name.includes('onion') || name.includes('shallot')) {
      return servings <= 2 ? 1 : Math.ceil(servings / 2)
    }
    
    // TOMATO - 1-2 per recipe
    if (name.includes('tomato')) {
      return servings <= 2 ? 1 : Math.ceil(servings / 2)
    }
    
    // SWEET POTATO - 1 per serving
    if (name.includes('sweet potato') || name.includes('potato')) {
      return servings
    }
    
    // SPRING MIX/LETTUCE/ARUGULA - 2 cups per serving
    if (name.includes('spring mix') || name.includes('lettuce') || name.includes('salad') || 
        name.includes('greens') || name.includes('arugula')) {
      return 2 * servings // 2 cups per serving (4 cups for 2 servings)
    }
    
    // SALT - ¼–½ tsp per 1 serving (per user feedback: prevent overly salty dishes)
    // Use 0.375 tsp (middle of ¼–½ tsp range) for 1 serving, scale proportionally
    if (name.includes('salt') || name.includes('sea salt') || name.includes('pure sea salt')) {
      if (servings === 1) {
        return 0.375 // ¼–½ tsp range, using middle value (0.375 tsp)
      } else if (servings === 2) {
        return 0.5 // ½ tsp for 2 servings
      } else {
        return 0.375 * servings // Scale proportionally: 0.375 tsp per serving
      }
    }
    
    // BLACK PEPPER - ¼ tsp per 1 serving (per user feedback: prevent overly peppery dishes)
    if (name.includes('pepper') && (name.includes('black') || name.includes('peppercorn'))) {
      if (servings === 1) {
        return 0.25 // ¼ tsp for 1 serving
      } else if (servings === 2) {
        return 0.5 // ½ tsp for 2 servings
      } else {
        return 0.25 * servings // Scale proportionally: ¼ tsp per serving
      }
    }
    
    // PARMESAN CHEESE - 50g per recipe
    if (name.includes('parmesan') || name.includes('cheese')) {
      return servings <= 2 ? 50 : Math.ceil(servings * 25) // 50g for 2, scale up
    }
    
    // HEAVY CREAM - 1 cup per recipe
    if (name.includes('cream') || name.includes('heavy cream')) {
      return servings <= 2 ? 1 : Math.ceil(servings / 2) // 1 cup for 2, scale up
    }
    
    // CHICKEN BROTH - 4 cups per recipe
    if (name.includes('broth') || name.includes('stock')) {
      return servings <= 2 ? 4 : servings * 2 // 4 cups for 2, 2 cups per serving after
    }
    
    // RED WINE VINEGAR - 1 tbsp per recipe
    if (name.includes('vinegar')) {
      return servings <= 2 ? 1 : Math.ceil(servings / 2)
    }
    
    // SOY SAUCE - 2 tbsp per recipe
    if (name.includes('soy sauce')) {
      return servings <= 2 ? 2 : Math.ceil(servings)
    }
    
    // Default: 1 unit per serving
    return servings
  }

  /**
   * Get standard unit of measure for an ingredient type
   */
  private getStandardUnit(ingredientName: string, originalName?: string): string {
    const name = ingredientName.toLowerCase()
    // Use original name if provided to check for words like "fillet"
    const checkName = (originalName || ingredientName).toLowerCase()
    
    // PROTEINS - by weight (g) or pieces
    if (name.includes('chicken') || name.includes('beef') || name.includes('pork') ||
        name.includes('fish') || name.includes('salmon') || name.includes('turkey') ||
        name.includes('lamb') || name.includes('duck') || name.includes('shrimp')) {
      // Special handling for chicken parts
      if (name.includes('chicken leg') || name.includes('chicken thigh') || 
          name.includes('drumstick') || name.includes('wing')) {
        return 'pieces' // Chicken legs/thighs - use pieces
      }
      // Fish fillets - use "fillets" as unit (check both cleaned and original name)
      if (name.includes('fillet') || checkName.includes('fillet')) {
        return 'fillets' // 1 fillet, 2 fillets, etc.
      }
      // Use grams for most proteins in recipes
      return 'g' // 150g, 200g, etc.
    }
    
    // EGGS
    if (name.includes('egg')) {
      return 'eggs'
    }
    
    // VEGETABLES - by piece or weight
    if (name.includes('potato') || name.includes('sweet potato') || name.includes('yam')) {
      return 'potatoes'
    }
    if (name.includes('onion') || name.includes('shallot')) {
      return 'onions'
    }
    if (name.includes('tomato')) {
      return 'tomatoes'
    }
    if (name.includes('pepper') && !name.includes('bell')) {
      return 'peppers'
    }
    if (name.includes('bell pepper') || name.includes('bellpepper')) {
      return 'bell peppers'
    }
    if (name.includes('garlic')) {
      return 'cloves'
    }
    if (name.includes('ginger')) {
      return 'pieces'
    }
    
    // LEAFY GREENS - by cups (for recipes)
    if (name.includes('lettuce') || name.includes('spinach') || name.includes('kale') ||
        name.includes('arugula') || name.includes('spring mix') || name.includes('salad') ||
        name.includes('greens') || name.includes('mix')) {
      return 'cups' // For recipes, use cups (2 cups per serving)
    }
    
    // DAIRY
    if (name.includes('butter')) {
      return 'tbsp'
    }
    // CRITICAL FIX: Cheese should be in grams (g), not cups
    // getRealisticBaseQuantity returns 50g for cheese, so unit must be 'g'
    if (name.includes('cheese')) {
      return 'g' // Cheese in grams (50g, 100g, etc.) - NOT cups!
    }
    if (name.includes('milk') || name.includes('cream') || name.includes('yogurt')) {
      return 'cups'
    }
    
    // GRAINS/STARCHES - use grams for pasta/rice
    if (name.includes('pasta') || name.includes('fettuccine') || name.includes('spaghetti') ||
        name.includes('penne') || name.includes('linguine')) {
      return 'g' // Pasta in grams (200g)
    }
    if (name.includes('rice')) {
      return 'g' // Rice in grams (150g)
    }
    if (name.includes('quinoa') || name.includes('couscous') || name.includes('oats')) {
      return 'cups'
    }
    // TORTILLAS - use "tortillas" as unit
    if (name.includes('tortilla')) {
      return 'tortillas' // Unit will be "tortillas", quantity comes from getRealisticBaseQuantity
    }
    if (name.includes('bread')) {
      return 'slices'
    }
    
    // OILS/FATS
    if (name.includes('oil') || name.includes('olive oil') || name.includes('vegetable oil')) {
      return 'tbsp'
    }
    
    // CONDIMENTS/SEASONINGS
    if (name.includes('salt') || name.includes('sea salt')) {
      return 'tsp' // Use tsp for salt (never "to taste")
    }
    if (name.includes('pepper') && (name.includes('black') || name.includes('peppercorn'))) {
      return 'tsp' // Use tsp for black pepper (never "to taste")
    }
    if (name.includes('pepper') || name.includes('cumin') ||
        name.includes('paprika') || name.includes('oregano') || name.includes('thyme')) {
      return 'tsp'
    }
    if (name.includes('soy sauce') || name.includes('vinegar') || name.includes('salsa')) {
      return 'tbsp'
    }
    
    // BEANS/LEGUMES
    if (name.includes('bean') || name.includes('chickpea') || name.includes('lentil')) {
      return 'cans'
    }
    
    // TOFU/TEMPEH - use packages as unit
    if (name.includes('tofu') || name.includes('tempeh')) {
      return 'packages' // Unit will be "packages", quantity comes from getRealisticBaseQuantity
    }
    
    // Default: use pieces or cups depending on context
    // If it sounds like a countable item, use pieces
    if (name.includes('piece') || name.includes('whole') || 
        name.match(/\b(a|an|one|two|three|four|five)\b/)) {
      return 'pieces'
    }
    
    // Default to cups for most other ingredients
    return 'cups'
  }

  /**
   * Calculate adjusted quantity based on servings
   */
  private calculateAdjustedQuantity(
    baseQuantity: number,
    servings: number,
    pantryQuantity: string,
    pantryUnit: string
  ): number {
    // If pantry unit is in pieces, adjust by servings
    if (pantryUnit === 'pieces' || pantryUnit === 'eggs' || 
        pantryUnit === 'potatoes' || pantryUnit === 'onions' || 
        pantryUnit === 'tomatoes' || pantryUnit === 'cloves') {
      return Math.ceil(baseQuantity * servings)
    }
    
    // For weight/volume units, scale proportionally
    const pantryQty = parseFloat(pantryQuantity) || 1
    return Math.ceil(baseQuantity * servings * pantryQty)
  }

  /**
   * Format quantity with proper precision
   */
  private formatQuantity(quantity: number, unit: string): string {
    // Never return "to taste" - always use specific measurements per Recipe Composer rules
    if (!unit || unit === '') {
      return quantity.toString() // Fallback to number if no unit
    }
    
    // For weight units (g, lbs), show whole numbers or one decimal if needed
    if (unit === 'g' || unit === 'lbs' || unit === 'oz') {
      if (quantity >= 100) {
        return Math.round(quantity).toString() // Round large numbers
      }
      if (quantity === Math.floor(quantity)) {
        return quantity.toString()
      }
      return quantity.toFixed(1)
    }
    
    // For pieces/countable items, always round to whole number
    if (unit === 'pieces' || unit === 'eggs' || unit === 'potatoes' || 
        unit === 'onions' || unit === 'tomatoes' || unit === 'cloves' ||
        unit === 'bell peppers' || unit === 'peppers' || unit === 'tortillas' ||
        unit === 'fillets' || unit === 'packages') {
      const rounded = Math.round(quantity)
      return rounded.toString()
    }
    
    // For cups - show fractions for small amounts
    if (unit === 'cups') {
      if (quantity < 1) {
        const fraction = this.decimalToFraction(quantity)
        return fraction
      }
      if (quantity === Math.floor(quantity)) {
        return quantity.toString()
      }
      return quantity.toFixed(1)
    }
    
    // For tbsp/tsp - show whole numbers or fractions
    if (unit === 'tbsp' || unit === 'tsp') {
      if (quantity < 1) {
        const fraction = this.decimalToFraction(quantity)
        return fraction
      }
      return Math.round(quantity).toString()
    }
    
    // For fractional quantities (cups, tbsp, tsp)
    if (quantity < 1) {
      // Convert to fraction
      const fraction = this.decimalToFraction(quantity)
      return fraction
    }
    
    // For whole numbers, show as-is
    if (quantity === Math.floor(quantity)) {
      return quantity.toString()
    }
    
    // For decimals, show one decimal place
    return quantity.toFixed(1)
  }

  /**
   * Convert decimal to fraction string
   */
  private decimalToFraction(decimal: number): string {
    const fractions: { [key: number]: string } = {
      0.125: '1/8',
      0.25: '1/4',
      0.33: '1/3',
      0.5: '1/2',
      0.67: '2/3',
      0.75: '3/4'
    }
    
    // Exact matches first
    if (fractions[decimal as keyof typeof fractions]) {
      return fractions[decimal as keyof typeof fractions]
    }
    
    // Find closest fraction
    let closest = 0
    let minDiff = Infinity
    
    for (const [dec, _] of Object.entries(fractions)) {
      const diff = Math.abs(decimal - parseFloat(dec))
      if (diff < minDiff) {
        minDiff = diff
        closest = parseFloat(dec)
      }
    }
    
    if (minDiff < 0.1) {
      return fractions[closest]
    }
    
    return decimal.toFixed(2)
  }
}

export const ingredientUnitService = IngredientUnitService.getInstance()

