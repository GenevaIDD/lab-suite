import { describe, it, expect } from 'vitest'
import {
  findMaintenanceDue,
  withStock,
  findLowStock,
  findStaleCounts,
  findExpiredLots,
  STALE_COUNT_DAYS,
} from './alerts'
import type { AlertEquipment, AlertSchedule, AlertItemType, AlertStockRow } from './alerts'
import type { Lot } from './lotCalc'

// A fixed "today" throughout, so nothing here depends on the clock.
const TODAY = new Date('2026-09-07T09:00:00Z')

// ── helpers ───────────────────────────────────────────────────

function makeEquipment(overrides: Partial<AlertEquipment> = {}): AlertEquipment {
  return { id: 'eq-1', name: 'Centrifugeuse', ...overrides }
}

function makeSchedule(overrides: Partial<AlertSchedule> = {}): AlertSchedule {
  return {
    id: 'sch-1',
    equipment_id: 'eq-1',
    label: 'Nettoyage du filtre',
    next_due: '2026-09-07',
    lead_days: 60,
    last_alerted_at: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<AlertItemType> = {}): AlertItemType {
  return {
    id: 'item-1',
    name: 'Abaisse-langue',
    unit: 'boîtes',
    min_threshold: 10,
    low_stock_alerted_at: null,
    ...overrides,
  }
}

const stock = (item_type_id: string, quantity: number, last_counted_at: string | null = null): AlertStockRow =>
  ({ item_type_id, quantity, last_counted_at })

function makeLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: 'lot-1',
    item_type_id: 'item-1',
    manufacturer: 'SD Biosensor',
    expiry_date: '2027-01-01',
    lot_number: null,
    quantity_initial: 100,
    quantity_remaining: 100,
    exhausted_at: null,
    ...overrides,
  }
}

// ── findMaintenanceDue ────────────────────────────────────────

describe('findMaintenanceDue', () => {
  const equipment = [makeEquipment()]

  it('returns nothing for no schedules', () => {
    const { overdue, dueSoon } = findMaintenanceDue([], equipment, TODAY)
    expect(overdue).toHaveLength(0)
    expect(dueSoon).toHaveLength(0)
  })

  it('counts a schedule due today as due-soon, not overdue', () => {
    const { overdue, dueSoon } = findMaintenanceDue([makeSchedule({ next_due: '2026-09-07' })], equipment, TODAY)
    expect(overdue).toHaveLength(0)
    expect(dueSoon).toHaveLength(1)
    expect(dueSoon[0].days).toBe(0)
  })

  it('reports overdue days as negative', () => {
    const { overdue } = findMaintenanceDue([makeSchedule({ next_due: '2026-08-28' })], equipment, TODAY)
    expect(overdue).toHaveLength(1)
    expect(overdue[0].days).toBe(-10)
  })

  it('respects each schedule\'s own lead_days', () => {
    const schedules = [
      makeSchedule({ id: 'short', next_due: '2026-10-07', lead_days: 7 }),   // 30 days out, 7-day lead
      makeSchedule({ id: 'long',  next_due: '2026-10-07', lead_days: 60 }),  // same date, 60-day lead
    ]
    const { dueSoon } = findMaintenanceDue(schedules, equipment, TODAY)
    expect(dueSoon.map((d) => d.schedule.id)).toEqual(['long'])
  })

  it('drops schedules whose equipment is missing', () => {
    const orphan = makeSchedule({ equipment_id: 'gone' })
    const { overdue, dueSoon } = findMaintenanceDue([orphan], equipment, TODAY)
    expect(overdue).toHaveLength(0)
    expect(dueSoon).toHaveLength(0)
  })

  it('attaches the right equipment to each schedule', () => {
    const eqs = [makeEquipment({ id: 'a', name: 'Autoclave' }), makeEquipment({ id: 'b', name: 'Congélateur' })]
    const schedules = [makeSchedule({ id: 's-b', equipment_id: 'b', next_due: '2026-08-01' })]
    const { overdue } = findMaintenanceDue(schedules, eqs, TODAY)
    expect(overdue[0].equipment.name).toBe('Congélateur')
  })

  it('sorts overdue least-overdue-first and due-soon nearest-first', () => {
    const schedules = [
      makeSchedule({ id: 'very-late', next_due: '2026-07-07' }),
      makeSchedule({ id: 'late',      next_due: '2026-09-01' }),
      makeSchedule({ id: 'far',       next_due: '2026-10-30' }),
      makeSchedule({ id: 'near',      next_due: '2026-09-10' }),
    ]
    const { overdue, dueSoon } = findMaintenanceDue(schedules, equipment, TODAY)
    expect(overdue.map((o) => o.schedule.id)).toEqual(['very-late', 'late'])
    expect(dueSoon.map((d) => d.schedule.id)).toEqual(['near', 'far'])
  })
})

// ── withStock / findLowStock ──────────────────────────────────

describe('withStock', () => {
  it('treats an item with no stock row as zero rather than dropping it', () => {
    const joined = withStock([makeItem()], [])
    expect(joined).toHaveLength(1)
    expect(joined[0].quantity).toBe(0)
    expect(joined[0].last_counted_at).toBeNull()
  })

  it('coerces a numeric-string quantity from the view', () => {
    const joined = withStock([makeItem()], [{ item_type_id: 'item-1', quantity: '42' as unknown as number, last_counted_at: null }])
    expect(joined[0].quantity).toBe(42)
  })

  it('preserves the caller\'s own fields', () => {
    const rich = { ...makeItem(), category: 'consommables' }
    const joined = withStock([rich], [stock('item-1', 5)])
    expect(joined[0].category).toBe('consommables')
  })
})

