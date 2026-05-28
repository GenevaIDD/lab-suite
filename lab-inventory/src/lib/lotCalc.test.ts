import { describe, it, expect } from 'vitest'
import {
  sumActiveLots,
  isLotStockLow,
  lotKey,
  isSameLot,
  shouldExhaustLot,
  applyCountToLot,
  buildSessionEntries,
  getExpiringLots,
} from './lotCalc'
import type { Lot } from './lotCalc'

// ── Test helpers ──────────────────────────────────────────────

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

// ── sumActiveLots ─────────────────────────────────────────────

describe('sumActiveLots', () => {
  it('returns 0 for empty array', () => {
    expect(sumActiveLots([])).toBe(0)
  })

  it('sums a single active lot', () => {
    expect(sumActiveLots([makeLot({ quantity_remaining: 80 })])).toBe(80)
  })

  it('sums multiple active lots', () => {
    expect(sumActiveLots([
      makeLot({ id: 'a', quantity_remaining: 100 }),
      makeLot({ id: 'b', quantity_remaining: 10 }),
    ])).toBe(110)
  })

  it('excludes exhausted lots', () => {
    expect(sumActiveLots([
      makeLot({ id: 'a', quantity_remaining: 100 }),
      makeLot({ id: 'b', quantity_remaining: 0, exhausted_at: '2026-01-01T00:00:00Z' }),
    ])).toBe(100)
  })

  it('returns 0 when all lots are exhausted', () => {
    expect(sumActiveLots([
      makeLot({ exhausted_at: '2026-01-01T00:00:00Z', quantity_remaining: 0 }),
      makeLot({ id: 'b', exhausted_at: '2026-01-01T00:00:00Z', quantity_remaining: 0 }),
    ])).toBe(0)
  })

  it('includes lots with quantity_remaining > 0 even if exhausted_at is non-null', () => {
    // exhausted_at is the authoritative field — if set, exclude regardless of qty
    expect(sumActiveLots([
      makeLot({ quantity_remaining: 50, exhausted_at: '2026-01-01T00:00:00Z' }),
    ])).toBe(0)
  })
})

// ── isLotStockLow ─────────────────────────────────────────────

describe('isLotStockLow', () => {
  it('returns true when combined total is below threshold', () => {
    expect(isLotStockLow([makeLot({ quantity_remaining: 30 })], 50)).toBe(true)
  })

  it('returns false when combined total equals threshold', () => {
    expect(isLotStockLow([makeLot({ quantity_remaining: 50 })], 50)).toBe(false)
  })

  it('returns false when combined total is above threshold', () => {
    expect(isLotStockLow([makeLot({ quantity_remaining: 80 })], 50)).toBe(false)
  })

  it('uses combined total across multiple lots vs single threshold', () => {
    const lots = [
      makeLot({ id: 'a', quantity_remaining: 20 }),
      makeLot({ id: 'b', quantity_remaining: 20 }),
    ]
    // Combined = 40, threshold = 50 → low
    expect(isLotStockLow(lots, 50)).toBe(true)
    // Combined = 40, threshold = 30 → not low
    expect(isLotStockLow(lots, 30)).toBe(false)
  })

  it('excludes exhausted lots from the total', () => {
    const lots = [
      makeLot({ id: 'a', quantity_remaining: 100, exhausted_at: '2026-01-01T00:00:00Z' }),
      makeLot({ id: 'b', quantity_remaining: 5 }),
    ]
    // Active total = 5, threshold = 10 → low (ignores exhausted 100)
    expect(isLotStockLow(lots, 10)).toBe(true)
  })

  it('returns true (low) when no active lots', () => {
    expect(isLotStockLow([], 10)).toBe(true)
  })
})

// ── lotKey ────────────────────────────────────────────────────

describe('lotKey', () => {
  it('produces consistent keys for same inputs', () => {
    expect(lotKey('SD Biosensor', '2026-03-10')).toBe(lotKey('SD Biosensor', '2026-03-10'))
  })

  it('is case-insensitive for manufacturer', () => {
    expect(lotKey('SD Biosensor', '2026-03-10')).toBe(lotKey('sd biosensor', '2026-03-10'))
  })

  it('treats null and empty lot number the same', () => {
    expect(lotKey('Oxoid', '2027-06-01', null)).toBe(lotKey('Oxoid', '2027-06-01', ''))
  })

  it('distinguishes different manufacturers', () => {
    expect(lotKey('SD Biosensor', '2026-03-10')).not.toBe(lotKey('Abbott', '2026-03-10'))
  })

  it('distinguishes different expiry dates', () => {
    expect(lotKey('SD Biosensor', '2026-03-10')).not.toBe(lotKey('SD Biosensor', '2027-01-15'))
  })

  it('distinguishes different lot numbers', () => {
    expect(lotKey('Oxoid', '2027-06-01', 'ABC')).not.toBe(lotKey('Oxoid', '2027-06-01', 'XYZ'))
  })

  it('is case-insensitive for lot number', () => {
    expect(lotKey('Oxoid', '2027-06-01', 'abc123')).toBe(lotKey('Oxoid', '2027-06-01', 'ABC123'))
  })

  it('trims whitespace from manufacturer', () => {
    expect(lotKey('  SD Biosensor  ', '2026-03-10')).toBe(lotKey('SD Biosensor', '2026-03-10'))
  })
})

