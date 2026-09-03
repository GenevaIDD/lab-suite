import { supabase } from './supabase'

export interface QueuedWrite {
  id: string
  table: string
  operation: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  recordId?: string
  queuedAt: string
}

export interface FailedWrite extends QueuedWrite {
  failedAt: string
  reason: string
}

/**
 * Offline write queuing is DISABLED.
 *
 * Writes attempted while offline now fail loudly instead of being deferred.
 * The queue machinery is kept, and any entries already sitting in a user's
 * localStorage are still drained on reconnect -- disabling capture must not
 * orphan work someone has already recorded.
 *
 * To re-enable, flip this to true. The real fix is teaching the queue to
 * replay RPC calls as well as table writes, which is a prerequisite for the
 * record_delivery / complete_inventory_session work. See TODO.md.
 */
export const OFFLINE_WRITES_ENABLED = false

const QUEUE_KEY = 'lab_offline_queue'
const FAILED_KEY = 'lab_offline_failed'
const MAX_FAILED = 50

// supabase-js never throws on a transport failure: it catches the fetch
// rejection and resolves with { error, status: 0, code: '' }. Any other
// status means PostgREST actually answered — an RLS denial, a constraint
// violation, a bad payload — and replaying it later will fail identically.
// Only these are worth keeping in the queue.
const TRANSIENT_STATUSES = new Set([408, 429, 502, 503, 504])

/** True only for failures a later retry could plausibly resolve. */
export function isRetryableFailure(status: number | undefined): boolean {
  if (status === 0) return true
  return status !== undefined && TRANSIENT_STATUSES.has(status)
}

function getQueue(): QueuedWrite[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedWrite[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/** Writes PostgREST rejected outright. Kept for inspection, never retried. */
export function getFailedWrites(): FailedWrite[] {
  try {
    return JSON.parse(localStorage.getItem(FAILED_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function clearFailedWrites(): void {
  localStorage.removeItem(FAILED_KEY)
}

function recordFailure(item: QueuedWrite, reason: string): void {
  const failed = getFailedWrites()
  failed.push({ ...item, failedAt: new Date().toISOString(), reason })
  localStorage.setItem(FAILED_KEY, JSON.stringify(failed.slice(-MAX_FAILED)))
}

export function enqueue(write: Omit<QueuedWrite, 'id' | 'queuedAt'>): void {
  if (!OFFLINE_WRITES_ENABLED) return
  const queue = getQueue()
  queue.push({ ...write, id: crypto.randomUUID(), queuedAt: new Date().toISOString() })
  saveQueue(queue)
}

export function getPendingCount(): number {
  return getQueue().length
}

async function replay(item: QueuedWrite): Promise<{ error: unknown; status: number | undefined }> {
  if (item.operation === 'insert') {
    const { error, status } = await supabase.from(item.table as never).insert(item.payload as never)
    return { error, status }
  }
  if (item.operation === 'update' && item.recordId) {
    const { error, status } = await supabase.from(item.table as never).update(item.payload as never).eq('id', item.recordId)
    return { error, status }
  }
  if (item.operation === 'delete' && item.recordId) {
    const { error, status } = await supabase.from(item.table as never).delete().eq('id', item.recordId)
    return { error, status }
  }
  return { error: new Error(`Malformed queue entry: ${item.operation} without recordId`), status: undefined }
}

// Both this module and useOnlineStatus listen for 'online'. Without this
// guard the two flushes read the same queue array and replay every entry
// twice, duplicating writes on every reconnect.
let inFlight: Promise<{ flushed: number; failed: number; dropped: number }> | null = null

export function flushQueue(): Promise<{ flushed: number; failed: number; dropped: number }> {
  if (inFlight) return inFlight
  inFlight = doFlush().finally(() => { inFlight = null })
  return inFlight
}

async function doFlush(): Promise<{ flushed: number; failed: number; dropped: number }> {
  const queue = getQueue()
  if (queue.length === 0) return { flushed: 0, failed: 0, dropped: 0 }

  let flushed = 0
  let failed = 0
  let dropped = 0
  const remaining: QueuedWrite[] = []

  for (const item of queue) {
    let error: unknown
    let status: number | undefined
    try {
      ;({ error, status } = await replay(item))
    } catch (e) {
      error = e
      status = undefined
    }

    if (!error) {
      flushed++
      continue
    }

    const message = (error as { message?: string })?.message ?? String(error)
    if (isRetryableFailure(status)) {
      failed++
      remaining.push(item)
    } else {
      // Terminal: PostgREST answered and will answer the same way next time.
      dropped++
      recordFailure(item, `${status ?? 'unknown'}: ${message}`)
    }
  }

  saveQueue(remaining)
  return { flushed, failed, dropped }
}

// Auto-flush when connection is restored. Guarded by `inFlight` above, so
// this coexisting with useOnlineStatus's listener is harmless.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void flushQueue() })
}
