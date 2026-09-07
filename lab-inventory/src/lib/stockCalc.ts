/**
 * Pure stock calculation functions.
 * Extracted here so they can be unit-tested independently of React components.
 */

export interface CountPoint {
  quantity: number
  counted_at: string  // ISO string or YYYY-MM-DD
}

export interface DeliveryPoint {
  quantity: number
  received_at: string  // ISO string or YYYY-MM-DD
}

export interface DisposalPoint {
  quantity: number
  disposed_at: string  // ISO string or YYYY-MM-DD
}

export interface TimelinePoint {
  date: string
  countQty: number | null
  deliveryQty: number | null
}

export interface BurnPeriod {
  period: string
  label: string
  burnRate: number
  consumed: number
  days: number
}

export interface Anomaly {
  countDate: string
  prevDate: string
  unexplained: number
  deliveriesBetween: number
}

function dayStr(iso: string): string {
  return iso.slice(0, 10)
}

function daysDiff(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000)
}

/** Deliveries received strictly after start and on/before end (YYYY-MM-DD comparison) */
export function deliveriesBetween(
  deliveries: DeliveryPoint[],
  start: string,
  end: string,
): number {
  return deliveries
    .filter(d => dayStr(d.received_at) > start && dayStr(d.received_at) <= end)
    .reduce((sum, d) => sum + d.quantity, 0)
}

/** Disposals recorded strictly after start and on/before end (YYYY-MM-DD comparison) */
export function disposalsBetween(
  disposals: DisposalPoint[],
  start: string,
  end: string,
): number {
  return disposals
    .filter(d => dayStr(d.disposed_at) > start && dayStr(d.disposed_at) <= end)
    .reduce((sum, d) => sum + d.quantity, 0)
}

/**
 * Collapse per-lot counts into item-level points, one per count event.
 *
 * buildTimeline, buildBurnRate and buildAnomalies all treat each CountPoint as
 * the item's whole quantity at that moment. Since
 * supabase/add_stock_count_lot_provenance.sql, a lot-tracked item gets one
 * stock_counts row per lot instead of a single SUM, so feeding them raw would
 * make consecutive "counts" be different lots and the burn rate meaningless.
 *
 * A session counts every lot at once, so its rows share one timestamp and sum
 * straight to the item total. The ad-hoc form counts ONE lot at a time, giving
 * each its own timestamp -- so summing within a timestamp is not enough. We
 * carry a running quantity per lot: at each count event the item's total is
 * that lot's new value plus the last known value of every other lot.
 *
 * An item-level row (lot_id null) is already a total, so it is emitted as-is
 * and clears the running map -- that covers non-tracked items and the legacy
 * aggregates written before per-lot counting.
 *
 * Known limit: a lot discarded via useDiscardLot writes no count row, so it
 * stays in the map at its last counted value until the next count touches it.
 * Disposals reach the burn rate separately, through disposalsBetween.
 */
export function rollUpCounts<
  T extends CountPoint & { lot_id?: string | null; created_at?: string },
>(counts: T[]): CountPoint[] {
  // Several sessions completing on one target_date is normal here (a campaign
  // split across rooms, or a repeated session), and they all write the same
  // midnight-UTC counted_at. created_at breaks the tie, matching how
  // current_stock's latest_item_count orders: the row entered last wins.
  const ordered = [...counts].sort((a, b) =>
    a.counted_at.localeCompare(b.counted_at)
    || (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )

  const groups: { counted_at: string; rows: T[] }[] = []
  for (const c of ordered) {
    const last = groups[groups.length - 1]
    if (last && last.counted_at === c.counted_at) last.rows.push(c)
    else groups.push({ counted_at: c.counted_at, rows: [c] })
  }

  const lotQty = new Map<string, number>()
  const points: CountPoint[] = []

  for (const { counted_at, rows } of groups) {
    const lotRows = rows.filter(r => r.lot_id)
    if (lotRows.length > 0) {
      for (const r of lotRows) lotQty.set(r.lot_id as string, r.quantity)
      let total = 0
      for (const q of lotQty.values()) total += q
      points.push({ counted_at, quantity: total })
    } else {
      // Last row wins, matching current_stock's (counted_at, created_at) tie-break.
      lotQty.clear()
      points.push({ counted_at, quantity: rows[rows.length - 1].quantity })
    }
  }

  return points
}

/** Merge counts + deliveries into a single sorted timeline for the stock chart */
export function buildTimeline(
  counts: CountPoint[],
  deliveries: DeliveryPoint[],
): TimelinePoint[] {
  const map = new Map<string, TimelinePoint>()

  for (const c of counts) {
    const d = dayStr(c.counted_at)
    const prev = map.get(d) ?? { date: d, countQty: null, deliveryQty: null }
    map.set(d, { ...prev, countQty: c.quantity })
  }
  for (const dv of deliveries) {
    const d = dayStr(dv.received_at)
    const prev = map.get(d) ?? { date: d, countQty: null, deliveryQty: null }
    map.set(d, { ...prev, deliveryQty: (prev.deliveryQty ?? 0) + dv.quantity })
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Compute burn rate per period between consecutive stock counts.
 * A burn rate of 0 is returned for anomalous periods where stock increased
 * more than deliveries can explain.
 */
export function buildBurnRate(
  counts: CountPoint[],
  deliveries: DeliveryPoint[],
  disposals: DisposalPoint[] = [],
  fmtShort: (d: string) => string = (d) => d.slice(0, 7),
  fmtLong:  (d: string) => string = (d) => d.slice(0, 10),
): BurnPeriod[] {
  if (counts.length < 2) return []
  const periods: BurnPeriod[] = []

  for (let i = 1; i < counts.length; i++) {
    const prev  = counts[i - 1]
    const curr  = counts[i]
    const start = dayStr(prev.counted_at)
    const end   = dayStr(curr.counted_at)
    const days  = daysDiff(end, start)
    if (days <= 0) continue

    const between  = deliveriesBetween(deliveries, start, end)
    // Disposed stock is an explained reduction — not consumption.
    const disposed = disposalsBetween(disposals, start, end)
    const rawConsumed = prev.quantity + between - disposed - curr.quantity
    const consumed = Math.max(0, rawConsumed)
    const rate = Math.round((consumed / days) * 100) / 100

    periods.push({
      period: `${fmtShort(start)} – ${fmtShort(end)}`,
      label:  `${fmtLong(start)} → ${fmtLong(end)}`,
      burnRate: rate,
      consumed,
      days,
    })
  }
  return periods
}

/**
 * Find periods where stock increased more than deliveries can explain.
 * Returns one Anomaly per anomalous count.
 */
export function buildAnomalies(
  counts: CountPoint[],
  deliveries: DeliveryPoint[],
  disposals: DisposalPoint[] = [],
): Anomaly[] {
  if (counts.length < 2) return []
  const anomalies: Anomaly[] = []

  for (let i = 1; i < counts.length; i++) {
    const prev  = counts[i - 1]
    const curr  = counts[i]
    const start = dayStr(prev.counted_at)
    const end   = dayStr(curr.counted_at)

    const between     = deliveriesBetween(deliveries, start, end)
    const disposed    = disposalsBetween(disposals, start, end)
    const rawConsumed = prev.quantity + between - disposed - curr.quantity

    if (rawConsumed < 0) {
      anomalies.push({
        countDate: end,
        prevDate:  start,
        unexplained: Math.abs(rawConsumed),
        deliveriesBetween: between,
      })
    }
  }
  return anomalies
}
