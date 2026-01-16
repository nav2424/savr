/**
 * Simple Ingredient Matcher - Tight, drop-in fix pack
 * Uses normalized pantry at match time, aggressive aliasing, category guards
 */

import { PantryItem } from './supabase'
import { normName, getNormalizedPantry, isStaple, getAlias, getCoarseCategoryForName } from './PantryNormalizationService'

export type Match =
  | { type: 'staple'; name: string }
  | { type: 'exact'; item: PantryItem }
  | { type: 'alias'; item: PantryItem; from: string }
  | { type: 'fuzzy'; item: PantryItem; score: number }
  | { type: 'missing'; requested: string }

/**
 * Match a single ingredient against normalized pantry
 */
export function matchIngredient(reqRaw: string, pantry: PantryItem[]): Match {
  const req = normName(reqRaw)

  // 1) Staples never block a recipe
  if (isStaple(req)) return { type: 'staple', name: req }

  // Normalize pantry names for comparison
  const normalizedPantry = pantry.map(p => ({ ...p, normalizedName: normName(p.name) }))

  // 2) Exact match (by normalized name)
  const exact = normalizedPantry.find(p => p.normalizedName === req)
  if (exact) return { type: 'exact', item: exact }

  // 3) Alias match (bidirectional - check both directions)
  const alias = getAlias(req)
  if (alias) {
    const aliased = normalizedPantry.find(p => p.normalizedName === alias)
    if (aliased) return { type: 'alias', item: aliased, from: req }
  }
  
  // Also check reverse: if pantry item has an alias that matches our request
  for (const p of normalizedPantry) {
    const pantryAlias = getAlias(p.normalizedName)
    if (pantryAlias === req) {
      return { type: 'alias', item: p, from: p.normalizedName }
    }
  }

  // 4) Category-based matching for similar ingredients (oils, alliums, etc.)
  const categoryMatches = getCategoryMatches(req)
  for (const categoryMatch of categoryMatches) {
    const matched = normalizedPantry.find(p => {
      const pNorm = p.normalizedName
      return categoryMatch.some(match => pNorm.includes(match) || match.includes(pNorm))
    })
    if (matched) {
      return { type: 'fuzzy', item: matched, score: 0.85 } // High confidence for category matches
    }
  }

  // 5) Fuzzy (with category guard and threshold ≥0.85 for better matching)
  const wantedCat = getCoarseCategoryForName(req) // may be undefined
  let best: { item: PantryItem; score: number } | null = null

  for (const p of normalizedPantry) {
    // Category guard: if we know both categories and they differ significantly, skip
    const pCat = getCoarseCategoryForName(p.name)
    // Only skip if categories are completely different (not just undefined)
    if (wantedCat && pCat && wantedCat !== pCat && 
        !areSimilarCategories(wantedCat, pCat)) continue

    const s = tokenSortRatio(req, p.normalizedName)
    if (s >= 0.85 && (!best || s > best.score)) {
      best = { item: p, score: s }
    }
  }

  if (best) return { type: 'fuzzy', item: best.item, score: best.score }
  return { type: 'missing', requested: req }
}

/**
 * Get category-based matches for similar ingredients
 */
function getCategoryMatches(ingredient: string): string[][] {
  const ing = ingredient.toLowerCase()
  
  // Oils - all cooking oils are interchangeable
  if (ing.includes('oil')) {
    return [['oil', 'avocado oil', 'olive oil', 'vegetable oil', 'canola oil', 'coconut oil']]
  }
  
  // Alliums - garlic, shallots, onions are similar
  if (ing.includes('garlic') || ing.includes('onion') || ing.includes('shallot')) {
    return [['garlic', 'shallots', 'onion', 'onions', 'shallot']]
  }
  
  // Pasta/noodles - similar grains
  if (ing.includes('pasta') || ing.includes('noodle') || ing.includes('spaghetti')) {
    return [['pasta', 'noodles', 'noodle', 'spaghetti', 'linguine', 'penne']]
  }
  
  // Rice/grains
  if (ing.includes('rice')) {
    return [['rice', 'brown rice', 'white rice', 'jasmine rice']]
  }
  
  return []
}

/**
 * Check if two categories are similar enough to allow matching
 */
function areSimilarCategories(cat1: string, cat2: string): boolean {
  // Oils can match across categories
  if ((cat1.includes('oil') || cat2.includes('oil')) && 
      (cat1.includes('Produce') || cat2.includes('Produce') || 
       cat1.includes('Pantry') || cat2.includes('Pantry'))) {
    return true
  }
  return false
}

/**
 * Simple token-sort similarity (no deps)
 */
function tokenSortRatio(a: string, b: string): number {
  const ta = a.split(' ').sort().join(' ')
  const tb = b.split(' ').sort().join(' ')
  return levenshteinSimilarity(ta, tb)
}

/**
 * Levenshtein similarity (0-1)
 */
function levenshteinSimilarity(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  if (!la && !lb) return 1
  if (!la || !lb) return 0

  const dp = Array.from({ length: la + 1 }, (_, i) => new Array(lb + 1).fill(0))
  for (let i = 0; i <= la; i++) dp[i][0] = i
  for (let j = 0; j <= lb; j++) dp[0][j] = j

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }

  const dist = dp[la][lb]
  const maxLen = Math.max(la, lb)
  return 1 - dist / maxLen // 0..1
}

/**
 * Score recipe: required-only, de-duped, integer %
 */
export function scoreRecipe(recipe: {
  ingredients: { required: string[]; staples?: string[] }
}) {
  // 1) De-dupe required & strip staples if any leaked
  const required = [
    ...new Set(
      (recipe.ingredients.required ?? [])
        .map(normName)
        .filter(x => !isStaple(x))
    )
  ]

  return (pantryLive: PantryItem[]) => {
    // CRITICAL: Normalize pantry at match time, not earlier
    const pantry = getNormalizedPantry(pantryLive)

    const results: { ok: string[]; missing: string[]; staples: string[] } = {
      ok: [],
      missing: [],
      staples: []
    }

    // Staples list (for UI badge); they don't affect score
    const stapleList = new Set(
      (recipe.ingredients.staples ?? []).map(normName).filter(n => isStaple(n))
    )
    results.staples = [...stapleList]

    for (const ing of required) {
      const m = matchIngredient(ing, pantry)
      if (m.type === 'staple') {
        results.staples.push(ing)
        continue
      }
      if (m.type === 'missing') {
        results.missing.push(ing)
      } else {
        results.ok.push(ing)
      }
    }

    const denom = required.length || 1
    const pct = Math.round((results.ok.length / denom) * 100)

    return { percent: pct, results }
  }
}

