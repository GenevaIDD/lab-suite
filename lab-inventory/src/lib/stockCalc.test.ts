import { describe, it, expect } from 'vitest'
import {
  buildTimeline,
  buildBurnRate,
  buildAnomalies,
  deliveriesBetween,
  rollUpCounts,
} from './stockCalc'

// ── helpers ───────────────────────────────────────────────────
const count = (qty: number, date: string) => ({ quantity: qty, counted_at: date })
const delivery = (qty: number, date: string) => ({ quantity: qty, received_at: date })
const disposal = (qty: number, date: string) => ({ quantity: qty, disposed_at: date })

describe('deliveriesBetween', () => {
  it('sums deliveries strictly after start and on/before end', () => {
    const ds = [
      delivery(100, '2026-01-10'),
      delivery(50,  '2026-01-15'),
      delivery(25,  '2026-01-20'),
    ]
    expect(deliveriesBetween(ds, '2026-01-10', '2026-01-20')).toBe(75) // 50 + 25
  })

  it('excludes delivery on start date', () => {
    const ds = [delivery(100, '2026-01-01')]
    expect(deliveriesBetween(ds, '2026-01-01', '2026-02-01')).toBe(0)
  })

  it('includes delivery on end date', () => {
    const ds = [delivery(100, '2026-02-01')]
    expect(deliveriesBetween(ds, '2026-01-01', '2026-02-01')).toBe(100)
  })

  it('returns 0 for empty deliveries', () => {
    expect(deliveriesBetween([], '2026-01-01', '2026-02-01')).toBe(0)
  })
})

describe('buildTimeline', () => {
  it('returns empty for no data', () => {
    expect(buildTimeline([], [])).toEqual([])
  })

  it('creates one point per count date', () => {
    const result = buildTimeline([count(100, '2026-01-01')], [])
    expect(result).toHaveLength(1)
    expect(result[0].countQty).toBe(100)
    expect(result[0].deliveryQty).toBeNull()
  })

  it('merges delivery and count on same day', () => {
    const result = buildTimeline(
      [count(80, '2026-01-15')],
      [delivery(20, '2026-01-15')],
    )
    expect(result).toHaveLength(1)
    expect(result[0].countQty).toBe(80)
    expect(result[0].deliveryQty).toBe(20)
  })

  it('accumulates multiple deliveries on same day', () => {
    const result = buildTimeline([], [
      delivery(30, '2026-02-01'),
      delivery(20, '2026-02-01'),
    ])
    expect(result[0].deliveryQty).toBe(50)
  })

  it('sorts by date ascending', () => {
    const result = buildTimeline([
      count(50, '2026-03-01'),
      count(80, '2026-01-01'),
    ], [])
    expect(result[0].date).toBe('2026-01-01')
    expect(result[1].date).toBe('2026-03-01')
  })
})