describe('findLowStock', () => {
  it('flags an item below its threshold', () => {
    const low = findLowStock([makeItem({ min_threshold: 10 })], [stock('item-1', 9)])
    expect(low).toHaveLength(1)
  })

  it('does not flag an item exactly at its threshold', () => {
    expect(findLowStock([makeItem({ min_threshold: 10 })], [stock('item-1', 10)])).toHaveLength(0)
  })

  it('flags a never-counted item with a positive threshold', () => {
    expect(findLowStock([makeItem({ min_threshold: 10 })], [])).toHaveLength(1)
  })

  it('does not flag an item whose threshold is zero', () => {
    expect(findLowStock([makeItem({ min_threshold: 0 })], [])).toHaveLength(0)
  })

  it('sorts out-of-stock first', () => {
    const items = [
      makeItem({ id: 'a', min_threshold: 10 }),
      makeItem({ id: 'b', min_threshold: 10 }),
      makeItem({ id: 'c', min_threshold: 10 }),
    ]
    const rows = [stock('a', 5), stock('b', 0), stock('c', 2)]
    expect(findLowStock(items, rows).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
})

// ── findStaleCounts ───────────────────────────────────────────

describe('findStaleCounts', () => {
  it('flags an item counted longer ago than the threshold', () => {
    const stale = findStaleCounts([makeItem()], [stock('item-1', 50, '2026-06-01T00:00:00Z')], 60, TODAY)
    expect(stale).toHaveLength(1)
    expect(stale[0].daysSince).toBe(98)
  })

  it('does not flag a recently counted item', () => {
    expect(findStaleCounts([makeItem()], [stock('item-1', 50, '2026-09-01T00:00:00Z')], 60, TODAY)).toHaveLength(0)
  })

  it('flags exactly at the threshold', () => {
    const atThreshold = findStaleCounts([makeItem()], [stock('item-1', 50, '2026-07-09T09:00:00Z')], 60, TODAY)
    expect(atThreshold).toHaveLength(1)
    expect(atThreshold[0].daysSince).toBe(60)
  })

  it('flags a never-counted item with daysSince null', () => {
    const stale = findStaleCounts([makeItem()], [], 60, TODAY)
    expect(stale).toHaveLength(1)
    expect(stale[0].daysSince).toBeNull()
  })

  it('considers items that are not low on stock', () => {
    // 500 units against a threshold of 10 — comfortable, but unverified since March.
    const stale = findStaleCounts([makeItem({ min_threshold: 10 })], [stock('item-1', 500, '2026-03-01T00:00:00Z')], 60, TODAY)
    expect(stale).toHaveLength(1)
  })

  it('sorts never-counted first, then longest-neglected', () => {
    const items = [
      makeItem({ id: 'never' }),
      makeItem({ id: 'old' }),
      makeItem({ id: 'older' }),
    ]
    const rows = [stock('old', 1, '2026-06-01T00:00:00Z'), stock('older', 1, '2026-01-01T00:00:00Z')]
    expect(findStaleCounts(items, rows, 60, TODAY).map((i) => i.id)).toEqual(['never', 'older', 'old'])
  })

  it('defaults to STALE_COUNT_DAYS', () => {
    expect(STALE_COUNT_DAYS).toBe(60)
    const justInside = new Date(TODAY)
    justInside.setDate(justInside.getDate() - (STALE_COUNT_DAYS - 1))
    const rows = [stock('item-1', 1, justInside.toISOString())]
    expect(findStaleCounts([makeItem()], rows, undefined, TODAY)).toHaveLength(0)
  })
})

// ── findExpiredLots ───────────────────────────────────────────

describe('findExpiredLots', () => {
  it('returns empty for no lots', () => {
    expect(findExpiredLots([], TODAY)).toHaveLength(0)
  })

  it('flags a lot past its expiry date', () => {
    expect(findExpiredLots([makeLot({ expiry_date: '2026-09-06' })], TODAY)).toHaveLength(1)
  })

  it('does not flag a lot expiring today', () => {
    expect(findExpiredLots([makeLot({ expiry_date: '2026-09-07' })], TODAY)).toHaveLength(0)
  })

  it('excludes exhausted lots', () => {
    const lot = makeLot({ expiry_date: '2026-01-01', exhausted_at: '2026-02-01T00:00:00Z' })
    expect(findExpiredLots([lot], TODAY)).toHaveLength(0)
  })

  it('excludes lots with nothing left in them', () => {
    // Matches getExpiringLots, which has always excluded these. An empty lot
    // is not a problem to act on, whatever its date says.
    expect(findExpiredLots([makeLot({ expiry_date: '2026-01-01', quantity_remaining: 0 })], TODAY)).toHaveLength(0)
  })

  it('sorts oldest expiry first', () => {
    const lots = [
      makeLot({ id: 'recent', expiry_date: '2026-09-01' }),
      makeLot({ id: 'ancient', expiry_date: '2025-04-01' }),
      makeLot({ id: 'middle', expiry_date: '2026-05-01' }),
    ]
    expect(findExpiredLots(lots, TODAY).map((l) => l.id)).toEqual(['ancient', 'middle', 'recent'])
  })
})
