export type Task<T> = () => Promise<T>

export type SettledResult<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown }

/**
 * Runs async tasks with a concurrency limit, preserving result order.
 */
export async function runWithConcurrency<T>(
  tasks: Array<Task<T>>,
  concurrency: number
): Promise<Array<SettledResult<T>>> {
  const safeConcurrency = Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 1
  const results: Array<SettledResult<T>> = new Array(tasks.length)

  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= tasks.length) return

      try {
        const value = await tasks[current]()
        results[current] = { status: 'fulfilled', value }
      } catch (reason) {
        results[current] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Array.from({ length: Math.min(safeConcurrency, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

