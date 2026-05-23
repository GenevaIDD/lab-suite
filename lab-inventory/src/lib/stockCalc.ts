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
    const rawConsumed = prev.quantity + between - curr.quantity
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
): Anomaly[] {
  if (counts.length < 2) return []
  const anomalies: Anomaly[] = []

  for (let i = 1; i < counts.length; i++) {
    const prev  = counts[i - 1]
    const curr  = counts[i]
    const start = dayStr(prev.counted_at)
    const end   = dayStr(curr.counted_at)

    const between     = deliveriesBetween(deliveries, start, end)
    const rawConsumed = prev.quantity + between - curr.quantity

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
