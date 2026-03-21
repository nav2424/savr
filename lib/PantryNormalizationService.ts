/**
 * Pantry Normalization Service
 * Single source of truth for pantry normalization - called at match time
 */

import { PantryItem } from './supabase'

// Staples that don't count as required ingredients
const STAPLES = new Set([
  'salt', 'pepper', 'black pepper', 'oil', 'olive oil', 'water', 'vinegar', 
  'soy sauce', 'sugar', 'flour'
])

// Alias map for common variations
const ALIASES = new Map<string, string>([
  ['greek yogourt', 'greek yogurt'],
  ['yogourt', 'yogurt'],
  ['organic arugula', 'arugula'],
  ['rocket', 'arugula'],
  ['salmon fillet', 'salmon'],
  ['grass fed butter', 'butter'],
  ['grass-fed butter', 'butter'],
  ['dark chocolate', 'chocolate'],
  ['marinara', 'sauce marinara'],
  ['marinara sauce', 'sauce marinara'],
  ['spring mix', 'mixed greens'],
  ['2% purfiltre cow\'s milk', 'milk'],
  ['2 purfiltre cows milk', 'milk'],
  // Oils - all oils are interchangeable for cooking purposes
  ['olive oil', 'oil'],
  ['avocado oil', 'oil'],
  ['avocado oil spray', 'oil'],
  ['vegetable oil', 'oil'],
  ['canola oil', 'oil'],
  ['coconut oil', 'oil'],
  // Alliums - garlic, shallots, onions are similar
  ['garlic', 'shallots'],
  ['onion', 'shallots'],
  ['onions', 'shallots'],
  // Pasta/noodles - similar grains
  ['pasta', 'noodles'],
  ['spaghetti', 'noodles'],
])

// Coarse category mapping based on normalized name
const COARSE_CATEGORY: Record<string, string> = {
  'arugula': 'Produce',
  'mixed greens': 'Produce',
  'shallots': 'Produce',
  'sweet potato': 'Produce',
  'raspberries': 'Produce',
  'milk': 'Dairy & Eggs',
  'butter': 'Dairy & Eggs',
  'greek yogurt': 'Dairy & Eggs',
  'cream cheese': 'Dairy & Eggs',
  'eggs': 'Dairy & Eggs',
  'salmon': 'Meat & Seafood',
  'chicken legs': 'Meat & Seafood',
  'beef sticks': 'Meat & Seafood',
  'sunrise tofu': 'Plant-based Protein',
  'tofu': 'Plant-based Protein',
  'tortillas': 'Grains & Bakery',
  'granola': 'Grains & Bakery',
  'sauce marinara': 'Condiments & Sauces',
  'maple syrup': 'Pantry Staples',
  'soy sauce': 'Condiments & Sauces',
  'kirkland signature parchment paper': 'Household',
  'parchment paper': 'Household',
  'aluminium foil': 'Household',
  'aluminum foil': 'Household',
  'garbage bags': 'Household',
  'trash bags': 'Household',
}

/**
 * Normalize ingredient name: aggressive normalization with vendor adjective removal
 */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[%'`"]/g, '')              // remove % and quotes
    .replace(/[^a-z0-9]+/g, ' ')          // non-alphanum → space
    .replace(/\b(organic|kirkland|signature|original)\b/g, '') // drop vendor adjectives
    .replace(/\bgrass\s*fed\b/g, 'grass fed') // unify spacing
    .replace(/\b2\s*purfiltre\s*cows?\s*milk\b/, 'milk')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fix category based on normalized name and incoming category
 */
function fixCategory(norm: string, incoming?: string): string {
  return COARSE_CATEGORY[norm] ?? incoming ?? 'Other'
}

/**
 * Pick better category when merging duplicates
 */
function pickCategory(a?: string, b?: string): string {
  if (!a) return b || 'Other'
  if (!b) return a
  // Prefer non-"Other"/non-"Snacks" if there's a conflict
  const rank = (c: string) => ['Household', 'Other', 'Snacks & Sweets'].includes(c) ? 0 : 1
  return rank(b) > rank(a) ? b : a
}

/**
 * Get normalized pantry - SINGLE SOURCE OF TRUTH
 * Call this at match time, not earlier in the pipeline
 */
export function getNormalizedPantry(livePantry: PantryItem[]): PantryItem[] {
  // 1) Filter out zero/negative qty
  const filtered = livePantry.filter(it => (it.quantity ?? 0) > 0)

  // 2) Normalize names and categories, de-dupe by name (lowercased)
  const byName = new Map<string, PantryItem>()

  for (const raw of filtered) {
    const name = normName(raw.name)
    const fixedCategory = fixCategory(name, raw.category)
    const prev = byName.get(name)

    if (prev) {
      prev.quantity = (prev.quantity ?? 0) + (raw.quantity ?? 0)
      // Keep more specific category if we have one; otherwise keep existing
      prev.category = pickCategory(prev.category, fixedCategory)
    } else {
      byName.set(name, { ...raw, name, category: fixedCategory })
    }
  }

  return [...byName.values()]
}

/**
 * Check if ingredient is a staple
 */
export function isStaple(ingredientName: string): boolean {
  const normalized = normName(ingredientName)
  return STAPLES.has(normalized) || Array.from(STAPLES).some(staple => 
    normalized.includes(staple) || staple.includes(normalized)
  )
}

/**
 * Get alias for an ingredient name
 */
export function getAlias(name: string): string | undefined {
  const normalized = normName(name)
  return ALIASES.get(normalized)
}

/**
 * Get coarse category for an ingredient name
 */
export function getCoarseCategoryForName(name: string): string | undefined {
  const normalized = normName(name)
  return COARSE_CATEGORY[normalized]
}

// Export for backward compatibility
class PantryNormalizationService {
  private static instance: PantryNormalizationService

  static getInstance(): PantryNormalizationService {
    if (!PantryNormalizationService.instance) {
      PantryNormalizationService.instance = new PantryNormalizationService()
    }
    return PantryNormalizationService.instance
  }

  normalizePantry(pantryItems: PantryItem[]): PantryItem[] {
    return getNormalizedPantry(pantryItems)
  }

  getCoarseCategory(category: string): string {
    // This is for backward compatibility - maps category strings to coarse categories
    const catLower = category.toLowerCase()
    if (catLower.includes('meat') || catLower.includes('seafood') || catLower.includes('poultry') || catLower.includes('protein')) {
      return 'protein'
    }
    if (catLower.includes('dairy') || catLower.includes('egg')) {
      return 'dairy'
    }
    if (catLower.includes('produce') || catLower.includes('fruit') || catLower.includes('vegetable')) {
      return 'produce'
    }
    return 'other'
  }
}

export const pantryNormalizationService = PantryNormalizationService.getInstance()

