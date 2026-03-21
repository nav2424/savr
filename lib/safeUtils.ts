/**
 * Safe utilities to prevent crashes from malformed data
 */

/**
 * Safely parse JSON - returns null on failure instead of throwing
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (json == null || typeof json !== 'string') return fallback
  try {
    const parsed = JSON.parse(json) as T
    return parsed != null ? parsed : fallback
  } catch {
    return fallback
  }
}

/**
 * Safely get string for .toLowerCase() / .trim() - never throws
 */
export function safeString(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value
  try {
    return String(value)
  } catch {
    return fallback
  }
}

/**
 * Safely access array by index - returns undefined if out of bounds
 */
export function safeArrayGet<T>(arr: T[] | null | undefined, index: number): T | undefined {
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) return undefined
  return arr[index]
}
