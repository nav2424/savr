// DEPRECATED: Thin adapter - all detection flows through lib/allergenEngine
// This file exists only for backward compatibility during migration.
// All call sites should use detectAllergensEvidenceBased from lib/allergenEngine.

import {
  detectAllergensEvidenceBased,
  toDetectionInput,
  buildUserAllergenConfig,
} from './allergenEngine'

export type AllergyMatchType = "contains" | "may_contain" | "facility" | "derived" | "ambiguous"
export type AllergySource =
  | "off_allergens_tags"
  | "off_traces_tags"
  | "off_ingredients_text"
  | "off_ingredients_structured"
  | "off_labels_tags"
export type ConfidenceLevel = "high" | "medium" | "low"
export type LanguagePreference = "en" | "fr" | "auto"

export interface AllergyFinding {
  allergenKey: string
  matchedTerm: string
  matchType: AllergyMatchType
  source: AllergySource
  confidence: ConfidenceLevel
  evidenceSnippet: string
}

export interface AllergyDetectionResult {
  safe: boolean
  containsAllergens: AllergyFinding[]
  mayContainAllergens: AllergyFinding[]
  facilityAllergens: AllergyFinding[]
  ambiguousFindings: AllergyFinding[]
  needsReview: boolean
  chosenLanguage: "en" | "fr" | "auto"
  debug: { usedFields: string[]; productLang?: string; offCompletenessHint?: string }
}

export interface AllergyDetectionSettings {
  strictMode: boolean
  glutenMode: "gluten_only" | "wheat_and_gluten"
  languagePreference: LanguagePreference
  severity?: "mild" | "medium" | "severe"
}

export interface UserAllergies {
  allergyKeys: string[]
  customAllergens: string[]
}

export interface OFFProduct {
  product_name?: string
  product_name_en?: string
  product_name_fr?: string
  ingredients_text?: string
  ingredients_text_en?: string
  ingredients_text_fr?: string
  ingredients?: Array<{ text?: string }>
  allergens?: string
  allergens_tags?: string[]
  allergens_hierarchy?: string[]
  traces?: string
  traces_tags?: string[]
  traces_hierarchy?: string[]
  labels_tags?: string[]
  categories_tags?: string[]
  countries_tags?: string[]
  lang?: string
  states_tags?: string[]
  ingredients_analysis_tags?: string[]
  completeness?: number
}

function mapToFinding(m: { allergen_id: string; allergen_name: string; severity: string; match_text: string; section?: string }, userKeys: string[]): AllergyFinding {
  let source: AllergySource = m.severity === 'MAY_CONTAIN' ? 'off_traces_tags' : 'off_allergens_tags'
  if (m.section === 'ingredients') source = 'off_ingredients_text'
  else if (m.section === 'contains') source = 'off_allergens_tags'
  else if (m.section === 'may_contain') source = 'off_traces_tags'
  let allergenKey = m.allergen_id
  if (m.allergen_id.startsWith('custom_')) allergenKey = m.allergen_name
  else if (m.allergen_id === 'eggs' && userKeys.includes('egg')) allergenKey = 'egg'
  return {
    allergenKey,
    matchedTerm: m.match_text,
    matchType: m.severity === 'CONTAINS' ? 'contains' : 'may_contain',
    source,
    confidence: m.section === 'ingredients' ? 'low' : (m.severity === 'CONTAINS' ? 'high' : 'medium'),
    evidenceSnippet: m.match_text,
  }
}

/**
 * @deprecated Use detectAllergensEvidenceBased from lib/allergenEngine
 * Adapter: calls engine and maps result to legacy AllergyDetectionResult
 */
export function detectAllergensFromOFF(
  userAllergies: UserAllergies,
  offProduct: OFFProduct,
  _settings: AllergyDetectionSettings
): AllergyDetectionResult {
  const allergies = [...userAllergies.allergyKeys, ...userAllergies.customAllergens]
  if (allergies.length === 0) {
    return {
      safe: true,
      containsAllergens: [],
      mayContainAllergens: [],
      facilityAllergens: [],
      ambiguousFindings: [],
      needsReview: false,
      chosenLanguage: 'en',
      debug: { usedFields: [] },
    }
  }

  const config = buildUserAllergenConfig(allergies)
  const input = toDetectionInput(
    {
      name: offProduct.product_name || offProduct.product_name_en || offProduct.product_name_fr,
      ingredients: offProduct.ingredients_text || offProduct.ingredients_text_en || offProduct.ingredients_text_fr,
      allergens: offProduct.allergens_tags?.map(t => t.replace(/^[a-z]{2}:/, '')),
      traces: offProduct.traces_tags?.map(t => t.replace(/^[a-z]{2}:/, '')),
    },
    offProduct as Record<string, unknown>
  )
  const output = detectAllergensEvidenceBased(input, config)

  const containsAllergens = output.matched_allergens
    .filter(m => m.severity === 'CONTAINS')
    .map(m => mapToFinding(m, userAllergies.allergyKeys))
  const mayContain = output.matched_allergens
    .filter(m => m.severity === 'MAY_CONTAIN')
    .map(m => mapToFinding(m, userAllergies.allergyKeys))
  const mayContainAllergens = mayContain
  const ambiguousFindings: AllergyFinding[] = [...mayContain]
  const fromIngredients = output.matched_allergens.filter(m => m.section === 'ingredients').map(m => mapToFinding(m, userAllergies.allergyKeys))
  ambiguousFindings.push(...fromIngredients)
  const wheatFindings = containsAllergens.filter(m => m.allergenKey === 'wheat')
  if (wheatFindings.length > 0 && (userAllergies.allergyKeys.includes('gluten') || userAllergies.allergyKeys.includes('wheat'))) {
    wheatFindings.forEach(m => ambiguousFindings.push({ ...m, allergenKey: 'gluten' }))
  }

  const completeness = (offProduct as { completeness?: number }).completeness
  const needsReview = output.overall_status === 'UNKNOWN' || (completeness !== undefined && completeness < 0.3)
  const hasContains = output.matched_allergens.some(m => m.severity === 'CONTAINS')
  const safe = _settings.strictMode ? output.matched_allergens.length === 0 : !hasContains

  return {
    safe,
    containsAllergens,
    mayContainAllergens,
    facilityAllergens: [],
    ambiguousFindings,
    needsReview,
    chosenLanguage: _settings.languagePreference === 'fr' ? 'fr' : 'en',
    debug: {
      usedFields: output.scan_log.has_ingredient_data ? ['ingredients', 'allergens_tags', 'traces_tags'] : [],
      offCompletenessHint: (offProduct as { completeness?: number }).completeness?.toString(),
    },
  }
}