describe('buildBurnRate', () => {
  it('returns empty for fewer than 2 counts', () => {
    expect(buildBurnRate([], [])).toEqual([])
    expect(buildBurnRate([count(100, '2026-01-01')], [])).toEqual([])
  })

  it('computes basic burn rate correctly', () => {
    // 100 → 50 over 10 days, no deliveries = 5/day
    const result = buildBurnRate(
      [count(100, '2026-01-01'), count(50, '2026-01-11')],
      [],
    )
    expect(result).toHaveLength(1)
    expect(result[0].burnRate).toBe(5)
    expect(result[0].consumed).toBe(50)
    expect(result[0].days).toBe(10)
  })

  it('accounts for deliveries between counts', () => {
    // 100 + 40 delivery = 140 available, 60 remaining → 80 consumed over 20 days = 4/day
    const result = buildBurnRate(
      [count(100, '2026-01-01'), count(60, '2026-01-21')],
      [delivery(40, '2026-01-10')],
    )
    expect(result[0].consumed).toBe(80)
    expect(result[0].burnRate).toBe(4)
  })

  it('returns 0 burnRate when stock increases (anomalous, not negative)', () => {
    // stock increased: 50 → 100 with no delivery → consumed = max(0, -50) = 0
    const result = buildBurnRate(
      [count(50, '2026-01-01'), count(100, '2026-01-11')],
      [],
    )
    expect(result[0].consumed).toBe(0)
    expect(result[0].burnRate).toBe(0)
  })

  it('skips period when date difference is 0 or negative', () => {
    const result = buildBurnRate(
      [count(100, '2026-01-05'), count(80, '2026-01-05')], // same day
      [],
    )
    expect(result).toHaveLength(0)
  })

  it('handles multiple periods correctly', () => {
    const result = buildBurnRate(
      [
        count(300, '2026-01-01'),
        count(200, '2026-02-01'),  // 31 days, consumed 100
        count(100, '2026-03-01'),  // 28 days, consumed 100
      ],
      [],
    )
    expect(result).toHaveLength(2)
    expect(result[0].consumed).toBe(100)
    expect(result[1].consumed).toBe(100)
  })

  it('uses provided format functions', () => {
    const result = buildBurnRate(
      [count(100, '2026-01-01'), count(50, '2026-02-01')],
      [],
      [],
      d => `short:${d}`,
      d => `long:${d}`,
    )
    expect(result[0].period).toBe('short:2026-01-01 – short:2026-02-01')
    expect(result[0].label).toBe('long:2026-01-01 → long:2026-02-01')
  })

  it('excludes disposed stock from consumption', () => {
    // 100 → 40 over 10 days, but 30 were disposed (destroyed, not used).
    // True consumption = 100 - 30 - 40 = 30, over 10 days = 3/day.
    const result = buildBurnRate(
      [count(100, '2026-01-01'), count(40, '2026-01-11')],
      [],
      [disposal(30, '2026-01-05')],
    )
    expect(result[0].consumed).toBe(30)
    expect(result[0].burnRate).toBe(3)
  })

  it('ignores disposals outside the period', () => {
    const result = buildBurnRate(
      [count(100, '2026-01-01'), count(40, '2026-01-11')],
      [],
      [disposal(30, '2026-02-20')], // after the period
    )
    expect(result[0].consumed).toBe(60) // disposal not counted, full drop is "consumed"
  })
})

describe('buildAnomalies', () => {
  it('returns empty for fewer than 2 counts', () => {
    expect(buildAnomalies([], [])).toEqual([])
    expect(buildAnomalies([count(100, '2026-01-01')], [])).toEqual([])
  })

  it('returns empty for normal consumption', () => {
    const result = buildAnomalies(
      [count(100, '2026-01-01'), count(50, '2026-01-11')],
      [],
    )
    expect(result).toHaveLength(0)
  })

  it('returns empty when stock is stable', () => {
    const result = buildAnomalies(
      [count(100, '2026-01-01'), count(100, '2026-01-11')],
      [],
    )
    expect(result).toHaveLength(0)
  })

  it('detects unexplained increase with no deliveries', () => {
    // 50 → 100 with no delivery
    const result = buildAnomalies(
      [count(50, '2026-01-01'), count(100, '2026-01-11')],
      [],
    )
    expect(result).toHaveLength(1)
    expect(result[0].unexplained).toBe(50)
    expect(result[0].deliveriesBetween).toBe(0)
    expect(result[0].countDate).toBe('2026-01-11')
    expect(result[0].prevDate).toBe('2026-01-01')
  })

  it('detects anomaly when increase exceeds delivery', () => {
    // 100 + 20 delivery = 120 expected, but counted 150 → unexplained 30
    const result = buildAnomalies(
      [count(100, '2026-01-01'), count(150, '2026-01-11')],
      [delivery(20, '2026-01-05')],
    )
    expect(result).toHaveLength(1)
    expect(result[0].unexplained).toBe(30)
    expect(result[0].deliveriesBetween).toBe(20)
  })

  it('returns no anomaly when delivery explains increase', () => {
    // 100 + 60 delivery, counted 155 → consumed 5 → no anomaly
    const result = buildAnomalies(
      [count(100, '2026-01-01'), count(155, '2026-01-11')],
      [delivery(60, '2026-01-05')],
    )
    expect(result).toHaveLength(0)
  })

  it('detects multiple anomalies across periods', () => {
    const result = buildAnomalies(
      [
        count(100, '2026-01-01'),
        count(200, '2026-02-01'),  // anomaly +100
        count(150, '2026-03-01'),  // normal -50
        count(250, '2026-04-01'),  // anomaly +100
      ],
      [],
    )
    expect(result).toHaveLength(2)
    expect(result[0].unexplained).toBe(100)
    expect(result[1].unexplained).toBe(100)
  })
})


