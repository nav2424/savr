import { runWithConcurrency } from '../asyncBatch'

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

describe('runWithConcurrency', () => {
  it('preserves order and returns settled results', async () => {
    const tasks = [
      async () => {
        await delay(30)
        return 'a'
      },
      async () => {
        throw new Error('boom')
      },
      async () => {
        await delay(5)
        return 'c'
      },
    ]

    const results = await runWithConcurrency(tasks, 2)
    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'a' })
    expect(results[1].status).toBe('rejected')
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'c' })
  })

  it('does not exceed concurrency limit', async () => {
    let inFlight = 0
    let maxInFlight = 0

    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await delay(10)
      inFlight -= 1
      return i
    })

    await runWithConcurrency(tasks, 3)
    expect(maxInFlight).toBeLessThanOrEqual(3)
  })
})

