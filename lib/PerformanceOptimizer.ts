// SAVR Performance Optimizer
// Utilities to prevent lag and improve app responsiveness

/**
 * Debounce function - delays execution until after wait period
 * Prevents excessive function calls (e.g., on rapid user input)
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function - limits execution to once per wait period
 * Ensures function doesn't run too frequently
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), wait)
    }
  }
}

/**
 * Run function asynchronously without blocking UI
 * Uses setImmediate or setTimeout to defer execution
 */
export async function runAsync<T>(fn: () => T): Promise<T> {
  return new Promise((resolve) => {
    // Use setImmediate if available, otherwise setTimeout
    const immediate = (typeof setImmediate !== 'undefined' ? setImmediate : setTimeout)
    immediate(() => {
      resolve(fn())
    })
  })
}

/**
 * Simple in-memory cache with TTL (time-to-live)
 */
export class MemoryCache<T> {
  private cache: Map<string, { data: T; expires: number }> = new Map()

  set(key: string, data: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs
    })
  }

  get(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) return null
    
    // Check if expired
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }
    
    return item.data
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): void {
    this.cache.delete(key)
  }
}

/**
 * Batch operations together to reduce re-renders
 */
export class BatchProcessor<T> {
  private queue: T[] = []
  private timeout: NodeJS.Timeout | null = null
  private processor: (items: T[]) => void

  constructor(processor: (items: T[]) => void, delayMs: number = 100) {
    this.processor = processor
  }

  add(item: T, delayMs: number = 100): void {
    this.queue.push(item)

    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    this.timeout = setTimeout(() => {
      this.flush()
    }, delayMs)
  }

  flush(): void {
    if (this.queue.length > 0) {
      const items = [...this.queue]
      this.queue = []
      this.processor(items)
    }
    this.timeout = null
  }
}

/**
 * Chunk large arrays for processing without blocking
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => R,
  chunkSize: number = 10
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    
    // Process chunk
    const chunkResults = chunk.map(processor)
    results.push(...chunkResults)
    
    // Yield to UI thread between chunks
    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  
  return results
}

/**
 * Create a memoized function that caches results
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  getCacheKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>) => {
    const key = getCacheKey ? getCacheKey(...args) : JSON.stringify(args)
    
    if (cache.has(key)) {
      return cache.get(key)!
    }
    
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