// ── rollUpCounts ──────────────────────────────────────────────
// Per-lot counts (add_stock_count_lot_provenance.sql) must collapse into one
// item-level point per count event before the chart builders see them --
// otherwise consecutive "counts" are different lots and the burn rate is junk.
const lotCount = (qty: number, date: string, lot: string | null) =>
  ({ quantity: qty, counted_at: date, lot_id: lot })

describe('rollUpCounts', () => {
  it('sums the lot rows sharing one count timestamp', () => {
    const rolled = rollUpCounts([
      lotCount(10, '2026-01-10T00:00:00Z', 'lot-a'),
      lotCount(5,  '2026-01-10T00:00:00Z', 'lot-b'),
      lotCount(2,  '2026-01-10T00:00:00Z', 'lot-c'),
    ])
    expect(rolled).toEqual([{ counted_at: '2026-01-10T00:00:00Z', quantity: 17 }])
  })

  it('keeps separate count events separate, in date order', () => {
    const rolled = rollUpCounts([
      lotCount(4, '2026-02-01T00:00:00Z', 'lot-a'),
      lotCount(9, '2026-01-01T00:00:00Z', 'lot-a'),
      lotCount(1, '2026-01-01T00:00:00Z', 'lot-b'),
    ])
    expect(rolled).toEqual([
      { counted_at: '2026-01-01T00:00:00Z', quantity: 10 },
      // lot-b was not recounted in February, so its 1 still counts toward the
      // item's total -- 5, not lot-a's 4 on its own.
      { counted_at: '2026-02-01T00:00:00Z', quantity: 5 },
    ])
  })

  it('passes item-level counts through untouched', () => {
    const rolled = rollUpCounts([
      lotCount(30, '2026-01-10', null),
      lotCount(20, '2026-02-10', null),
    ])
    expect(rolled).toEqual([
      { counted_at: '2026-01-10', quantity: 30 },
      { counted_at: '2026-02-10', quantity: 20 },
    ])
  })

  it('takes the last item-level row when one timestamp has several', () => {
    // Matches current_stock's (counted_at desc, created_at desc) tie-break.
    const rolled = rollUpCounts([
      lotCount(30, '2026-01-10', null),
      lotCount(42, '2026-01-10', null),
    ])
    expect(rolled).toEqual([{ counted_at: '2026-01-10', quantity: 42 }])
  })

  it('prefers the per-lot sum over a legacy aggregate at the same timestamp', () => {
    const rolled = rollUpCounts([
      lotCount(99, '2026-01-10T00:00:00Z', null),     // legacy SUM row
      lotCount(10, '2026-01-10T00:00:00Z', 'lot-a'),
      lotCount(5,  '2026-01-10T00:00:00Z', 'lot-b'),
    ])
    expect(rolled).toEqual([{ counted_at: '2026-01-10T00:00:00Z', quantity: 15 }])
  })

  it('carries other lots forward when one lot is counted alone', () => {
    // The ad-hoc form counts ONE lot per submission, so each row gets its own
    // timestamp. Each point must still be the item's total, not that lot's.
    const rolled = rollUpCounts([
      lotCount(10, '2026-01-01T00:00:00Z', 'lot-a'),
      lotCount(5,  '2026-01-01T00:00:00Z', 'lot-b'),
      lotCount(4,  '2026-03-02T09:00:00Z', 'lot-a'),   // only lot-a recounted
    ])
    expect(rolled).toEqual([
      { counted_at: '2026-01-01T00:00:00Z', quantity: 15 },
      { counted_at: '2026-03-02T09:00:00Z', quantity: 9 },  // 4 + lot-b's 5
    ])
  })

  it('does not let a single-lot recount look like a collapse in stock', () => {
    // Regression: grouping by timestamp alone made this emit 4, implying the
    // item fell 15 -> 4 and inventing a burn rate out of nothing.
    const rolled = rollUpCounts([
      lotCount(10, '2026-01-01T00:00:00Z', 'lot-a'),
      lotCount(5,  '2026-01-01T00:00:00Z', 'lot-b'),
      lotCount(4,  '2026-03-02T09:00:00Z', 'lot-a'),
    ])
    const burn = buildBurnRate(rolled, [], [])
    expect(burn).toHaveLength(1)
    expect(burn[0].consumed).toBe(6)   // 15 -> 9, not 15 -> 4
  })

  it('lets an item-level total supersede earlier per-lot knowledge', () => {
    const rolled = rollUpCounts([
      lotCount(10, '2026-01-01T00:00:00Z', 'lot-a'),
      lotCount(5,  '2026-01-01T00:00:00Z', 'lot-b'),
      lotCount(7,  '2026-02-01T00:00:00Z', null),      // legacy aggregate
      lotCount(3,  '2026-03-01T00:00:00Z', 'lot-a'),   // map was cleared
    ])
    expect(rolled).toEqual([
      { counted_at: '2026-01-01T00:00:00Z', quantity: 15 },
      { counted_at: '2026-02-01T00:00:00Z', quantity: 7 },
      { counted_at: '2026-03-01T00:00:00Z', quantity: 3 },
    ])
  })

  it('orders unsorted input by timestamp before carrying values forward', () => {
    const rolled = rollUpCounts([
      lotCount(4,  '2026-03-02T09:00:00Z', 'lot-a'),
      lotCount(5,  '2026-01-01T00:00:00Z', 'lot-b'),
      lotCount(10, '2026-01-01T00:00:00Z', 'lot-a'),
    ])
    expect(rolled).toEqual([
      { counted_at: '2026-01-01T00:00:00Z', quantity: 15 },
      { counted_at: '2026-03-02T09:00:00Z', quantity: 9 },
    ])
  })

  it('returns nothing for no counts', () => {
    expect(rollUpCounts([])).toEqual([])
  })

  it('breaks a same-timestamp tie on created_at, like current_stock does', () => {
    // Several sessions completing on one target_date is normal in this lab
    // (5 on 2026-08-12 in the real data), and they share a counted_at.
    const rolled = rollUpCounts([
      { quantity: 30, counted_at: '2026-08-12T00:00:00Z', lot_id: null, created_at: '2026-08-12T09:00:00Z' },
      { quantity: 42, counted_at: '2026-08-12T00:00:00Z', lot_id: null, created_at: '2026-08-12T17:00:00Z' },
    ])
    expect(rolled).toEqual([{ counted_at: '2026-08-12T00:00:00Z', quantity: 42 }])
  })

  it('does not depend on the order rows arrive in', () => {
    const rows = [
      { quantity: 42, counted_at: '2026-08-12T00:00:00Z', lot_id: null, created_at: '2026-08-12T17:00:00Z' },
      { quantity: 30, counted_at: '2026-08-12T00:00:00Z', lot_id: null, created_at: '2026-08-12T09:00:00Z' },
    ]
    expect(rollUpCounts(rows)).toEqual(rollUpCounts([...rows].reverse()))
  })

  it('takes each lot\'s newest value when two same-day sessions counted it', () => {
    const rolled = rollUpCounts([
      { quantity: 10, counted_at: '2026-08-12T00:00:00Z', lot_id: 'lot-a', created_at: '2026-08-12T09:00:00Z' },
      { quantity: 6,  counted_at: '2026-08-12T00:00:00Z', lot_id: 'lot-a', created_at: '2026-08-12T17:00:00Z' },
      { quantity: 5,  counted_at: '2026-08-12T00:00:00Z', lot_id: 'lot-b', created_at: '2026-08-12T09:30:00Z' },
    ])
    expect(rolled).toEqual([{ counted_at: '2026-08-12T00:00:00Z', quantity: 11 }])  // 6 + 5, not 10 + 5
  })

  it('makes a lot-tracked burn rate match the equivalent item-level one', () => {
    const perLot = rollUpCounts([
      lotCount(60, '2026-01-01', 'lot-a'),
      lotCount(40, '2026-01-01', 'lot-b'),
      lotCount(30, '2026-01-31', 'lot-a'),
      lotCount(20, '2026-01-31', 'lot-b'),
    ])
    const itemLevel = [count(100, '2026-01-01'), count(50, '2026-01-31')]
    expect(buildBurnRate(perLot, [], [])).toEqual(buildBurnRate(itemLevel, [], []))
  })
})
