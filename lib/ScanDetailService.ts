// Fetch scan detail (allergen log) for history items
import { supabase } from './supabase'
import { userPreferencesService } from './UserPreferencesService'
import {
  detectAllergensEvidenceBased,
  buildUserAllergenConfig,
  toDetectionInput,
} from './allergenEngine'
import { normalizeOFFProduct } from './allergenEngine/offNormalizer'

export type AllergenLogStatus = 'SAFE' | 'CONTAINS' | 'MAY_CONTAIN' | 'UNKNOWN'

export interface MatchedAllergen {
  allergen_id: string
  allergen_name: string
  severity: string
  section: string
  match_text: string
}

export interface ScanDetail {
  productName: string
  barcode: string
  scannedAt: string
  addedToPantry?: boolean
  /** Overall allergen status from the scan */
  overallStatus: AllergenLogStatus
  /** Ingredients text used for detection */
  ingredientsText?: string
  /** Contains (declared allergens) text */
  containsText?: string
  /** May contain (traces) text */
  mayContainText?: string
  /** Whether we had usable ingredient data */
  hasIngredientData: boolean
  /** Detected allergens (for CONTAINS/MAY_CONTAIN) */
  matchedAllergens: MatchedAllergen[]
  /** True when result came from live re-check (no saved log) */
  fromLiveCheck?: boolean
}

/** Fetch product data by barcode (scanned_products or OFF API). Returns product + optional raw OFF for detection. */
async function fetchProductByBarcode(barcode: string): Promise<{
  product: { name: string; ingredients?: string; allergens?: string[]; traces?: string[] }
  offProduct?: Record<string, unknown>
} | null> {
  const { data } = await supabase
    .from('scanned_products')
    .select('product_data')
    .eq('barcode', barcode)
    .single()
  if (data?.product_data) {
    const p = data.product_data as any
    return { product: { name: p.name, ingredients: p.ingredients, allergens: p.allergens, traces: p.traces } }
  }
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
    const json = await res.json()
    if (json.status !== 1 || !json.product) return null
    const prod = json.product
    const norm = normalizeOFFProduct(prod)
    if (!norm) return null
    return {
      product: {
        name: norm.product_name || prod.product_name,
        ingredients: norm.ingredients_text || undefined,
        allergens: norm.allergens_tags?.map((t: string) => t.replace(/^[a-z]{2}:/, '')) || [],
        traces: norm.traces_tags?.map((t: string) => t.replace(/^[a-z]{2}:/, '')) || [],
      },
      offProduct: prod,
    }
  } catch {
    return null
  }
}

/** Run allergen check on product data (fallback when no saved log) */
async function runLiveAllergenCheck(
  userId: string,
  product: { name: string; ingredients?: string; allergens?: string[]; traces?: string[] },
  offProduct?: Record<string, unknown>
): Promise<ScanDetail> {
  const prefs = await userPreferencesService.loadPreferences(userId)
  const allergies = prefs?.dietary?.allergies || []
  if (allergies.length === 0) {
    return {
      productName: product.name,
      barcode: '',
      scannedAt: '',
      overallStatus: 'SAFE',
      hasIngredientData: false,
      matchedAllergens: [],
      fromLiveCheck: true,
    }
  }
  const input = toDetectionInput(product, offProduct)
  const userConfig = buildUserAllergenConfig(allergies)
  const output = detectAllergensEvidenceBased(input, userConfig)
  const statusMap = { SAFE: 'SAFE' as const, CONTAINS: 'CONTAINS' as const, MAY_CONTAIN: 'MAY_CONTAIN' as const, UNKNOWN: 'UNKNOWN' as const }
  const matched: MatchedAllergen[] = (output.matched_allergens || []).map((m) => ({
    allergen_id: m.allergen_id,
    allergen_name: m.allergen_name,
    severity: m.severity,
    section: m.section,
    match_text: m.match_text,
  }))
  return {
    productName: product.name,
    barcode: '',
    scannedAt: '',
    overallStatus: statusMap[output.overall_status] ?? 'UNKNOWN',
    ingredientsText: output.scan_log.ingredients_text_used || undefined,
    containsText: output.scan_log.contains_text_used || undefined,
    mayContainText: output.scan_log.may_contain_text_used || undefined,
    hasIngredientData: output.scan_log.has_ingredient_data ?? false,
    matchedAllergens: matched,
    fromLiveCheck: true,
  }
}

/**
 * Fetch scan detail for a history item. Looks up allergen_scan_logs by user+barcode,
 * matching the log closest to scanned_at (within 5 min window). Falls back to most
 * recent log for that barcode if no time match. If no saved log exists, re-fetches
 * product and runs allergen check live.
 */
export async function fetchScanDetail(
  userId: string,
  barcode: string,
  productName: string,
  scannedAt: string,
  addedToPantry?: boolean
): Promise<ScanDetail | null> {
  // Try saved log first (if table exists)
  try {
    const scannedDate = new Date(scannedAt)
    const windowStart = new Date(scannedDate.getTime() - 5 * 60 * 1000)
    const windowEnd = new Date(scannedDate.getTime() + 5 * 60 * 1000)

    const { data: logs, error } = await supabase
      .from('allergen_scan_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('barcode', barcode)
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', windowEnd.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error && logs?.[0]) {
      const log = logs[0]
      const matched = (log.matched_allergens as MatchedAllergen[]) || []
      return {
        productName: log.product_name || productName,
        barcode: log.barcode,
        scannedAt,
        addedToPantry,
        overallStatus: (log.overall_status as AllergenLogStatus) || 'UNKNOWN',
        ingredientsText: log.ingredients_text_used || undefined,
        containsText: log.contains_text_used || undefined,
        mayContainText: log.may_contain_text_used || undefined,
        hasIngredientData: log.has_ingredient_data ?? false,
        matchedAllergens: matched,
      }
    }

    if (!error) {
      const { data: fallbackLogs } = await supabase
        .from('allergen_scan_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('barcode', barcode)
        .order('created_at', { ascending: false })
        .limit(1)
      if (fallbackLogs?.[0]) {
        const log = fallbackLogs[0]
        const matched = (log.matched_allergens as MatchedAllergen[]) || []
        return {
          productName: log.product_name || productName,
          barcode: log.barcode,
          scannedAt,
          addedToPantry,
          overallStatus: (log.overall_status as AllergenLogStatus) || 'UNKNOWN',
          ingredientsText: log.ingredients_text_used || undefined,
          containsText: log.contains_text_used || undefined,
          mayContainText: log.may_contain_text_used || undefined,
          hasIngredientData: log.has_ingredient_data ?? false,
          matchedAllergens: matched,
        }
      }
    }
  } catch (_e) {
    // Table may not exist; fall through to live check
  }

  // No saved log: fetch product and run allergen check live
  const fetched = await fetchProductByBarcode(barcode)
  if (fetched) {
    const detail = await runLiveAllergenCheck(userId, fetched.product, fetched.offProduct)
    return {
      ...detail,
      productName: fetched.product.name || productName,
      barcode,
      scannedAt,
      addedToPantry,
    }
  }

  return {
    productName,
    barcode,
    scannedAt,
    addedToPantry,
    overallStatus: 'UNKNOWN',
    hasIngredientData: false,
    matchedAllergens: [],
    fromLiveCheck: true,
  }
}
