/**
 * Alert detection — what needs a human's attention right now.
 *
 * Pure functions, deliberately free of React, Supabase and the `@/` path
 * alias, so the same code runs in two places that share no runtime:
 *
 *   - the Dashboard (browser), and
 *   - the weekly digest email (Vercel serverless function under api/).
 *
 * `api/` is outside tsconfig.app.json's `include`, and Vercel's Node build
 * does not resolve the Vite `@` alias, so anything imported from there must
 * be reachable by a relative path with no alias in its own imports. Keep it
 * that way: an `@/` import here breaks the digest at build time, not at
 * review time.
 *
 * Input types are structural rather than the row types from
 * ../types/database, matching the convention lotCalc.ts already sets. The
 * callers pass richer objects and the generics preserve them, so the
 * Dashboard still gets its full ItemType back out.
 *
 * Relative imports here carry an explicit .js extension, which looks wrong in
 * a .ts file and is not. The package is "type": "module", and Vercel
 * transpiles each file for the serverless bundle without rewriting import
 * specifiers, so Node's ESM resolver needs the extension at runtime.
 * TypeScript maps ./x.js back to ./x.ts, and Vite does the same, so all three
 * agree. Drop the extension and the function dies in Lambda with
 * ERR_MODULE_NOT_FOUND while every local check still passes.
 *
 * Date arithmetic uses date-fns exactly as the Dashboard did before this
 * module existed, so the extraction is behaviour-preserving. Lot expiry is
 * the exception: getExpiringLots compares YYYY-MM-DD strings in UTC, which
 * is lotCalc.ts's deliberate choice to dodge timezone drift.
 */

import { differenceInDays, parseISO } from 'date-fns'
import { getExpiringLots } from './lotCalc.js'
import type { Lot } from './lotCalc'

// ── Thresholds ────────────────────────────────────────────────

/** Days without a count before an item is "stale". */
export const STALE_COUNT_DAYS = 60

/** How far ahead to look for lots approaching expiry. */
export const EXPIRY_HORIZON_DAYS = 90

// ── Input shapes ──────────────────────────────────────────────

export interface AlertEquipment {
  id: string
  name: string
}

export interface AlertSchedule {
  id: string
  equipment_id: string
  label: string
  next_due: string            // YYYY-MM-DD
  lead_days: number
  last_alerted_at?: string | null
}

export interface AlertItemType {
  id: string
  name: string
  unit: string
  min_threshold: number
  low_stock_alerted_at?: string | null
}

/** One row of the `current_stock` view. */
export interface AlertStockRow {
  item_type_id: string
  quantity: number
  last_counted_at: string | null
}

// ── Result shapes ─────────────────────────────────────────────

export interface MaintenanceAlert<S = AlertSchedule, E = AlertEquipment> {
  schedule: S
  equipment: E
  /** Days until due. Negative means overdue by that many days. */
  days: number
}

/** An item type joined to its current quantity and last-count date. */
export type ItemStock<T> = T & {
  quantity: number
  last_counted_at: string | null
}

export type StaleCountAlert<T> = ItemStock<T> & {
  /** Days since the last count, or null if never counted. */
  daysSince: number | null
}

// ── Maintenance ───────────────────────────────────────────────

/**
 * Split maintenance schedules into overdue and due-soon.
 *
 * "Due soon" is per-schedule: each carries its own `lead_days` (default 60),
 * so a yearly service can warn earlier than a monthly one. Schedules whose
 * equipment is missing from `equipment` are dropped rather than rendered
 * without a name — that only happens if the two queries disagree.
 *
 * Both lists sort nearest-first, which for overdue means least overdue
 * first.
 */
export function findMaintenanceDue<
  S extends AlertSchedule,
  E extends AlertEquipment,