// ── isSameLot ─────────────────────────────────────────────────

describe('isSameLot', () => {
  it('matches identical lots', () => {
    expect(isSameLot(
      { manufacturer: 'SD', expiry_date: '2026-03-10', lot_number: 'A1', quantity: 100 },
      { manufacturer: 'SD', expiry_date: '2026-03-10', lot_number: 'A1', quantity: 50 },
    )).toBe(true)
  })

  it('matches lots with no lot number', () => {
    expect(isSameLot(
      { manufacturer: 'SD', expiry_date: '2026-03-10', quantity: 100 },
      { manufacturer: 'SD', expiry_date: '2026-03-10', quantity: 50 },
    )).toBe(true)
  })

  it('does not match different manufacturers', () => {
    expect(isSameLot(
      { manufacturer: 'SD', expiry_date: '2026-03-10', quantity: 100 },
      { manufacturer: 'Abbott', expiry_date: '2026-03-10', quantity: 100 },
    )).toBe(false)
  })

  it('does not match different expiry dates', () => {
    expect(isSameLot(
      { manufacturer: 'SD', expiry_date: '2026-03-10', quantity: 100 },
      { manufacturer: 'SD', expiry_date: '2027-01-01', quantity: 100 },
    )).toBe(false)
  })

  it('does not match different lot numbers', () => {
    expect(isSameLot(
      { manufacturer: 'SD', expiry_date: '2026-03-10', lot_number: 'A1', quantity: 100 },
      { manufacturer: 'SD', expiry_date: '2026-03-10', lot_number: 'B2', quantity: 100 },
    )).toBe(false)
  })

  it('one with lot number, one without — not the same', () => {
    expect(isSameLot(
      { manufacturer: 'SD', expiry_date: '2026-03-10', lot_number: 'A1', quantity: 100 },
      { manufacturer: 'SD', expiry_date: '2026-03-10', quantity: 100 },
    )).toBe(false)
  })
})

// ── shouldExhaustLot ──────────────────────────────────────────

describe('shouldExhaustLot', () => {
  it('returns true for zero', () => expect(shouldExhaustLot(0)).toBe(true))
  it('returns false for positive quantity', () => expect(shouldExhaustLot(1)).toBe(false))
  it('returns false for large quantity', () => expect(shouldExhaustLot(500)).toBe(false))
})

// ── applyCountToLot ───────────────────────────────────────────

describe('applyCountToLot', () => {
  it('updates quantity_remaining to counted value', () => {
    const result = applyCountToLot(makeLot({ quantity_remaining: 100 }), 75)
    expect(result.quantity_remaining).toBe(75)
    expect(result.exhausted).toBe(false)
  })

  it('marks as exhausted when count is zero', () => {
    const result = applyCountToLot(makeLot({ quantity_remaining: 50 }), 0)
    expect(result.quantity_remaining).toBe(0)
    expect(result.exhausted).toBe(true)
  })

  it('handles count higher than previous — no anomaly flag here (that is stockCalc)', () => {
    const result = applyCountToLot(makeLot({ quantity_remaining: 50 }), 80)
    expect(result.quantity_remaining).toBe(80)
    expect(result.exhausted).toBe(false)
  })
})

// ── buildSessionEntries ───────────────────────────────────────

