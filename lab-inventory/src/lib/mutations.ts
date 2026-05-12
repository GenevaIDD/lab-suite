import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { enqueue } from './offline-queue'
import type { Equipment, MaintenanceSchedule, ItemType, ItemSource, Delivery, StockCount, InventorySession, InventorySessionEntry } from '@/types/database'

type Insert<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>

async function tryWriteOrQueue<T>(
  operation: 'insert' | 'update' | 'delete',
  table: string,
  payload: Record<string, unknown>,
  recordId?: string,
): Promise<T | null> {
  if (!navigator.onLine) {
    enqueue({ table, operation, payload, recordId })
    return null
  }
  try {
    if (operation === 'insert') {
      const { data, error } = await supabase.from(table as never).insert(payload as never).select().single()
      if (error) throw error
      return data as T
    }
    if (operation === 'update' && recordId) {
      const { data, error } = await supabase.from(table as never).update(payload as never).eq('id', recordId).select().single()
      if (error) throw error
      return data as T
    }
    if (operation === 'delete' && recordId) {
      const { error } = await supabase.from(table as never).delete().eq('id', recordId)
      if (error) throw error
      return null
    }
    return null
  } catch (e) {
    enqueue({ table, operation, payload, recordId })
    throw e
  }
}

export function useCreateEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Insert<Equipment>) =>
      tryWriteOrQueue<Equipment>('insert', 'equipment', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

export function useCreateMaintenanceSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Omit<MaintenanceSchedule, 'id' | 'created_at' | 'last_alerted_at'>) =>
      tryWriteOrQueue<MaintenanceSchedule>('insert', 'maintenance_schedules', payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['maintenance_schedules'] })
      qc.invalidateQueries({ queryKey: ['maintenance_schedules', vars.equipment_id] })
    },
  })
}

export function useLogMaintenance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      schedule_id: string
      equipment_id: string
      performed_at: string
      performed_by?: string | null
      notes?: string | null
      next_due: string
    }) => {
      const { next_due, ...logPayload } = payload
      await tryWriteOrQueue('insert', 'maintenance_logs', logPayload)
      await tryWriteOrQueue('update', 'maintenance_schedules', { next_due, last_alerted_at: null }, payload.schedule_id)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['maintenance_logs', vars.equipment_id] })
      qc.invalidateQueries({ queryKey: ['maintenance_schedules', vars.equipment_id] })
      qc.invalidateQueries({ queryKey: ['maintenance_schedules'] })
    },
  })
}

export function useCreateItemType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Insert<ItemType>) =>
      tryWriteOrQueue<ItemType>('insert', 'item_types', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['item_types'] }),
  })
}

export function useCreateItemSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Omit<ItemSource, 'id' | 'created_at'>) =>
      tryWriteOrQueue<ItemSource>('insert', 'item_sources', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['item_sources'] }),
  })
}

export function useCreateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Omit<Delivery, 'id' | 'created_at'>) =>
      tryWriteOrQueue<Delivery>('insert', 'deliveries', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['current_stock'] })
    },
  })
}

export function useCreateStockCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Omit<StockCount, 'id' | 'created_at'>) =>
      tryWriteOrQueue<StockCount>('insert', 'stock_counts', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['current_stock'] }),
  })
}

// ============================================================
// Inventory Sessions
// ============================================================

// Helper: typed as never to bypass Supabase generic inference for new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function useStartSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      targetDate,
      startedBy,
      itemTypes,
    }: {
      targetDate: string
      startedBy: string | null
      itemTypes: Array<{ id: string; name: string; category: string }>
    }): Promise<InventorySession> => {
      const { data: session, error: sessionError } = await db
        .from('inventory_sessions')
        .insert({ target_date: targetDate, started_by: startedBy, status: 'in_progress' })
        .select()
        .single()
      if (sessionError) throw sessionError

      // Fixed category order matching the lab's physical organisation
      const CATEGORY_ORDER = [
        'surveillance clinique',
        'milieux et chimique',
        'culture',
        'consomables',
        'articles',
        'eep',
        'transport',
        'accessoires de machines',
        'autres articles',
      ]
      const catIdx = (c: string) => {
        const i = CATEGORY_ORDER.indexOf(c.toLowerCase())
        return i === -1 ? 999 : i
      }
      const sorted = [...itemTypes].sort((a, b) => {
        const catDiff = catIdx(a.category) - catIdx(b.category)
        return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name)
      })
      const entries = sorted.map((item, idx) => ({
        session_id: session.id,
        item_type_id: item.id,
        sort_order: idx,
      }))
      const { error: entriesError } = await db
        .from('inventory_session_entries')
        .insert(entries)
      if (entriesError) throw entriesError

      return session as InventorySession
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory_sessions'] }),
  })
}

export function useUpdateEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      countedQuantity,
      enteredBy,
      notes,
    }: {
      id: string
      sessionId: string
      countedQuantity: number | null
      enteredBy: string | null
      notes: string | null
    }): Promise<InventorySessionEntry> => {
      const { data, error } = await db
        .from('inventory_session_entries')
        .update({
          counted_quantity: countedQuantity,
          entered_at: new Date().toISOString(),
          entered_by: enteredBy,
          notes,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as InventorySessionEntry
    },
    onSuccess: (_data: unknown, vars: { id: string; sessionId: string; countedQuantity: number | null; enteredBy: string | null; notes: string | null }) => {
      qc.invalidateQueries({ queryKey: ['inventory_session_entries', vars.sessionId] })
    },
  })
}

export function usePauseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await db
        .from('inventory_sessions')
        .update({ status: 'paused', paused_at: new Date().toISOString() })
        .eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory_sessions'] }),
  })
}

export function useResumeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, newDate }: { sessionId: string; newDate: string }) => {
      const { error } = await db
        .from('inventory_sessions')
        .update({ status: 'in_progress', paused_at: null, target_date: newDate })
        .eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory_sessions'] }),
  })
}

export function useCompleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      sessionId,
      targetDate,
      entries,
    }: {
      sessionId: string
      targetDate: string
      entries: Array<{ item_type_id: string; counted_quantity: number | null; entered_by: string | null; notes: string | null }>
    }) => {
      const counts = entries
        .filter((e) => e.counted_quantity !== null)
        .map((e) => ({
          item_type_id: e.item_type_id,
          quantity: e.counted_quantity!,
          counted_at: new Date(targetDate).toISOString(),
          counted_by: e.entered_by,
          notes: e.notes,
        }))

      if (counts.length > 0) {
        const { error: countError } = await supabase.from('stock_counts').insert(counts as never)
        if (countError) throw countError
      }

      const { error } = await db
        .from('inventory_sessions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory_sessions'] })
      qc.invalidateQueries({ queryKey: ['current_stock'] })
    },
  })
}

export async function uploadEquipmentPhoto(file: File): Promise<string | null> {
  if (!navigator.onLine) return null
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('equipment-photos').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('equipment-photos').getPublicUrl(path)
  return data.publicUrl
}
