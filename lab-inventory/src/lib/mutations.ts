import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { enqueue } from './offline-queue'
import { inviteUser, setUserActive } from './admin-api'
import type { Equipment, MaintenanceSchedule, MaintenanceLog, ItemType, ItemSource, Delivery, StockCount, InventorySession, InventorySessionEntry, UserRole } from '@/types/database'

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

export function useDeleteItemSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; itemTypeId: string }) => {
      const { error } = await supabase.from('item_sources' as never).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['item_sources', vars.itemTypeId] })
      qc.invalidateQueries({ queryKey: ['item_sources', 'all'] })
    },
  })
}

export function useUpdateEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<Equipment> & { id: string }) =>
      tryWriteOrQueue<Equipment>('update', 'equipment', payload, id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment'] })
      qc.invalidateQueries({ queryKey: ['equipment', vars.id] })
    },
  })
}

export function useAddObservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { equipment_id: string; note: string; created_by: string | null }) => {
      const { data, error } = await supabase.from('equipment_observations' as never).insert(payload as never).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment_observations', vars.equipment_id] })
      qc.invalidateQueries({ queryKey: ['equipment_observations', 'all'] })
    },
  })
}

export function useDeleteObservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; equipment_id: string }) => {
      const { error } = await supabase.from('equipment_observations' as never).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment_observations', vars.equipment_id] })
      qc.invalidateQueries({ queryKey: ['equipment_observations', 'all'] })
    },
  })
}

export function useUpdateMaintenanceLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<MaintenanceLog> & { id: string }) =>
      tryWriteOrQueue<MaintenanceLog>('update', 'maintenance_logs', payload, id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['maintenance_logs', vars.equipment_id] })
    },
  })
}

export function useDeleteMaintenanceLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; equipment_id: string }) =>
      tryWriteOrQueue('delete', 'maintenance_logs', {}, id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['maintenance_logs', vars.equipment_id] })
    },
  })
}

export function useRetireEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; retired_at: string; retirement_reason: string; retirement_destination: string; retirement_recipient: string }) =>
      tryWriteOrQueue('update', 'equipment', {
        retired_at: payload.retired_at,
        retirement_reason: payload.retirement_reason,
        retirement_destination: payload.retirement_destination,
        retirement_recipient: payload.retirement_recipient,
      }, payload.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

export function useUnretireEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      tryWriteOrQueue('update', 'equipment', {
        retired_at: null, retirement_reason: null,
        retirement_destination: null, retirement_recipient: null,
      }, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  })
}

export function useUpdateItemType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<ItemType> & { id: string }) =>
      tryWriteOrQueue<ItemType>('update', 'item_types', payload, id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['item_types'] })
      qc.invalidateQueries({ queryKey: ['item_types', vars.id] })
    },
  })
}

export function useUpdateProfileRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useUpdateProfileName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, full_name }: { id: string; full_name: string }) => {
      const { error } = await supabase.from('profiles').update({ full_name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

// Invite + activation go through the server-side admin function (service role).
export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { email: string; full_name: string; role: UserRole }) =>
      inviteUser({ ...p, redirectTo: `${window.location.origin}/set-password` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useSetUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { id: string; is_active: boolean }) => setUserActive(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useDeleteItemType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tryWriteOrQueue('delete', 'item_types', {}, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item_types'] })
      qc.invalidateQueries({ queryKey: ['current_stock'] })
    },
  })
}

export function useDeleteEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tryWriteOrQueue('delete', 'equipment', {}, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
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
      itemTypes: Array<{ id: string; name: string; category: string; track_lots: boolean }>
    }): Promise<InventorySession> => {
      const { data: session, error: sessionError } = await db
        .from('inventory_sessions')
        .insert({ target_date: targetDate, started_by: startedBy, status: 'in_progress' })
        .select()
        .single()
      if (sessionError) throw sessionError

      // For tracked items, fetch active lots
      const trackedIds = itemTypes.filter(i => i.track_lots).map(i => i.id)
      let lotsByItem = new Map<string, Array<{ id: string; expiry_date: string }>>()
      if (trackedIds.length > 0) {
        const { data: lots } = await db
          .from('lots')
          .select('id, item_type_id, expiry_date')
          .in('item_type_id', trackedIds)
          .is('exhausted_at', null)
          .order('expiry_date')
        for (const lot of (lots ?? [])) {
          const arr = lotsByItem.get(lot.item_type_id) ?? []
          arr.push({ id: lot.id, expiry_date: lot.expiry_date })
          lotsByItem.set(lot.item_type_id, arr)
        }
      }

      // Category order
      const CATEGORY_ORDER = [
        'surveillance clinique', 'milieux et chimique', 'culture', 'consomables',
        'articles', 'eep', 'transport', 'accessoires de machines', 'autres articles',
      ]
      const catIdx = (c: string) => {
        const i = CATEGORY_ORDER.indexOf(c.toLowerCase())
        return i === -1 ? 999 : i
      }
      const sorted = [...itemTypes].sort((a, b) => {
        const catDiff = catIdx(a.category) - catIdx(b.category)
        return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name)
      })

      // Build entries: one per lot for tracked items, one per item for others
      const entries: Array<{ session_id: string; item_type_id: string; lot_id: string | null; sort_order: number }> = []
      let order = 0
      for (const item of sorted) {
        if (!item.track_lots) {
          entries.push({ session_id: session.id, item_type_id: item.id, lot_id: null, sort_order: order++ })
        } else {
          const lots = lotsByItem.get(item.id) ?? []
          if (lots.length === 0) {
            // No active lots — include placeholder so item still appears
            entries.push({ session_id: session.id, item_type_id: item.id, lot_id: null, sort_order: order++ })
          } else {
            for (const lot of lots) {
              entries.push({ session_id: session.id, item_type_id: item.id, lot_id: lot.id, sort_order: order++ })
            }
          }
        }
      }

      const { error: entriesError } = await db.from('inventory_session_entries').insert(entries)
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
      entries: Array<{
        item_type_id: string
        lot_id: string | null
        counted_quantity: number | null
        entered_by: string | null
        notes: string | null
      }>
    }) => {
      // Non-lot entries → stock_counts (existing path)
      const counts = entries
        .filter((e) => e.counted_quantity !== null && e.lot_id === null)
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

      // Lot entries → update lots.quantity_remaining (auto-exhaust on 0)
      const lotEntries = entries.filter(e => e.lot_id !== null && e.counted_quantity !== null)
      for (const e of lotEntries) {
        const exhausted = e.counted_quantity === 0
        const { error: lotError } = await db.from('lots').update({
          quantity_remaining: e.counted_quantity!,
          exhausted_at: exhausted ? new Date().toISOString() : null,
        }).eq('id', e.lot_id!)
        if (lotError) throw lotError
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
      qc.invalidateQueries({ queryKey: ['lots'] })
    },
  })
}

