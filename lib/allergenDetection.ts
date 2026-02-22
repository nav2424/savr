// DEPRECATED ADAPTER: All detection flows through lib/allergenEngine (single source of truth)

import {
  detectAllergensEvidenceBased,
  toDetectionInput,
  buildUserAllergenConfig,
} from './allergenEngine'

export type MatchType = "CONTAINS" | "MAY_CONTAIN"
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"
export type DetectionSource =
  | "allergens_tags"
  | "traces_tags"
  | "allergens_hierarchy"
  | "traces_hierarchy"
  | "ingredients_analysis_tags"
  | "ingredients_tags"
  | "ingredients_structured"
  | "ingredients_text"

export interface DetectedAllergen {
  allergenKey: string
  matchType: MatchType
  evidence: string
  source: DetectionSource
  confidence: ConfidenceLevel
}

export interface AllergyDetectionResult {
  detected_allergens: DetectedAllergen[]
  safe_allergens: string[]
  confidence: ConfidenceLevel
  warnings: string[]
  usedFields: string[]
}

export interface UserAllergens {
  allergyKeys: string[]
  customAllergens: string[]
}

export interface OFFProduct {
  product_name?: string
  product_name_en?: string
  product_name_fr?: string
  name?: string
  ingredients_text?: string
  ingredients_text_en?: string
  ingredients_text_fr?: string
  ingredients?: Array<{ text?: string }>
  ingredients_tags?: string[]
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

function sectionToSource(section: string): DetectionSource {
  if (section === 'contains') return 'allergens_tags'
  if (section === 'may_contain') return 'traces_tags'
  return 'ingredients_text'
}

export function detectAllergens(product: OFFProduct, userAllergens: UserAllergens): AllergyDetectionResult {
  const allKeys = [...userAllergens.allergyKeys, ...userAllergens.customAllergens]
  if (allKeys.length === 0) {
    return {
      detected_allergens: [],
      safe_allergens: [],
      confidence: 'HIGH',
      warnings: [],
      usedFields: [],
    }
  }

  const config = buildUserAllergenConfig(allKeys)
  const input = toDetectionInput(
    {
      name: product.product_name || product.product_name_en || product.product_name_fr || product.name,
      ingredients: product.ingredients_text || product.ingredients_text_en || product.ingredients_text_fr,
      allergens: product.allergens_tags?.map(t => t.replace(/^[a-z]{2}:/, '')),
      traces: product.traces_tags?.map(t => t.replace(/^[a-z]{2}:/, '')),
    },
    product as Record<string, unknown>
  )
  const output = detectAllergensEvidenceBased(input, config)

  const detected: DetectedAllergen[] = output.matched_allergens.map(m => {
    const key = m.allergen_id.startsWith('custom_') ? m.allergen_name.toLowerCase().replace(/\s+/g, '_') : m.allergen_id
    const confidence: ConfidenceLevel =
      m.severity === 'CONTAINS' ? 'HIGH' : (m.section === 'may_contain' ? 'HIGH' : 'MEDIUM')
    return {
      allergenKey: key,
      matchType: m.severity as MatchType,
      evidence: m.match_text,
      source: sectionToSource(m.section),
      confidence,
    }
  })

  const matchedKeys = new Set(allKeys.map(k => k.toLowerCase().replace(/\s+/g, '_')))
  const detectedKeys = new Set(detected.map(d => d.allergenKey))
  const safe_allergens = allKeys.filter(k => !detectedKeys.has(k.toLowerCase().replace(/\s+/g, '_')))

  const usedFields: string[] = []
  if (output.scan_log.contains_text_used) usedFields.push('allergens_tags')
  if (output.scan_log.may_contain_text_used) usedFields.push('traces_tags')
  if (output.scan_log.ingredients_text_used) usedFields.push('ingredients_text')

  const confidence: ConfidenceLevel = output.overall_status === 'UNKNOWN' ? 'LOW' : 'HIGH'

  return {
    detected_allergens: detected,
    safe_allergens,
    confidence,
    warnings: output.overall_status === 'UNKNOWN' ? ['Insufficient ingredient data'] : [],
    usedFields: usedFields.length > 0 ? usedFields : ['ingredients_text'],
  }
}
