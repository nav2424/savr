/**
 * Structured Recipe Formatter
 * Converts recipes to structured format with cooking and shopping views
 */

import { PantryItem } from './supabase'
import { ingredientUnitService } from './IngredientUnitService'

export interface StructuredRecipe {
  meta: {
    title: string
    servings: number
    total_time_minutes: number
    difficulty: 'Easy' | 'Medium' | 'Hard'
    cuisine?: string
  }
  ingredients: StructuredIngredient[]
  steps: StructuredStep[]
}

export interface StructuredIngredient {
  name_canonical: string
  aliases?: string[]
  prep_note?: string
  quantity_recipe_value: number | string
  unit_recipe: 'g' | 'kg' | 'mg' | 'mL' | 'L' | 'tsp' | 'tbsp' | 'cup' | 'fl oz' | 'oz' | 'lb' | 'whole' | 'clove' | 'slice' | 'sprig' | 'bunch' | 'piece'
  quantity_recipe_text: string
  quantity_purchase_value: number | string | null
  unit_purchase: 'bottle' | 'jar' | 'can' | 'box' | 'bag' | 'pack' | 'dozen' | 'block' | 'bunch' | 'head' | 'piece' | 'tray' | 'carton' | '—'
  is_pantry_item: boolean
  notes?: string
}

export interface StructuredStep {
  order: number
  instruction: string
  timer_minutes?: number | null
  target_temp_c?: number | null
  uses_ingredients?: string[]
}

interface RecipeIngredient {
  name: string
  quantity: string
  unit: string
  inPantry?: boolean
}

interface Recipe {
  title: string
  servings: number
  cookTime?: number
  prepTime?: number
  difficulty?: string
  cuisine_type?: string
  ingredients: RecipeIngredient[]
  instructions: string[]
}

/**
 * Pantry staples - items that should never appear in shopping list
 * CORE ASSUMED HOUSEHOLD STAPLES - Every user has these items
 */
const PANTRY_STAPLES = new Set([
  // Basic Seasonings (CORE STAPLES)
  'salt', 'sea salt', 'table salt', 'kosher salt',
  'black pepper', 'ground black pepper', 'peppercorns',
  
  // Cooking Fats (CORE STAPLES)
  'olive oil', 'vegetable oil', 'canola oil', 'avocado oil',
  'butter', 'unsalted butter', 'salted butter',
  
  // Basic Baking/Cooking Essentials (CORE STAPLES)
  'water', // CRITICAL: Everyone has water at home - never show in shopping list
  'sugar', 'white sugar', 'brown sugar', 'granulated sugar',
  'flour', 'all-purpose flour', 'plain flour',
  
  // Additional common staples (not core, but commonly available)
  'baking powder', 'baking soda',
  'vanilla extract', 'vanilla',
  'soy sauce',
  'vinegar', 'white vinegar', 'red wine vinegar', 'balsamic vinegar', 'apple cider vinegar',
  'rice', 'white rice', 'brown rice', 'jasmine rice',
  'cornstarch', 'corn starch',
  'honey',
  'paprika', 'cumin', 'oregano', 'chili powder', 'curry powder', 'mustard', 'dried herbs',
  'garlic powder', 'onion powder', 'cayenne pepper', 'red pepper flakes'
])

/**
 * Canonicalize ingredient name - merge duplicates and variants
 */
function canonicalizeIngredientName(name: string): string {
  let canonical = name.trim()
  
  // Remove brand names
  canonical = canonical.replace(/kirkland\s+signature\s+/gi, '')
  canonical = canonical.replace(/organic\s+/gi, '')
  canonical = canonical.replace(/pure\s+/gi, '')
  canonical = canonical.replace(/fresh\s+/gi, '')
  canonical = canonical.replace(/\s+signature\s+/gi, ' ')
  
  // Normalize common variants
  canonical = canonical.replace(/sea\s+salt/gi, 'Sea salt')
  canonical = canonical.replace(/table\s+salt/gi, 'Salt')
  canonical = canonical.replace(/ground\s+black\s+pepper/gi, 'Black pepper')
  canonical = canonical.replace(/freshly\s+ground\s+black\s+pepper/gi, 'Black pepper')
  canonical = canonical.replace(/green\s+onion/gi, 'Scallion')
  canonical = canonical.replace(/green\s+onions/gi, 'Scallions')
  canonical = canonical.replace(/sweet\s+potato(es)?/gi, 'Sweet potato')
  
  // Normalize whitespace
  canonical = canonical.replace(/\s+/g, ' ').trim()
  
  // Capitalize first letter
  if (canonical.length > 0) {
    canonical = canonical.charAt(0).toUpperCase() + canonical.slice(1).toLowerCase()
  }
  
  return canonical
}