// ── Lot mutations ─────────────────────────────────────────────

type LotCreateInput = {
  item_type_id: string
  delivery_id: string | null
  manufacturer: string
  expiry_date: string
  lot_number: string | null
  quantity_initial: number
  quantity_remaining: number
}

export function useUpsertLot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: LotCreateInput) => {
      // Check for existing matching lot (same identity key)
      const { data: existing } = await db
        .from('lots')
        .select('id, quantity_initial, quantity_remaining')
        .eq('item_type_id', input.item_type_id)
        .eq('manufacturer', input.manufacturer)
        .eq('expiry_date', input.expiry_date)
        .is('lot_number', input.lot_number)
        .is('exhausted_at', null)
        .maybeSingle()

      if (existing) {
        // Merge into existing lot — add quantity
        const { data, error } = await db.from('lots').update({
          quantity_initial: existing.quantity_initial + input.quantity_initial,
          quantity_remaining: existing.quantity_remaining + input.quantity_remaining,
        }).eq('id', existing.id).select().single()
        if (error) throw error
        return data
      } else {
        // Create new lot
        const { data, error } = await db.from('lots').insert(input).select().single()
        if (error) throw error
        return data
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['lots', vars.item_type_id] })
      qc.invalidateQueries({ queryKey: ['lots', 'all_active'] })
      qc.invalidateQueries({ queryKey: ['current_stock'] })
    },
  })
}

export function useUpdateLotCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      lotId,
      countedQuantity,
    }: {
      lotId: string
      itemTypeId: string
      countedQuantity: number
    }) => {
      const exhausted = countedQuantity === 0
      const { data, error } = await db.from('lots').update({
        quantity_remaining: countedQuantity,
        exhausted_at: exhausted ? new Date().toISOString() : null,
      }).eq('id', lotId).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['lots', vars.itemTypeId] })
      qc.invalidateQueries({ queryKey: ['lots', 'all_active'] })
      qc.invalidateQueries({ queryKey: ['current_stock'] })
    },
  })
}

export async function uploadEquipmentDocument(file: File): Promise<{ url: string; name: string; size: number } | null> {
  if (!navigator.onLine) return null
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('equipment-documents').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('equipment-documents').getPublicUrl(path)
  return { url: data.publicUrl, name: file.name, size: file.size }
}

type DocPayload = { equipment_id: string; description: string; file_url: string; file_name: string; file_size_bytes: number | null; uploaded_by: string | null }

export function useAddEquipmentDocument() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, DocPayload>({
    mutationFn: async (payload: DocPayload) => {
      const { data, error } = await db.from('equipment_documents').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_data: unknown, vars: { equipment_id: string }) => qc.invalidateQueries({ queryKey: ['equipment_documents', vars.equipment_id] }),
  })
}

export function useDeleteEquipmentDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, equipmentId }: { id: string; equipmentId: string }) => {
      const { error } = await db.from('equipment_documents').delete().eq('id', id)
      if (error) throw error
      return equipmentId
    },
    onSuccess: (_data: unknown, vars: { id: string; equipmentId: string }) => qc.invalidateQueries({ queryKey: ['equipment_documents', vars.equipmentId] }),
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
