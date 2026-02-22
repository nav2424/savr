// Scan session - barcode-scoped session for allergen fallback (OCR / manual paste)
// Every barcode scan creates a session; OCR/paste flows require valid session

function generateSessionId(): string {
  return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export interface ScanSession {
  id: string
  user_id: string
  barcode: string
  off_lookup_result: 'found' | 'not_found'
  off_product_code?: string
  off_product_name?: string
  off_brands?: string
  has_ingredient_data: boolean
  created_at: string
}

const SESSION_STORE_KEY = 'savr_scan_sessions'
const MAX_SESSIONS = 20
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

let inMemorySessions: Map<string, ScanSession> = new Map()

/** Create a new scan session (fire-and-forget persist) */
export function createScanSession(params: {
  userId: string
  barcode: string
  offFound: boolean
  offProductCode?: string
  offProductName?: string
  offBrands?: string
  hasIngredientData: boolean
}): ScanSession {
  const session: ScanSession = {
    id: generateSessionId(),
    user_id: params.userId,
    barcode: params.barcode,
    off_lookup_result: params.offFound ? 'found' : 'not_found',
    off_product_code: params.offProductCode,
    off_product_name: params.offProductName,
    off_brands: params.offBrands,
    has_ingredient_data: params.hasIngredientData,
    created_at: new Date().toISOString(),
  }
  inMemorySessions.set(session.id, session)

  // Persist to AsyncStorage if available (fire-and-forget)
  try {
    const { default: AsyncStorage } = require('@react-native-async-storage/async-storage')
    const all = Array.from(inMemorySessions.values())
    const trimmed = all.slice(-MAX_SESSIONS)
    AsyncStorage.setItem(SESSION_STORE_KEY, JSON.stringify(trimmed)).catch(() => {})
  } catch {
    // AsyncStorage not available
  }

  return session
}

/** Get scan session by ID - required for OCR/paste flows */
export function getScanSession(sessionId: string): ScanSession | null {
  return inMemorySessions.get(sessionId) ?? null
}

/** Load sessions from storage on app init */
export async function loadScanSessionsFromStorage(): Promise<void> {
  try {
    const { default: AsyncStorage } = require('@react-native-async-storage/async-storage')
    const raw = await AsyncStorage.getItem(SESSION_STORE_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as ScanSession[]
      const now = Date.now()
      const valid = arr.filter(s => now - new Date(s.created_at).getTime() < SESSION_TTL_MS)
      inMemorySessions = new Map(valid.map(s => [s.id, s]))
    }
  } catch {
    // Ignore
  }
}
