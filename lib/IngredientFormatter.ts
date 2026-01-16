/**
 * Capitalize first letter of each word
 */
function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Format ingredient for display with proper structure
 * Handles:
 * - Countable items (onions, potatoes, fillets, etc.): "1 shallot", "2 shallots"
 * - Units (g, tbsp, cups, etc.): "1 tbsp olive oil", "4 g chicken broth"
 * - To taste: "Sea Salt (to taste)" (only for ingredients you have, never for shopping)
 * 
 * @param quantity - Ingredient quantity
 * @param unit - Ingredient unit (if empty or "to taste", will show "to taste")
 * @param name - Ingredient name
 * @param forShopping - If true, never show "to taste", always use store quantities
 */
export function formatIngredientDisplay(quantity: string, unit: string, name: string, forShopping: boolean = false): string {
  // Clean the ingredient name (remove brand names, etc.)
  const cleanName = (name: string): string => {
    let cleaned = name
      .replace(/kirkland\s+signature\s+/gi, '')
      .replace(/organic\s+/gi, '')
      .replace(/pure\s+/gi, '')
      .replace(/sunrise\s+/gi, '')
      .replace(/\s+(fillet|fillets|unit|units|bag|bags|pack|packs|package|packages|roll|rolls)\s*$/gi, '')
      .trim()
    return cleaned || name
  }
  
  const displayName = cleanName(name)
  const nameLower = displayName.toLowerCase()
  const unitLower = unit.toLowerCase()
  
  // CRITICAL: Black pepper can NEVER be "to taste" when forShopping=true
  // Always use store quantity (from groceryStandardizer)
  if (forShopping && (nameLower === 'pepper' || nameLower === 'black pepper')) {
    // If somehow we still have "to taste" or empty unit, use "1 container" as fallback
    if (quantity === 'to taste' || (!unit || unit === '')) {
      return '1 container Black pepper'
    }
    // Use the store quantity provided by groceryStandardizer
    return `${quantity} ${unit} Black pepper`
  }
  
  // Handle "to taste" ingredients (salt, pepper, etc.)
  // BUT: Never show "to taste" for shopping lists - always use store quantities
  if (!forShopping && (quantity === 'to taste' || (!unit || unit === ''))) {
    // For salt, show natural format (only for ingredients you have)
    if (nameLower === 'salt' || nameLower.includes('salt')) {
      return 'Salt (to taste)'
    }
    // Black pepper: Only show "to taste" for ingredients you have, never for shopping
    if (nameLower === 'pepper' || nameLower === 'black pepper') {
      return 'Black pepper (to taste)'
    }
    return `${capitalizeWords(displayName)} (to taste)`
  }
  
  // For shopping: if no unit provided but we have a quantity, use the quantity
  // This handles cases where groceryStandardizer provides store quantities
  if (forShopping && (!unit || unit === '') && quantity && quantity !== 'to taste') {
    return `${quantity} ${capitalizeWords(displayName)}`
  }
  
  const qty = parseFloat(quantity) || 1
  
  // Handle countable items where the unit is plural form of the ingredient
  // e.g., "onions", "potatoes", "tomatoes", "cloves", "eggs", "fillets"
  
  // Onions/Shallots: "1 shallot", "2 shallots" (natural language, no "unit")
  if (unitLower === 'onions' || unitLower === 'onion' || unitLower === 'shallots' || unitLower === 'shallot') {
    const singular = nameLower.includes('shallot') ? 'shallot' : 'onion'
    const plural = nameLower.includes('shallot') ? 'shallots' : 'onions'
    return qty === 1 ? `${qty} ${capitalizeWords(singular)}` : `${qty} ${capitalizeWords(plural)}`
  }
  
  // Potatoes: "1 sweet potato", "2 sweet potatoes" (natural language)
  if (unitLower === 'potatoes' || unitLower === 'potato') {
    const baseName = nameLower.includes('sweet') ? 'sweet potato' : 'potato'
    return qty === 1 ? `${qty} ${capitalizeWords(baseName)}` : `${qty} ${capitalizeWords(baseName)}s`
  }
  
  // Tomatoes: "1 tomato", "2 tomatoes"
  if (unitLower === 'tomatoes' || unitLower === 'tomato') {
    return qty === 1 ? `${qty} ${capitalizeWords('tomato')}` : `${qty} ${capitalizeWords('tomatoes')}`
  }
  
  // Cloves (garlic): "1 clove garlic", "2 cloves garlic"
  if (unitLower === 'cloves' || unitLower === 'clove') {
    const garlicName = nameLower.includes('garlic') ? 'garlic' : displayName
    return qty === 1 ? `${qty} clove ${capitalizeWords(garlicName)}` : `${qty} cloves ${capitalizeWords(garlicName)}`
  }
  
  // Eggs: "1 egg", "2 eggs"
  if (unitLower === 'eggs' || unitLower === 'egg') {
    return qty === 1 ? `${qty} ${capitalizeWords('egg')}` : `${qty} ${capitalizeWords('eggs')}`
  }
  
  // Fillets: "1 salmon fillet", "2 salmon fillets"
  if (unitLower === 'fillets' || unitLower === 'fillet') {
    const cleanProtein = nameLower.replace(/\s*fillet\s*/gi, '').trim()
    const proteinName = cleanProtein || 'fish'
    return qty === 1 ? `${qty} ${capitalizeWords(proteinName)} fillet` : `${qty} ${capitalizeWords(proteinName)} fillets`
  }
  
  // Tortillas: "1 tortilla", "2 tortillas"
  if (unitLower === 'tortillas' || unitLower === 'tortilla') {
    return qty === 1 ? `${qty} ${capitalizeWords('tortilla')}` : `${qty} ${capitalizeWords('tortillas')}`
  }
  
  // Bell peppers: "1 bell pepper", "2 bell peppers" (not black pepper)
  if ((unitLower === 'bell peppers' || unitLower === 'peppers' || unitLower === 'bell pepper') && 
      !nameLower.includes('black pepper') && !nameLower.includes('peppercorn')) {
    const pepperName = nameLower.includes('bell') ? 'bell pepper' : 'pepper'
    return qty === 1 ? `${qty} ${capitalizeWords(pepperName)}` : `${qty} ${capitalizeWords(pepperName)}s`
  }
  
  // Black pepper (spice): Handle recipe quantities (tsp, tbsp) for ingredients you have
  // Note: Shopping list handling is already done above (lines 58-65) - it will never reach here if forShopping=true
  if (!forShopping && (nameLower === 'pepper' || nameLower === 'black pepper')) {
    // If it's a small quantity (spice), show with unit (e.g., "½ tsp black pepper")
    if (unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons' || 
        unitLower === 'tbsp' || unitLower === 'tablespoon' || unitLower === 'tablespoons' ||
        unitLower === 'pinch') {
      const unitDisplay = unitLower === 'pinch' ? 'pinch' : 
                         unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons' ? 'tsp' : 'tbsp'
      return `${quantity} ${unitDisplay} black pepper`
    }
    // If no unit or "to taste", the earlier check (lines 43-54) will handle it
    // This code path should rarely be reached, but keeping for safety
  }
  
  // Packages (tofu, etc.): "1 package tofu", "2 packages tofu"
  if (unitLower === 'packages' || unitLower === 'package') {
    const cleanItem = nameLower.replace(/\s*(pack|package)\s*/gi, '').trim()
    const itemName = cleanItem || 'item'
    return qty === 1 ? `${qty} package ${capitalizeWords(itemName)}` : `${qty} packages ${capitalizeWords(itemName)}`
  }
  
  // Pieces (generic): Remove "unit" - just show natural language
  if (unitLower === 'pieces' || unitLower === 'piece' || unitLower === 'unit' || unitLower === 'units') {
    // For items like "sweet potato", "bell pepper", etc., use natural language
    if (nameLower.includes('sweet potato')) {
      return qty === 1 ? `${qty} sweet potato` : `${qty} sweet potatoes`
    }
    if (nameLower.includes('bell pepper') || nameLower.includes('pepper')) {
      const pepperName = nameLower.includes('bell') ? 'bell pepper' : 'pepper'
      return qty === 1 ? `${qty} ${capitalizeWords(pepperName)}` : `${qty} ${capitalizeWords(pepperName)}s`
    }
    if (nameLower.includes('shallot') || nameLower.includes('onion')) {
      const singular = nameLower.includes('shallot') ? 'shallot' : 'onion'
      const plural = nameLower.includes('shallot') ? 'shallots' : 'onions'
      return qty === 1 ? `${qty} ${capitalizeWords(singular)}` : `${qty} ${capitalizeWords(plural)}`
    }
    // For other items, just show the name without "unit"
    return qty === 1 ? `${qty} ${capitalizeWords(displayName)}` : `${qty} ${capitalizeWords(displayName)}`
  }
  
  // For standard units (g, tbsp, tsp, cups, oz, lbs), show: "quantity unit name"
  if (unitLower === 'g' || unitLower === 'kg' || unitLower === 'mg' || 
      unitLower === 'cups' || unitLower === 'cup' ||
      unitLower === 'tbsp' || unitLower === 'tablespoon' || unitLower === 'tablespoons' ||
      unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons' ||
      unitLower === 'oz' || unitLower === 'lbs' || unitLower === 'lb' ||
      unitLower === 'ml' || unitLower === 'l' || unitLower === 'fl oz') {
    // Normalize unit abbreviations
    let normalizedUnit = unitLower
    if (normalizedUnit === 'tablespoon' || normalizedUnit === 'tablespoons') normalizedUnit = 'tbsp'
    if (normalizedUnit === 'teaspoon' || normalizedUnit === 'teaspoons') normalizedUnit = 'tsp'
    if (normalizedUnit === 'cup') normalizedUnit = 'cups'
    if (normalizedUnit === 'lb') normalizedUnit = 'lbs'
    
    return `${quantity} ${normalizedUnit} ${capitalizeWords(displayName)}`
  }
  
  // Default fallback: "quantity unit name"
  return `${quantity} ${unit} ${capitalizeWords(displayName)}`
}

