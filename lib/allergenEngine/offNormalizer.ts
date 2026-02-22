// Open Food Facts (OFF) normalization - single source for extracting usable allergen data
// Used by BarcodeService to build DetectionInput and enforce strict UNKNOWN rules

export interface OFFProductLike {
  product_name?: string
  product_name_en?: string
  product_name_fr?: string
  ingredients_text?: string
  ingredients_text_en?: string
  ingredients_text_fr?: string
  ingredients_text_with_allergens?: string
  ingredients?: Array<{ text?: string }>
  ingredients_tags?: string[]
  allergens?: string
  allergens_tags?: string[]
  allergens_hierarchy?: string[]
  traces?: string
  traces_tags?: string[]
  traces_hierarchy?: string[]
  [key: string]: unknown
}

export interface NormalizedOFFData {
  ingredients_text: string
  contains_text: string
  may_contain_text: string
  allergens_tags: string[]
  traces_tags: string[]
  ingredients_tags: string[] | undefined
  ingredients: Array<{ text?: string }> | undefined
  product_name: string | undefined
  product_code: string | undefined
  brands: string | undefined
  /** Quality flags for logging */
  source_quality: {
    ingredients_present: boolean
    allergens_tags_present: boolean
    traces_tags_present: boolean
  }
}

/**
 * Normalize Open Food Facts product into a single structure for allergen detection.
 * Extracts ingredients, contains (allergens), and may-contain (traces) from all OFF fields.
 */
export function normalizeOFFProduct(
  offProduct: OFFProductLike | null | undefined,
  langPreference: 'en' | 'fr' | 'auto' = 'en'
): NormalizedOFFData | null {
  if (!offProduct || typeof offProduct !== 'object') {
    return null
  }

  // 1) Ingredients text - preferred: ingredients_text_with_allergens, then lang-specific, then generic
  const ingredients_text =
    offProduct.ingredients_text_with_allergens ||
    (langPreference === 'fr' ? offProduct.ingredients_text_fr : offProduct.ingredients_text_en) ||
    offProduct.ingredients_text ||
    (langPreference === 'fr' ? offProduct.ingredients_text_en : offProduct.ingredients_text_fr) ||
    ''

  // 2) Contains (explicit allergen statement)
  const contains_text = typeof offProduct.allergens === 'string'
    ? offProduct.allergens.trim()
    : ''
  const allergens_tags = Array.isArray(offProduct.allergens_tags)
    ? offProduct.allergens_tags
    : []

  // 3) May contain (traces)
  const may_contain_text = typeof offProduct.traces === 'string'
    ? offProduct.traces.trim()
    : ''
  const traces_tags = Array.isArray(offProduct.traces_tags)
    ? offProduct.traces_tags
    : []

  const ingredients_tags = Array.isArray(offProduct.ingredients_tags)
    ? offProduct.ingredients_tags
    : undefined
  const ingredients = Array.isArray(offProduct.ingredients)
    ? offProduct.ingredients
    : undefined

  const product_name =
    offProduct.product_name_en ||
    offProduct.product_name_fr ||
    offProduct.product_name ||
    undefined
  const product_code = (offProduct as { code?: string }).code
  const brands = typeof (offProduct as { brands?: string }).brands === 'string'
    ? (offProduct as { brands?: string }).brands
    : undefined

  const source_quality = {
    ingredients_present: Boolean(ingredients_text.trim() || ingredients?.length || ingredients_tags?.length),
    allergens_tags_present: allergens_tags.length > 0,
    traces_tags_present: traces_tags.length > 0,
  }

  return {
    ingredients_text: (ingredients_text || '').trim(),
    contains_text,
    may_contain_text,
    allergens_tags,
    traces_tags,
    ingredients_tags,
    ingredients,
    product_name,
    product_code,
    brands,
    source_quality,
  }
}

/** Check if OFF data has ANY usable allergen/ingredient info */
export function hasUsableOFFAllergenData(norm: NormalizedOFFData | null): boolean {
  if (!norm) return false
  const { ingredients_text, contains_text, may_contain_text, allergens_tags, traces_tags } = norm
  return (
    Boolean(ingredients_text) ||
    Boolean(contains_text) ||
    Boolean(may_contain_text) ||
    allergens_tags.length > 0 ||
    traces_tags.length > 0
  )
}