describe('buildSessionEntries', () => {
  const nonTrackedItem = { id: 'item-gloves', category: 'EEP', name: 'Gants nitrile', track_lots: false }
  const trackedItem = { id: 'item-tdrs', category: 'Surveillance clinique', name: 'TDRs Crystal VC', track_lots: true }

  it('creates one entry per non-tracked item', () => {
    const entries = buildSessionEntries([nonTrackedItem], new Map())
    expect(entries).toHaveLength(1)
    expect(entries[0].lot_id).toBeNull()
    expect(entries[0].item_type_id).toBe('item-gloves')
  })

  it('creates one entry per active lot for tracked items', () => {
    const lots = [
      makeLot({ id: 'lot-a', item_type_id: 'item-tdrs', expiry_date: '2026-03-10' }),
      makeLot({ id: 'lot-b', item_type_id: 'item-tdrs', expiry_date: '2027-01-15' }),
    ]
    const map = new Map([['item-tdrs', lots]])
    const entries = buildSessionEntries([trackedItem], map)
    expect(entries).toHaveLength(2)
    expect(entries.every(e => e.item_type_id === 'item-tdrs')).toBe(true)
    expect(entries.map(e => e.lot_id)).toEqual(['lot-a', 'lot-b'])
  })

  it('sorts lot entries by expiry date ascending (soonest first)', () => {
    const lots = [
      makeLot({ id: 'late', item_type_id: 'item-tdrs', expiry_date: '2027-06-01' }),
      makeLot({ id: 'soon', item_type_id: 'item-tdrs', expiry_date: '2026-03-10' }),
    ]
    const entries = buildSessionEntries([trackedItem], new Map([['item-tdrs', lots]]))
    expect(entries[0].lot_id).toBe('soon')
    expect(entries[1].lot_id).toBe('late')
  })

  it('excludes exhausted lots — they never appear in sessions', () => {
    const lots = [
      makeLot({ id: 'active', item_type_id: 'item-tdrs', expiry_date: '2027-01-01' }),
      makeLot({ id: 'dead', item_type_id: 'item-tdrs', expiry_date: '2026-03-10', exhausted_at: '2026-03-15T00:00:00Z' }),
    ]
    // Only pass active lots to buildSessionEntries
    const activeLots = lots.filter(l => l.exhausted_at === null)
    const entries = buildSessionEntries([trackedItem], new Map([['item-tdrs', activeLots]]))
    expect(entries).toHaveLength(1)
    expect(entries[0].lot_id).toBe('active')
  })

  it('adds a placeholder entry for tracked item with no active lots', () => {
    // Item is tracked but all lots exhausted — still show it so user can note
    const entries = buildSessionEntries([trackedItem], new Map([['item-tdrs', []]]))
    expect(entries).toHaveLength(1)
    expect(entries[0].item_type_id).toBe('item-tdrs')
    expect(entries[0].lot_id).toBeNull()
  })

  it('assigns sequential sort_order across all entries', () => {
    const lots = [
      makeLot({ id: 'lot-a', item_type_id: 'item-tdrs', expiry_date: '2027-01-01' }),
    ]
    const entries = buildSessionEntries(
      [nonTrackedItem, trackedItem],
      new Map([['item-tdrs', lots]]),
    )
    expect(entries.map(e => e.sort_order)).toEqual([0, 1])
  })

  it('preserves item order (non-tracked and tracked can be mixed)', () => {
    const lots = [makeLot({ id: 'lot-a', item_type_id: 'item-tdrs', expiry_date: '2027-01-01' })]
    const entries = buildSessionEntries(
      [nonTrackedItem, trackedItem],
      new Map([['item-tdrs', lots]]),
    )
    expect(entries[0].item_type_id).toBe('item-gloves')
    expect(entries[1].item_type_id).toBe('item-tdrs')
  })

  it('returns empty for empty item list', () => {
    expect(buildSessionEntries([], new Map())).toHaveLength(0)
  })
})

// ── getExpiringLots ───────────────────────────────────────────

describe('getExpiringLots', () => {
  // Use a fixed reference date via overrideable today calculation
  // We test relative to actual today, so use offsets

  function daysFromNow(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  it('returns empty for no lots', () => {
    expect(getExpiringLots([], 30)).toHaveLength(0)
  })

  it('returns lots expiring within threshold', () => {
    const lots = [makeLot({ expiry_date: daysFromNow(20) })]
    expect(getExpiringLots(lots, 30)).toHaveLength(1)
  })

  it('excludes lots expiring after threshold', () => {
    const lots = [makeLot({ expiry_date: daysFromNow(45) })]
    expect(getExpiringLots(lots, 30)).toHaveLength(0)
  })

  it('excludes exhausted lots', () => {
    const lots = [makeLot({ expiry_date: daysFromNow(10), exhausted_at: '2026-01-01T00:00:00Z' })]
    expect(getExpiringLots(lots, 30)).toHaveLength(0)
  })

  it('excludes lots with zero quantity_remaining', () => {
    const lots = [makeLot({ expiry_date: daysFromNow(10), quantity_remaining: 0 })]
    expect(getExpiringLots(lots, 30)).toHaveLength(0)
  })

  it('sorts by expiry date ascending (soonest first)', () => {
    const lots = [
      makeLot({ id: 'b', expiry_date: daysFromNow(25) }),
      makeLot({ id: 'a', expiry_date: daysFromNow(5) }),
    ]
    const result = getExpiringLots(lots, 30)
    expect(result[0].id).toBe('a')
    expect(result[1].id).toBe('b')
  })

  it('includes lot expiring exactly on threshold day', () => {
    const lots = [makeLot({ expiry_date: daysFromNow(30) })]
    expect(getExpiringLots(lots, 30)).toHaveLength(1)
  })

  it('returns multiple expiring lots across different items', () => {
    const lots = [
      makeLot({ id: 'a', item_type_id: 'item-1', expiry_date: daysFromNow(10) }),
      makeLot({ id: 'b', item_type_id: 'item-2', expiry_date: daysFromNow(20) }),
      makeLot({ id: 'c', item_type_id: 'item-3', expiry_date: daysFromNow(60) }), // excluded
    ]
    const result = getExpiringLots(lots, 30)
    expect(result).toHaveLength(2)
    expect(result.map(l => l.id)).toEqual(['a', 'b'])
  })
})