>(
  schedules: S[],
  equipment: E[],
  today: Date = new Date(),
): { overdue: MaintenanceAlert<S, E>[]; dueSoon: MaintenanceAlert<S, E>[] } {
  const equipmentMap = new Map(equipment.map((e) => [e.id, e]))
  const overdue: MaintenanceAlert<S, E>[] = []
  const dueSoon: MaintenanceAlert<S, E>[] = []

  for (const schedule of schedules) {
    const eq = equipmentMap.get(schedule.equipment_id)
    if (!eq) continue
    const days = differenceInDays(parseISO(schedule.next_due), today)
    if (days < 0) overdue.push({ schedule, equipment: eq, days })
    else if (days <= schedule.lead_days) dueSoon.push({ schedule, equipment: eq, days })
  }

  overdue.sort((a, b) => a.days - b.days)
  dueSoon.sort((a, b) => a.days - b.days)
  return { overdue, dueSoon }
}

// ── Item stock ────────────────────────────────────────────────

/**
 * Join item types to their row in `current_stock`.
 *
 * An item with no row is treated as zero rather than skipped: a
 * never-counted item with a threshold above zero is exactly the case worth
 * flagging, and dropping it would hide it from every check below.
 */
export function withStock<T extends AlertItemType>(
  itemTypes: T[],
  stockRows: AlertStockRow[],
): ItemStock<T>[] {
  const stockByItem = new Map(stockRows.map((r) => [r.item_type_id, r]))
  return itemTypes.map((item) => {
    const row = stockByItem.get(item.id)
    return {
      ...item,
      quantity: Number(row?.quantity ?? 0),
      last_counted_at: row?.last_counted_at ?? null,
    }
  })
}

/**
 * Items whose current quantity has fallen below their own minimum.
 * Sorted lowest-first, so anything already at zero leads.
 */
export function findLowStock<T extends AlertItemType>(
  itemTypes: T[],
  stockRows: AlertStockRow[],
): ItemStock<T>[] {
  return withStock(itemTypes, stockRows)
    .filter((item) => item.quantity < item.min_threshold)
    .sort((a, b) => a.quantity - b.quantity)
}

// ── Stale counts ──────────────────────────────────────────────

/**
 * Items nobody has counted in `thresholdDays`.
 *
 * Runs over every item, not just the ones already low: an item sitting at a
 * comfortable number that nobody has verified in four months is precisely
 * the blind spot this is meant to expose.
 *
 * CAVEAT, and it matters for lot-tracked items. This trusts whatever
 * `last_counted_at` the caller supplies. When that comes from the
 * `current_stock` view, the tracked branch computes
 * `coalesce(lcd.counted_at, max(l.created_at))` (schema.sql, `tracked` CTE),
 * so a lot-tracked item that has received deliveries but was never
 * physically counted reports the lot's *creation* date and looks freshly
 * counted. That is a case you would want flagged, and this cannot see it.
 *
 * The fix is upstream, not here: pass stock rows whose `last_counted_at`
 * was read from `stock_counts` directly. This stays deliberately dumb so
 * the caller owns that decision.
 *
 * Never-counted items (null) are always stale and sort first; the rest sort
 * longest-neglected first.
 */
export function findStaleCounts<T extends AlertItemType>(
  itemTypes: T[],
  stockRows: AlertStockRow[],
  thresholdDays: number = STALE_COUNT_DAYS,
  today: Date = new Date(),
): StaleCountAlert<T>[] {
  return withStock(itemTypes, stockRows)
    .map((item) => ({
      ...item,
      daysSince: item.last_counted_at
        ? differenceInDays(today, parseISO(item.last_counted_at))
        : null,
    }))
    .filter((item) => item.daysSince === null || item.daysSince >= thresholdDays)
    .sort((a, b) => {
      if (a.daysSince === null) return b.daysSince === null ? 0 : -1
      if (b.daysSince === null) return 1
      return b.daysSince - a.daysSince
    })
}

// ── Expiry ────────────────────────────────────────────────────

/**
 * Active lots already past their expiry date.
 *
 * Mirrors getExpiringLots' UTC string comparison rather than using date-fns,
 * so "expired" and "expiring" can never disagree about where today falls.
 * A lot with nothing left in it is not a problem, so zero-quantity lots are
 * excluded here just as they are there.
 */
