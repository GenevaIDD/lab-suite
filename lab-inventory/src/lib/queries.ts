import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Equipment, ItemType, MaintenanceSchedule, MaintenanceLog, Delivery, ItemSource, InventorySession, InventorySessionEntry } from '@/types/database'

export function useEquipmentList() {
  return useQuery({
    queryKey: ['equipment'],
    queryFn: async (): Promise<Equipment[]> => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useEquipment(id: string | undefined) {
  return useQuery({
    queryKey: ['equipment', id],
    enabled: !!id,
    queryFn: async (): Promise<Equipment | null> => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useMaintenanceSchedules(equipmentId?: string) {
  return useQuery({
    queryKey: ['maintenance_schedules', equipmentId ?? 'all'],
    queryFn: async (): Promise<MaintenanceSchedule[]> => {
      let q = supabase.from('maintenance_schedules').select('*').order('next_due')
      if (equipmentId) q = q.eq('equipment_id', equipmentId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMaintenanceLogs(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance_logs', equipmentId],
    enabled: !!equipmentId,
    queryFn: async (): Promise<MaintenanceLog[]> => {
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('*')
        .eq('equipment_id', equipmentId!)
        .order('performed_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useItemTypes() {
  return useQuery({
    queryKey: ['item_types'],
    queryFn: async (): Promise<ItemType[]> => {
      const { data, error } = await supabase
        .from('item_types')
        .select('*')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useDistinctCategories() {
  return useQuery({
    queryKey: ['item_types', 'categories'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('item_types')
        .select('category')
        .order('category')
      if (error) throw error
      return [...new Set((data ?? []).map((r: { category: string }) => r.category))].filter(Boolean)
    },
  })
}

export function useDistinctUnits() {
  return useQuery({
    queryKey: ['item_types', 'units'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('item_types')
        .select('unit')
        .order('unit')
      if (error) throw error
      return [...new Set((data ?? []).map((r: { unit: string }) => r.unit))].filter(Boolean)
    },
  })
}

export function useItemSources(itemTypeId?: string) {
  return useQuery({
    queryKey: ['item_sources', itemTypeId ?? 'all'],
    queryFn: async (): Promise<ItemSource[]> => {
      let q = supabase.from('item_sources').select('*').order('manufacturer')
      if (itemTypeId) q = q.eq('item_type_id', itemTypeId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useDeliveries() {
  return useQuery({
    queryKey: ['deliveries'],
    queryFn: async (): Promise<Delivery[]> => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, item_type:item_types(*), item_source:item_sources(*)')
        .order('received_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data ?? []
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function useActiveSession() {
  return useQuery({
    queryKey: ['inventory_sessions', 'active'],
    queryFn: async (): Promise<InventorySession | null> => {
      const { data, error } = await db
        .from('inventory_sessions')
        .select('*')
        .in('status', ['in_progress', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as InventorySession | null
    },
  })
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['inventory_sessions', id],
    enabled: !!id,
    queryFn: async (): Promise<InventorySession | null> => {
      const { data, error } = await db
        .from('inventory_sessions')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as InventorySession
    },
  })
}

export function useSessionEntries(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['inventory_session_entries', sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<InventorySessionEntry[]> => {
      const { data, error } = await db
        .from('inventory_session_entries')
        .select('*, item_type:item_types(*)')
        .eq('session_id', sessionId!)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as InventorySessionEntry[]
    },
  })
}

export function useCurrentStock() {
  return useQuery({
    queryKey: ['current_stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_stock')
        .select('*')
      if (error) throw error
      return data ?? []
    },
  })
}
