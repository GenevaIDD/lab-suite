import { supabase } from './supabase'

export interface QueuedWrite {
  id: string
  table: string
  operation: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  recordId?: string
  queuedAt: string
}

const QUEUE_KEY = 'lab_offline_queue'

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

export function enqueue(write: Omit<QueuedWrite, 'id' | 'queuedAt'>): void {
  const queue = getQueue()
  queue.push({ ...write, id: crypto.randomUUID(), queuedAt: new Date().toISOString() })
  saveQueue(queue)
}

export function getPendingCount(): number {
  return getQueue().length
}

export async function flushQueue(): Promise<{ flushed: number; failed: number }> {
  const queue = getQueue()
  if (queue.length === 0) return { flushed: 0, failed: 0 }

  let flushed = 0
  let failed = 0
  const remaining: QueuedWrite[] = []

  for (const item of queue) {
    try {
      if (item.operation === 'insert') {
        const { error } = await supabase.from(item.table as never).insert(item.payload as never)
        if (error) throw error
      } else if (item.operation === 'update' && item.recordId) {
        const { error } = await supabase.from(item.table as never).update(item.payload as never).eq('id', item.recordId)
        if (error) throw error
      } else if (item.operation === 'delete' && item.recordId) {
        const { error } = await supabase.from(item.table as never).delete().eq('id', item.recordId)
        if (error) throw error
      }
      flushed++
    } catch {
      failed++
      remaining.push(item)
    }
  }

  saveQueue(remaining)
  return { flushed, failed }
}

// Auto-flush when connection is restored
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
}
