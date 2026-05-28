import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Equipment, ItemType, MaintenanceSchedule, MaintenanceLog, Delivery, ItemSource, StockCount, InventorySession, InventorySessionEntry, EquipmentDocument, InventoryLot } from '@/types/database'

export function useEquipmentList(includeRetired = false) {
  return useQuery({
    queryKey: ['equipment', includeRetired],
    queryFn: async (): Promise<Equipment[]> => {
      let q = supabase.from('equipment').select('*').order('name')
      if (!includeRetired) q = q.is('retired_at', null)
      const { data, error } = await q
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

export function useItemType(id: string | undefined) {
  return useQuery({
    queryKey: ['item_types', id],
    enabled: !!id,
    queryFn: async (): Promise<ItemType | null> => {
      const { data, error } = await supabase
        .from('item_types')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useItemCounts(itemTypeId: string | undefined) {
  return useQuery({
    queryKey: ['stock_counts', itemTypeId],
    enabled: !!itemTypeId,
    queryFn: async (): Promise<StockCount[]> => {
      const { data, error } = await supabase
        .from('stock_counts')
        .select('*')
        .eq('item_type_id', itemTypeId!)
        .order('counted_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useItemDeliveries(itemTypeId: string | undefined) {
  return useQuery({
    queryKey: ['deliveries', itemTypeId],
    enabled: !!itemTypeId,
    queryFn: async (): Promise<Delivery[]> => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, item_source:item_sources(*)')
        .eq('item_type_id', itemTypeId!)
        .order('received_at', { ascending: true })
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

export function useItemLots(itemTypeId: string | undefined, includeExhausted = false) {
  return useQuery({
    queryKey: ['lots', itemTypeId, includeExhausted],
    enabled: !!itemTypeId,
    queryFn: async (): Promise<InventoryLot[]> => {
      let q = db.from('lots').select('*').eq('item_type_id', itemTypeId!).order('expiry_date')
      if (!includeExhausted) q = q.is('exhausted_at', null)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as InventoryLot[]
    },
  })
}

export function useAllActiveLots() {
  return useQuery({
    queryKey: ['lots', 'all_active'],
    queryFn: async (): Promise<InventoryLot[]> => {
      const { data, error } = await db
        .from('lots')
        .select('*, item_type:item_types(id, name, category, unit, min_threshold, track_lots)')
        .is('exhausted_at', null)
        .order('expiry_date')
      if (error) throw error
      return (data ?? []) as InventoryLot[]
    },
  })
}

export function useEquipmentDocuments(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['equipment_documents', equipmentId],
    enabled: !!equipmentId,
    queryFn: async (): Promise<EquipmentDocument[]> => {
      const { data, error } = await db
        .from('equipment_documents')
        .select('*')
        .eq('equipment_id', equipmentId!)
        .order('uploaded_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as EquipmentDocument[]
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

export interface CategoryCoverage {
  category: string
  lastDate: string | null       // target_date of most recent session covering this category
  counted: number               // items counted in that session
  total: number                 // total items in category
}

export function useCategoryCoverage(itemTypes: import('@/types/database').ItemType[]) {
  return useQuery({
    queryKey: ['category_coverage'],
    queryFn: async (): Promise<CategoryCoverage[]> => {
      // Fetch all completed sessions with their entries + item category
      const { data, error } = await db
        .from('inventory_sessions')
        .select('id, target_date, inventory_session_entries(item_type_id, counted_quantity, item_type:item_types(category))')
        .eq('status', 'completed')
        .order('target_date', { ascending: false })
        .limit(20)
      if (error) throw error
      const sessions: Array<{
        id: string
        target_date: string
        inventory_session_entries: Array<{
          item_type_id: string
          counted_quantity: number | null
          item_type: { category: string } | null
        }>
      }> = data ?? []

      // Build per-category totals from item_types
      const categoryTotals = new Map<string, number>()
      for (const it of itemTypes) {
        categoryTotals.set(it.category, (categoryTotals.get(it.category) ?? 0) + 1)
      }

      // For each category, find the most recent session that had entries for it
      const categoryBest = new Map<string, { date: string; counted: number }>()
      for (const session of sessions) {
        const entries = session.inventory_session_entries ?? []
        // Group entries by category for this session
        const byCat = new Map<string, { counted: number }>()
        for (const e of entries) {
          const cat = e.item_type?.category
          if (!cat) continue
          const cur = byCat.get(cat) ?? { counted: 0 }
          if (e.counted_quantity !== null) cur.counted++
          byCat.set(cat, cur)
        }
        // Update categoryBest if this is the most recent for each category
        for (const [cat, stats] of byCat) {
          if (!categoryBest.has(cat)) {
            categoryBest.set(cat, { date: session.target_date, counted: stats.counted })
          }
        }
      }

      // Build result, sorted by coverage % ascending (worst first)
      const result: CategoryCoverage[] = []
      for (const [cat, total] of categoryTotals) {
        const best = categoryBest.get(cat)
        result.push({ category: cat, lastDate: best?.date ?? null, counted: best?.counted ?? 0, total })
      }
      result.sort((a, b) => {
        const pctA = a.total ? a.counted / a.total : 0
        const pctB = b.total ? b.counted / b.total : 0
        return pctA - pctB || a.category.localeCompare(b.category)
      })
      return result
    },
    enabled: itemTypes.length > 0,
  })
}

export function useAllSessions() {
  return useQuery({
    queryKey: ['inventory_sessions', 'all'],
    queryFn: async (): Promise<InventorySession[]> => {
      const { data, error } = await db
        .from('inventory_sessions')
        .select('*')
        .order('target_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as InventorySession[]
    },
  })
}

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
        .select('*, item_type:item_types(*), lot:lots(*)')
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
