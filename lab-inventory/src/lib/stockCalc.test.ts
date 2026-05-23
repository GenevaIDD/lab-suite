import { describe, it, expect } from 'vitest'
import {
  buildTimeline,
  buildBurnRate,
  buildAnomalies,
  deliveriesBetween,
} from './stockCalc'

// ── helpers ───────────────────────────────────────────────────
const count = (qty: number, date: string) => ({ quantity: qty, counted_at: date })
const delivery = (qty: number, date: string) => ({ quantity: qty, received_at: date })

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
      d => `short:${d}`,
      d => `long:${d}`,
    )
    expect(result[0].period).toBe('short:2026-01-01 – short:2026-02-01')
    expect(result[0].label).toBe('long:2026-01-01 → long:2026-02-01')
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
