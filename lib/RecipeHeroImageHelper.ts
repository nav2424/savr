// Utility helpers to determine the best ingredient to showcase on hero images

const CORE_STAPLES = new Set([
  'salt',
  'sea salt',
  'kosher salt',
  'black pepper',
  'pepper',
  'olive oil',
  'extra virgin olive oil',
  'vegetable oil',
  'canola oil',
  'cooking oil',
  'butter',
  'unsalted butter',
  'salted butter',
  'water',
  'sugar',
  'white sugar',
  'brown sugar',
  'flour',
  'all purpose flour',
  'all-purpose flour',
  'ap flour'
])

const FILLER_WORDS = new Set(['with', 'and', 'the', 'a', 'of', '&'])

type IngredientInput =
  | string
  | {
      name?: string
      ingredient?: string
      display_name?: string
    }

function normalize(name?: string | null) {
  return (name || '').toLowerCase().trim()
}

function sanitizeIngredient(ingredient: IngredientInput | undefined): string {
  if (!ingredient) return ''
  if (typeof ingredient === 'string') return ingredient
  return ingredient.name || ingredient.ingredient || ingredient.display_name || ''
}

function isStaple(name: string) {
  if (!name) return false
  const normalized = normalize(name)
  if (!normalized) return false
  if (CORE_STAPLES.has(normalized)) return true
  if (normalized.endsWith('s')) {
    return CORE_STAPLES.has(normalized.slice(0, -1))
  }
  return false
}

function fallbackFromTitle(title?: string) {
  if (!title) return null
  const words = title.split(/\s+/).map(word => word.trim()).filter(Boolean)
  for (const word of words) {
    if (!FILLER_WORDS.has(word.toLowerCase())) {
      return word
    }
  }
  return words[0] || null
}

/**
 * Returns the most representative ingredient name to use as a hero image.
 * Prefers non-staple ingredients, falls back to the first ingredient, then the recipe title.
 */
export function getPrimaryIngredientName(recipe: any): string | null {
  if (!recipe) return null

  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : []
  const ingredientNames = ingredients
    .map(sanitizeIngredient)
    .map(name => name?.trim())
    .filter(Boolean) as string[]

  const nonStaple = ingredientNames.find(name => !isStaple(name))
  if (nonStaple) return nonStaple

  if (ingredientNames.length > 0) {
    return ingredientNames[0]
  }

  if (typeof recipe.primaryIngredient === 'string' && recipe.primaryIngredient.trim().length > 0) {
    return recipe.primaryIngredient.trim()
  }

  if (recipe.mainIngredient && typeof recipe.mainIngredient === 'string') {
    return recipe.mainIngredient.trim()
  }

  if (recipe.title) {
    return fallbackFromTitle(recipe.title)
  }

  return null
}

