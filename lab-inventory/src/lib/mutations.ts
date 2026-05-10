import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { enqueue } from './offline-queue'
import type { Equipment, MaintenanceSchedule, ItemType, ItemSource, Delivery, StockCount } from '@/types/database'

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

export async function uploadEquipmentPhoto(file: File): Promise<string | null> {
  if (!navigator.onLine) return null
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('equipment-photos').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('equipment-photos').getPublicUrl(path)
  return data.publicUrl
}