/**
 * Get deduplication key for merging near-duplicates
 */
function getDedupeKey(name: string): string {
  return name.toLowerCase()
    .replace(/sea\s+/g, '')
    .replace(/table\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if ingredient is a pantry staple
 */
function isPantryStaple(name: string): boolean {
  const normalized = name.toLowerCase().trim()
  
  // CRITICAL: Core household staples - everyone has these, never show in shopping list
  // Check exact matches first
  if (PANTRY_STAPLES.has(normalized)) {
    return true
  }
  
  // Check for variations and partial matches
  // Salt variations
  if (normalized.includes('salt') && !normalized.includes('sauce')) {
    return true
  }
  
  // Black pepper (not bell pepper)
  if ((normalized === 'pepper' || normalized === 'black pepper' || normalized.includes('black pepper') || normalized.includes('peppercorn')) &&
      !normalized.includes('bell') && !normalized.includes('red pepper') && !normalized.includes('chili pepper')) {
    return true
  }
  
  // Cooking oils
  if (normalized.includes('oil') && (normalized.includes('olive') || normalized.includes('vegetable') || normalized.includes('canola') || normalized.includes('avocado'))) {
    return true
  }
  
  // Butter
  if (normalized.includes('butter')) {
    return true
  }
  
  // Water (CRITICAL: Everyone has water)
  if (normalized === 'water' || normalized.includes(' water') || normalized.includes('water ')) {
    return true
  }
  
  // Sugar variations
  if (normalized.includes('sugar') && (normalized.includes('white') || normalized.includes('brown') || normalized.includes('granulated') || normalized === 'sugar')) {
    return true
  }
  
  // Flour variations
  if (normalized.includes('flour') && (normalized.includes('all-purpose') || normalized.includes('plain') || normalized === 'flour')) {
    return true
  }
  
  // Additional common staples (not core, but commonly available)
  if (normalized.includes('vinegar') ||
      normalized.includes('baking powder') ||
      normalized.includes('baking soda') ||
      normalized.includes('vanilla') ||
      normalized.includes('soy sauce') ||
      normalized.includes('rice') ||
      normalized.includes('spice') ||
      normalized.includes('herb')) {
    return true
  }
  
  return false
}

/**
 * Convert recipe unit to purchase unit
 */
function getPurchaseUnit(ingredientName: string, unitRecipe: string): 'bottle' | 'jar' | 'can' | 'box' | 'bag' | 'pack' | 'dozen' | 'block' | 'bunch' | 'head' | 'piece' | 'tray' | 'carton' | '—' {
  const name = ingredientName.toLowerCase()
  
  // Pantry items - no purchase needed
  if (isPantryStaple(ingredientName)) {
    return '—'
  }
  
  // Oils - bottle
  if (name.includes('oil')) {
    return 'bottle'
  }
  
  // Condiments - jar or bottle
  if (name.includes('sauce') || name.includes('mustard') || name.includes('mayo')) {
    return 'jar'
  }
  
  // Canned items
  if (name.includes('bean') || name.includes('tomato') || name.includes('corn') || 
      name.includes('chickpea') || name.includes('lentil')) {
    return 'can'
  }
  
  // Packaged items
  if (name.includes('pasta') || name.includes('rice') || name.includes('quinoa') || 
      name.includes('couscous') || name.includes('cereal')) {
    return 'box'
  }
  
  // Bagged items
  if (name.includes('potato') || name.includes('onion') || name.includes('carrot') ||
      name.includes('lettuce') || name.includes('spinach') || name.includes('salad') ||
      name.includes('greens') || name.includes('arugula') || name.includes('spring mix')) {
    return 'bag'
  }
  
  // Packaged proteins
  if (name.includes('chicken') || name.includes('beef') || name.includes('pork') ||
      name.includes('fish') || name.includes('salmon') || name.includes('tofu')) {
    return 'pack'
  }
  
  // Produce sold by piece
  if (name.includes('tomato') || name.includes('pepper') || name.includes('bell pepper') ||
      name.includes('cucumber') || name.includes('zucchini') || name.includes('eggplant') ||
      name.includes('avocado') || name.includes('lemon') || name.includes('lime')) {
    return 'piece'
  }
  
  // Herbs - bunch
  if (name.includes('parsley') || name.includes('cilantro') || name.includes('basil') ||
      name.includes('mint') || name.includes('dill') || name.includes('oregano')) {
    return 'bunch'
  }
  
  // Eggs - dozen
  if (name.includes('egg')) {
    return 'dozen'
  }
  
  // Cheese - block or pack
  if (name.includes('cheese')) {
    return 'block'
  }
  
  // Bread - pack or loaf
  if (name.includes('bread') || name.includes('tortilla')) {
    return 'pack'
  }
  
  // Default: piece
  return 'piece'
}

/**
 * Get purchase quantity based on recipe quantity
 */
function getPurchaseQuantity(
  quantityRecipe: number | string,
  unitRecipe: string,
  unitPurchase: string,
  ingredientName: string
): number | string | null {
  // Pantry items - no purchase needed
  if (unitPurchase === '—') {
    return '—'
  }
  
  // If recipe quantity is "to taste", return null for purchase
  if (quantityRecipe === 'to taste' || quantityRecipe === 'to taste') {
    return null
  }
  
  const qty = typeof quantityRecipe === 'number' ? quantityRecipe : parseFloat(String(quantityRecipe))
  
  if (isNaN(qty)) {
    return null
  }
  
  // For small quantities, round up to minimum purchase
  if (unitPurchase === 'bottle' || unitPurchase === 'jar' || unitPurchase === 'can') {
    return qty > 0 ? 1 : null
  }
  
  // For produce sold by piece, round up
  if (unitPurchase === 'piece' || unitPurchase === 'dozen') {
    return Math.ceil(qty)
  }
  
  // For bags/packs/boxes, round up to at least 1
  if (unitPurchase === 'bag' || unitPurchase === 'pack' || unitPurchase === 'box') {
    return Math.ceil(qty) || 1
  }
  
  // For bunches, round up
  if (unitPurchase === 'bunch') {
    return Math.ceil(qty) || 1
  }
  
  return Math.ceil(qty) || 1
}

/**
 * Format recipe quantity text
 */
function formatRecipeQuantityText(
  quantity: number | string,
  unit: string,
  name: string
): string {
  if (quantity === 'to taste' || quantity === 'to taste') {
    return `${name}, to taste`
  }
  
  const qtyStr = typeof quantity === 'number' ? quantity.toString() : quantity
  
  // Handle pluralization
  if (unit === 'whole' || unit === 'piece' || unit === 'clove') {
    const qty = parseFloat(qtyStr) || 1
    const unitSingular = unit === 'whole' ? '' : unit === 'clove' ? 'clove' : 'piece'
    const unitPlural = unit === 'whole' ? '' : unit === 'clove' ? 'cloves' : 'pieces'
    
    if (qty === 1) {
      return `${qty} ${unitSingular || name.toLowerCase()}`
    } else {
      // Pluralize ingredient name
      const pluralName = pluralizeIngredient(name, qty)
      return `${qty} ${pluralName}`
    }
  }
  
  // For other units, show quantity + unit + name
  return `${qtyStr} ${unit} ${name.toLowerCase()}`
}

/**
 * Pluralize ingredient name based on quantity
 */
function pluralizeIngredient(name: string, quantity: number): string {
  if (quantity === 1) {
    return name
  }
  
  const lower = name.toLowerCase()
  
  // Already plural
  if (lower.endsWith('s') || lower.endsWith('es')) {
    return name
  }
  
  // Special cases
  if (lower.includes('potato')) {
    return name.replace(/potato/gi, 'potatoes')
  }
  if (lower.includes('tomato')) {
    return name.replace(/tomato/gi, 'tomatoes')
  }
  if (lower.includes('onion')) {
    return name + 's'
  }
  if (lower.includes('pepper')) {
    return name + 's'
  }
  if (lower.includes('scallion')) {
    return name.replace(/scallion/gi, 'scallions')
  }
  if (lower.includes('shallot')) {
    return name + 's'
  }
  
  // Default: add 's'
  return name + 's'
}

/**
 * Convert recipe unit to schema unit
 */
function normalizeRecipeUnit(unit: string): StructuredIngredient['unit_recipe'] {
  const unitLower = unit.toLowerCase()
  
  // Weight
  if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') return 'g'
  if (unitLower === 'kg' || unitLower === 'kilogram' || unitLower === 'kilograms') return 'kg'
  if (unitLower === 'mg' || unitLower === 'milligram' || unitLower === 'milligrams') return 'mg'
  
  // Volume
  if (unitLower === 'ml' || unitLower === 'milliliter' || unitLower === 'milliliters') return 'mL'
  if (unitLower === 'l' || unitLower === 'liter' || unitLower === 'liters') return 'L'
  if (unitLower === 'cup' || unitLower === 'cups') return 'cup'
  if (unitLower === 'tbsp' || unitLower === 'tablespoon' || unitLower === 'tablespoons') return 'tbsp'
  if (unitLower === 'tsp' || unitLower === 'teaspoon' || unitLower === 'teaspoons') return 'tsp'
  if (unitLower === 'fl oz' || unitLower === 'fluid ounce' || unitLower === 'fluid ounces') return 'fl oz'
  
  // Weight (imperial)
  if (unitLower === 'oz' || unitLower === 'ounce' || unitLower === 'ounces') return 'oz'
  if (unitLower === 'lb' || unitLower === 'lbs' || unitLower === 'pound' || unitLower === 'pounds') return 'lb'
  
  // Countable
  if (unitLower === 'whole' || unitLower === 'wholes') return 'whole'
  if (unitLower === 'clove' || unitLower === 'cloves') return 'clove'
  if (unitLower === 'slice' || unitLower === 'slices') return 'slice'
  if (unitLower === 'sprig' || unitLower === 'sprigs') return 'sprig'
  if (unitLower === 'bunch' || unitLower === 'bunches') return 'bunch'
  if (unitLower === 'piece' || unitLower === 'pieces') return 'piece'
  if (unitLower === 'fillets' || unitLower === 'fillet') return 'piece'
  if (unitLower === 'tortillas' || unitLower === 'tortilla') return 'piece'
  if (unitLower === 'eggs' || unitLower === 'egg') return 'whole'
  if (unitLower === 'packages' || unitLower === 'package') return 'piece'
  
  // Default
  return 'piece'
}

/**
 * Merge duplicate ingredients
 */
function mergeIngredients(ingredients: RecipeIngredient[]): RecipeIngredient[] {
  const merged = new Map<string, RecipeIngredient>()
  
  for (const ing of ingredients) {
    const key = getDedupeKey(ing.name)
    const existing = merged.get(key)
    
    if (existing) {
      // Merge quantities if same unit
      if (existing.unit === ing.unit) {
        const existingQty = parseFloat(existing.quantity) || 0
        const newQty = parseFloat(ing.quantity) || 0
        existing.quantity = (existingQty + newQty).toString()
      } else {
        // Different units - keep both or merge intelligently
        // For now, keep the first one
        continue
      }
    } else {
      merged.set(key, { ...ing })
    }
  }
  
  return Array.from(merged.values())
}

/**
 * Format recipe to structured schema
 */
export function formatRecipeToStructured(
  recipe: Recipe,
  pantryItems: PantryItem[] = []
): StructuredRecipe {
  // Merge duplicate ingredients
  const mergedIngredients = mergeIngredients(recipe.ingredients)
  
  // Convert to structured format
  const structuredIngredients: StructuredIngredient[] = mergedIngredients.map(ing => {
    const canonicalName = canonicalizeIngredientName(ing.name)
    const isPantry = isPantryStaple(canonicalName) || ing.inPantry === true
    
    // Parse recipe quantity
    let quantityRecipeValue: number | string = ing.quantity
    if (ing.quantity === 'to taste' || ing.quantity.toLowerCase().includes('to taste')) {
      quantityRecipeValue = 'to taste'
    } else {
      const parsed = parseFloat(ing.quantity)
      quantityRecipeValue = isNaN(parsed) ? ing.quantity : parsed
    }
    
    const unitRecipe = normalizeRecipeUnit(ing.unit)
    const quantityRecipeText = formatRecipeQuantityText(quantityRecipeValue, unitRecipe, canonicalName)
    
    // Purchase info
    const unitPurchase = getPurchaseUnit(canonicalName, unitRecipe)
    const quantityPurchaseValue = isPantry 
      ? '—' 
      : getPurchaseQuantity(quantityRecipeValue, unitRecipe, unitPurchase, canonicalName)
    
    return {
      name_canonical: canonicalName,
      aliases: [ing.name.toLowerCase()],
      quantity_recipe_value: quantityRecipeValue,
      unit_recipe: unitRecipe,
      quantity_recipe_text: quantityRecipeText,
      quantity_purchase_value: quantityPurchaseValue,
      unit_purchase: unitPurchase,
      is_pantry_item: isPantry,
      notes: isPantry ? 'Pantry staple; do not add to shopping list.' : undefined
    }
  })
  
  // Format steps
  const structuredSteps: StructuredStep[] = recipe.instructions.map((instruction, index) => ({
    order: index + 1,
    instruction: instruction,
    timer_minutes: null,
    target_temp_c: null,
    uses_ingredients: []
  }))
  
  // Calculate total time
  const prepTime = recipe.prepTime || 0
  const cookTime = recipe.cookTime || 30
  const totalTime = prepTime + cookTime
  
  return {
    meta: {
      title: recipe.title,
      servings: recipe.servings || 2,
      total_time_minutes: totalTime,
      difficulty: (recipe.difficulty as 'Easy' | 'Medium' | 'Hard') || 'Medium',
      cuisine: recipe.cuisine_type
    },
    ingredients: structuredIngredients,
    steps: structuredSteps
  }
}

/**
 * Validate structured recipe
 */
export function validateStructuredRecipe(recipe: StructuredRecipe): string[] {
  const errors: string[] = []
  
  // Check for duplicate ingredients
  const canonicalNames = recipe.ingredients.map(ing => ing.name_canonical.toLowerCase())
  const duplicates = canonicalNames.filter((name, index) => canonicalNames.indexOf(name) !== index)
  if (duplicates.length > 0) {
    errors.push(`Duplicate ingredients found: ${duplicates.join(', ')}`)
  }
  
  // Check pantry items have correct purchase fields
  for (const ing of recipe.ingredients) {
    if (ing.is_pantry_item) {
      if (ing.quantity_purchase_value !== '—' && ing.quantity_purchase_value !== null) {
        errors.push(`Pantry item "${ing.name_canonical}" should have quantity_purchase_value="—"`)
      }
      if (ing.unit_purchase !== '—') {
        errors.push(`Pantry item "${ing.name_canonical}" should have unit_purchase="—"`)
      }
    } else {
      // Non-pantry items should not have "to taste" in purchase
      if (ing.quantity_purchase_value === 'to taste' || ing.unit_purchase === 'to taste') {
        errors.push(`Non-pantry item "${ing.name_canonical}" cannot have "to taste" in purchase fields`)
      }
    }
    
    // Check purchase units are realistic
    if (!ing.is_pantry_item && ing.unit_purchase !== '—') {
      const invalidUnits = ['tsp', 'tbsp', 'g', 'kg', 'mg', 'mL', 'L', 'cup', 'fl oz', 'oz', 'lb']
      if (invalidUnits.includes(ing.unit_purchase)) {
        errors.push(`Item "${ing.name_canonical}" has invalid purchase unit: ${ing.unit_purchase}`)
      }
    }
  }
  
  return errors
}

/**
 * Get shopping list items from structured recipe (excludes pantry items)
 */
export function getShoppingItems(recipe: StructuredRecipe): StructuredIngredient[] {
  return recipe.ingredients.filter(ing => !ing.is_pantry_item && ing.unit_purchase !== '—')
}

/**
 * Get pantry items from structured recipe (for optional toggle display)
 */
export function getPantryItems(recipe: StructuredRecipe): StructuredIngredient[] {
  return recipe.ingredients.filter(ing => ing.is_pantry_item)
}

