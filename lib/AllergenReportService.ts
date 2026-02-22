// Report incorrect allergen result - barcode-scoped telemetry
// Fire-and-forget; never crash the app

import { supabase } from './supabase'

const TRUNCATE_LEN = 500

export async function reportIncorrectAllergenResult(params: {
  userId: string
  scanSessionId?: string
  barcode: string
  overallStatus: 'CONTAINS' | 'MAY_CONTAIN' | 'UNKNOWN'
  matchedAllergens: Array<{ allergen_id: string; match_text: string; section: string }>
  enabledAllergenIds: string[]
  offProductCode?: string
  offProductName?: string
  offBrands?: string
  ingredientsText?: string
  containsText?: string
  mayContainText?: string
}): Promise<void> {
  try {
    const payload = {
      user_id: params.userId,
      scan_session_id: params.scanSessionId ?? null,
      barcode: params.barcode,
      overall_status: params.overallStatus,
      matched_allergens: params.matchedAllergens,
      enabled_allergen_ids: params.enabledAllergenIds,
      off_product_code: params.offProductCode ?? null,
      off_product_name: (params.offProductName ?? '').slice(0, 200) || null,
      off_brands: (params.offBrands ?? '').slice(0, 200) || null,
      ingredients_text_truncated: params.ingredientsText
        ? params.ingredientsText.slice(0, TRUNCATE_LEN)
        : null,
      contains_text_truncated: params.containsText
        ? params.containsText.slice(0, TRUNCATE_LEN)
        : null,
      may_contain_text_truncated: params.mayContainText
        ? params.mayContainText.slice(0, TRUNCATE_LEN)
        : null,
    }
    const { error } = await supabase.from('allergen_scan_reports').insert(payload)
    if (error) {
      // Table may not exist or RLS may block
    }
  } catch (_e) {
    // Never crash; fire-and-forget
  }
}