export function findExpiredLots<T extends Lot>(lots: T[], today: Date = new Date()): T[] {
  const todayStr = today.toISOString().slice(0, 10)
  return lots
    .filter((l) => l.exhausted_at === null && l.quantity_remaining > 0 && l.expiry_date < todayStr)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
}

export { getExpiringLots }

// ── Digest ────────────────────────────────────────────────────

export interface DigestInput<
  S extends AlertSchedule,
  E extends AlertEquipment,
  I extends AlertItemType,
  L extends Lot,
> {
  equipment: E[]
  schedules: S[]
  itemTypes: I[]
  /** Rows of the `current_stock` view. */
  stockRows: AlertStockRow[]
  /** Active (non-exhausted) lots. */
  lots: L[]
  /**
   * True last-count dates keyed by item_type_id, read from `stock_counts`
   * rather than the `current_stock` view. Supply this and the stale check
   * stops being fooled by the view's max(lots.created_at) fallback — an item
   * absent from the map has genuinely never been counted. Omit it and the
   * stale check falls back to the view, with the under-reporting described
   * on findStaleCounts.
   */
  lastCountedByItem?: Map<string, string>
  today?: Date
  staleDays?: number
  expiryHorizonDays?: number
}

export interface Digest<
  S extends AlertSchedule,
  E extends AlertEquipment,
  I extends AlertItemType,
  L extends Lot,
> {
  generatedAt: string
  overdue: MaintenanceAlert<S, E>[]
  dueSoon: MaintenanceAlert<S, E>[]
  lowStock: ItemStock<I>[]
  expired: L[]
  expiring: L[]
  stale: StaleCountAlert<I>[]
  /** Total rows across every section — what the email has to fit. */
  total: number
  /** True when nothing needs attention. Still worth sending; see api/weekly-digest.ts. */
  isEmpty: boolean
  staleDays: number
  expiryHorizonDays: number
}

/**
 * Run every check and collect the results.
 *
 * This is the whole content of the weekly email. It reads nothing and sends
 * nothing — the caller does the I/O — so the digest can be built from
 * fixtures in a test and from Postgres in production by the same code.
 */
export function buildDigest<
  S extends AlertSchedule,
  E extends AlertEquipment,
  I extends AlertItemType,
  L extends Lot,
>(input: DigestInput<S, E, I, L>): Digest<S, E, I, L> {
  const {
    equipment, schedules, itemTypes, stockRows, lots,
    lastCountedByItem,
    today = new Date(),
    staleDays = STALE_COUNT_DAYS,
    expiryHorizonDays = EXPIRY_HORIZON_DAYS,
  } = input

  const { overdue, dueSoon } = findMaintenanceDue(schedules, equipment, today)
  const lowStock = findLowStock(itemTypes, stockRows)
  const expired = findExpiredLots(lots, today)
  const expiring = getExpiringLots(lots, expiryHorizonDays)

  // Prefer real count dates when the caller supplies them. Override ONLY
  // last_counted_at and carry the view's real quantity through: findStaleCounts
  // ignores quantity, but the rendered row shows it, and a placeholder here
  // reports every stale item as empty. That shipped once in a preview --
  // "Éthanol 96%: 0 boîtes" for an item that was fully stocked.
  const stockByItem = new Map(stockRows.map((r) => [r.item_type_id, r]))
  const staleRows: AlertStockRow[] = lastCountedByItem
    ? itemTypes.map((item) => ({
        item_type_id: item.id,
        quantity: Number(stockByItem.get(item.id)?.quantity ?? 0),
        last_counted_at: lastCountedByItem.get(item.id) ?? null,
      }))
    : stockRows
  const stale = findStaleCounts(itemTypes, staleRows, staleDays, today)

  const total = overdue.length + dueSoon.length + lowStock.length
    + expired.length + expiring.length + stale.length

  return {
    generatedAt: today.toISOString(),
    overdue, dueSoon, lowStock, expired, expiring, stale,
    total,
    isEmpty: total === 0,
    staleDays,
    expiryHorizonDays,
  }
}
