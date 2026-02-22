// Source priority: MANUAL > OCR > OFF
// Stores best allergen result per scan_session_id so UI always shows best available

import type { AllergenCheckResult } from './BarcodeService'

export type DataSource = 'OFF' | 'OCR' | 'MANUAL'

const PRIORITY: Record<DataSource, number> = {
  OFF: 0,
  OCR: 1,
  MANUAL: 2,
}

export const SOURCE_LABELS: Record<DataSource, string> = {
  OFF: 'Open Food Facts',
  OCR: 'Label Scan (OCR)',
  MANUAL: 'Manual Ingredients',
}

export function getSourceLabel(dataSource: DataSource): string {
  return SOURCE_LABELS[dataSource] ?? dataSource
}

interface StoredResult {
  result: AllergenCheckResult
  dataSource: DataSource
}

const store = new Map<string, StoredResult>()
const listeners = new Set<(sessionId: string) => void>()

export function setBestResult(
  sessionId: string,
  result: AllergenCheckResult,
  dataSource: DataSource
): void {
  const existing = store.get(sessionId)
  const newPriority = PRIORITY[dataSource]
  const existingPriority = existing ? PRIORITY[existing.dataSource] : -1

  if (newPriority > existingPriority) {
    store.set(sessionId, { result, dataSource })
    listeners.forEach(fn => fn(sessionId))
  }
}

export function getBestResult(sessionId: string): StoredResult | null {
  return store.get(sessionId) ?? null
}

export function subscribe(listener: (sessionId: string) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function clearSession(sessionId: string): void {
  store.delete(sessionId)
}
