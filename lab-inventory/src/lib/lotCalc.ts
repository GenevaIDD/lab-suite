/**
 * Lot-level stock calculation functions.
 * These mirror the SQL logic that will run in Supabase for track_lots items,
 * extracted here so they can be unit-tested.
 *
 * A "lot" is uniquely identified by (item_type_id, manufacturer, expiry_date, lot_number?)
 * Manufacturer and expiry_date are always required; lot_number is optional.
 */

export interface Lot {
  id: string
  item_type_id: string
  manufacturer: string
  expiry_date: string          // YYYY-MM-DD
  lot_number: string | null
  quantity_initial: number
  quantity_remaining: number
  exhausted_at: string | null  // ISO timestamp, null = still active
}

export interface LotInput {
  manufacturer: string
  expiry_date: string
  lot_number?: string | null
  quantity: number
}

// ── Stock calculation ─────────────────────────────────────────

/**
 * Sum quantity_remaining across all active (non-exhausted) lots.
 * This is what replaces the "last count + deliveries since" logic
 * for track_lots items.
 */
export function sumActiveLots(lots: Lot[]): number {
  return lots
    .filter(l => l.exhausted_at === null)
    .reduce((sum, l) => sum + l.quantity_remaining, 0)
}

/**
 * True if the combined active stock is below the minimum threshold.
 * Always uses the combined total — never per-lot.
 */
export function isLotStockLow(lots: Lot[], minThreshold: number): boolean {
  return sumActiveLots(lots) < minThreshold
}

// ── Lot identity ──────────────────────────────────────────────

/**
 * Canonical string key for a lot's identity.
 * Used to determine whether two deliveries belong to the same lot.
 * Format: "manufacturer|expiry_date|lot_number" (empty string when no lot number)
 */
export function lotKey(manufacturer: string, expiryDate: string, lotNumber?: string | null): string {
  return `${manufacturer.trim().toLowerCase()}|${expiryDate}|${(lotNumber ?? '').trim().toLowerCase()}`
}

/**
 * True if two lot inputs represent the same physical lot.
 */
export function isSameLot(a: LotInput, b: LotInput): boolean {
  return lotKey(a.manufacturer, a.expiry_date, a.lot_number) ===
         lotKey(b.manufacturer, b.expiry_date, b.lot_number)
}

// ── Exhaustion ────────────────────────────────────────────────

/**
 * True when a counted quantity should exhaust a lot.
 * Exhaustion = counted as zero in an inventory session.
 */
export function shouldExhaustLot(countedQuantity: number): boolean {
  return countedQuantity === 0
}

/**
 * Apply an inventory count to a lot: return updated quantity_remaining
 * and whether the lot is now exhausted.
 */
export function applyCountToLot(
  lot: Lot,
  countedQuantity: number,
): { quantity_remaining: number; exhausted: boolean } {
  return {
    quantity_remaining: countedQuantity,
    exhausted: shouldExhaustLot(countedQuantity),
  }
}

// ── Session building ──────────────────────────────────────────

export interface SessionLotEntry {
  item_type_id: string
  lot_id: string | null           // null for non-tracked items
  sort_order: number
  // display helpers
  manufacturer: string | null
  expiry_date: string | null
  lot_number: string | null
}

/**
 * Build the list of session entries for a guided inventory.
 *
 * For non-tracked items: one entry per item (lot_id = null).
 * For tracked items: one entry per active lot, grouped after the item's
 * non-lot siblings in category order.
 *
 * Exhausted lots are excluded — they should never appear in future sessions.
 */
export function buildSessionEntries(
  items: Array<{ id: string; category: string; name: string; track_lots: boolean }>,
  activeLotsByItem: Map<string, Lot[]>,  // only active (non-exhausted) lots
): SessionLotEntry[] {
  const entries: SessionLotEntry[] = []
  let order = 0

  for (const item of items) {
    if (!item.track_lots) {
      entries.push({
        item_type_id: item.id,
        lot_id: null,
        sort_order: order++,
        manufacturer: null,
        expiry_date: null,
        lot_number: null,
      })
    } else {
      const lots = activeLotsByItem.get(item.id) ?? []
      if (lots.length === 0) {
        // Tracked item with no active lots — still include so user can
        // record a new delivery/count, but with a null lot_id placeholder
        entries.push({
          item_type_id: item.id,
          lot_id: null,
          sort_order: order++,
          manufacturer: null,
          expiry_date: null,
          lot_number: null,
        })
      } else {
        // One row per active lot, sorted by expiry date ascending
        const sorted = [...lots].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
        for (const lot of sorted) {
          entries.push({
            item_type_id: item.id,
            lot_id: lot.id,
            sort_order: order++,
            manufacturer: lot.manufacturer,
            expiry_date: lot.expiry_date,
            lot_number: lot.lot_number,
          })
        }
      }
    }
  }

  return entries
}

// ── Expiry alerts ─────────────────────────────────────────────

/**
 * Return active lots that are expiring within `daysThreshold` days.
 * Sorted by expiry_date ascending (soonest first).
 * Only includes lots with quantity_remaining > 0 (active, non-exhausted).
 */
export function getExpiringLots(lots: Lot[], daysThreshold: number): Lot[] {
  // Use YYYY-MM-DD string comparison throughout to avoid timezone issues
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const cutoffDate = new Date(today)
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() + daysThreshold)
  const cutoffStr = cutoffDate.toISOString().slice(0, 10)

  return lots
    .filter(l => {
      if (l.exhausted_at !== null) return false
      if (l.quantity_remaining <= 0) return false
      return l.expiry_date >= todayStr && l.expiry_date <= cutoffStr
    })
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
}
