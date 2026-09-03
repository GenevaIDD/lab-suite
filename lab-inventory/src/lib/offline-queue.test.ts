import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isRetryableFailure } from './offline-queue'

// ── isRetryableFailure ────────────────────────────────────────
//
// supabase-js does not throw on a transport failure: it catches the fetch
// rejection and resolves with { error, status: 0 }. Any other status means
// PostgREST answered, so a replay would produce the same answer.

describe('isRetryableFailure', () => {
  it('treats a transport failure (status 0) as retryable', () => {
    expect(isRetryableFailure(0)).toBe(true)
  })

  it('treats gateway and rate-limit failures as retryable', () => {
    expect(isRetryableFailure(408)).toBe(true)
    expect(isRetryableFailure(429)).toBe(true)
    expect(isRetryableFailure(502)).toBe(true)
    expect(isRetryableFailure(503)).toBe(true)
    expect(isRetryableFailure(504)).toBe(true)
  })

  it('treats an RLS denial as terminal', () => {
    expect(isRetryableFailure(401)).toBe(false)
    expect(isRetryableFailure(403)).toBe(false)
  })

  it('treats a constraint violation or bad payload as terminal', () => {
    expect(isRetryableFailure(400)).toBe(false)
    expect(isRetryableFailure(409)).toBe(false)
    expect(isRetryableFailure(422)).toBe(false)
  })

  it('treats an unclassifiable failure as terminal rather than queueing it forever', () => {
    expect(isRetryableFailure(undefined)).toBe(false)
  })

  it('does not treat a 500 as retryable', () => {
    // A PostgREST 500 is usually a genuine server-side fault (a bad trigger,
    // a failing function) that replaying will not resolve.
    expect(isRetryableFailure(500)).toBe(false)
  })
})

// ── flushQueue classification ─────────────────────────────────

const from = vi.fn()
vi.mock('./supabase', () => ({ supabase: { from: (t: string) => from(t) } }))

// Minimal in-memory Storage — the queue only needs get/set/remove.
function makeStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  }
}

describe('flushQueue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
    from.mockReset()
    vi.resetModules()
  })

  it('drops a terminal failure to the dead-letter list instead of retrying it', async () => {
    const { enqueue, flushQueue, getPendingCount, getFailedWrites } = await import('./offline-queue')
    enqueue({ table: 'stock_counts', operation: 'insert', payload: { quantity: 5 } })

    from.mockReturnValue({
      insert: () => Promise.resolve({ error: { message: 'new row violates row-level security policy' }, status: 403 }),
    })

    const result = await flushQueue()

    expect(result).toEqual({ flushed: 0, failed: 0, dropped: 1 })
    expect(getPendingCount()).toBe(0)
    expect(getFailedWrites()).toHaveLength(1)
    expect(getFailedWrites()[0].reason).toContain('403')
  })

  it('keeps a transport failure queued for a later retry', async () => {
    const { enqueue, flushQueue, getPendingCount, getFailedWrites } = await import('./offline-queue')
    enqueue({ table: 'stock_counts', operation: 'insert', payload: { quantity: 5 } })

    from.mockReturnValue({
      insert: () => Promise.resolve({ error: { message: 'TypeError: Failed to fetch' }, status: 0 }),
    })

    const result = await flushQueue()

    expect(result).toEqual({ flushed: 0, failed: 1, dropped: 0 })
    expect(getPendingCount()).toBe(1)
    expect(getFailedWrites()).toHaveLength(0)
  })

  it('clears an entry that replays successfully', async () => {
    const { enqueue, flushQueue, getPendingCount } = await import('./offline-queue')
    enqueue({ table: 'stock_counts', operation: 'insert', payload: { quantity: 5 } })

    from.mockReturnValue({ insert: () => Promise.resolve({ error: null, status: 201 }) })

    const result = await flushQueue()

    expect(result).toEqual({ flushed: 1, failed: 0, dropped: 0 })
    expect(getPendingCount()).toBe(0)
  })

  it('replays each entry once when two listeners flush concurrently', async () => {
    const { enqueue, flushQueue, getPendingCount } = await import('./offline-queue')
    enqueue({ table: 'stock_counts', operation: 'insert', payload: { quantity: 5 } })

    let inserts = 0
    from.mockReturnValue({
      insert: () => {
        inserts++
        return new Promise((resolve) => setTimeout(() => resolve({ error: null, status: 201 }), 10))
      },
    })

    // The module-level 'online' listener and useOnlineStatus both fire here.
    await Promise.all([flushQueue(), flushQueue()])

    expect(inserts).toBe(1)
    expect(getPendingCount()).toBe(0)
  })
})
