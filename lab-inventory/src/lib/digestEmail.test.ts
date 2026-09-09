import { describe, it, expect } from 'vitest'
import { renderDigestEmail, buildSections, DEFAULT_MAX_ROWS } from './digestEmail'
import { buildDigest } from './alerts'
import type { AlertEquipment, AlertSchedule, AlertItemType, AlertStockRow } from './alerts'
import type { Lot } from './lotCalc'

const TODAY = new Date('2026-09-09T06:00:00Z')
const APP = 'https://inventaire.example.org'

const eq = (o: Partial<AlertEquipment> = {}): AlertEquipment => ({ id: 'eq-1', name: 'Congélateur -80', ...o })
const sch = (o: Partial<AlertSchedule> = {}): AlertSchedule => ({
  id: 'sch-1', equipment_id: 'eq-1', label: 'Dégivrage', next_due: '2026-08-20',
  lead_days: 60, last_alerted_at: null, ...o,
})
const item = (o: Partial<AlertItemType> = {}): AlertItemType => ({
  id: 'it-1', name: 'Ampicilline 10 µg', unit: 'pièces', min_threshold: 50,
  low_stock_alerted_at: null, ...o,
})
const stock = (id: string, q: number, c: string | null = null): AlertStockRow =>
  ({ item_type_id: id, quantity: q, last_counted_at: c })
const lot = (o: Partial<Lot> = {}): Lot & { item_type?: { name?: string } } => ({
  id: 'lot-1', item_type_id: 'it-1', manufacturer: 'KH Medical', expiry_date: '2026-06-08',
  lot_number: '2606211', quantity_initial: 600, quantity_remaining: 504, exhausted_at: null,
  item_type: { name: 'RADIONE extraction' }, ...o,
})

function digestWith(over: Partial<Parameters<typeof buildDigest>[0]> = {}) {
  return buildDigest({
    equipment: [eq()], schedules: [], itemTypes: [], stockRows: [], lots: [],
    today: TODAY, ...over,
  })
}

describe('renderDigestEmail — empty', () => {
  const out = renderDigestEmail(digestWith(), { appUrl: APP })

  it('uses the all-clear subject', () => {
    expect(out.subject).toBe('Inventaire Uvira — rien à signaler')
  })

  it('says so in the body rather than sending a blank email', () => {
    expect(out.html).toContain('Rien à signaler cette semaine')
    expect(out.text).toContain('Rien à signaler cette semaine')
  })
})

describe('renderDigestEmail — populated', () => {
  const digest = digestWith({
    schedules: [sch()],
    itemTypes: [item()],
    stockRows: [stock('it-1', 0, '2026-09-01T00:00:00Z')],
    lots: [lot()],
  })
  const out = renderDigestEmail(digest, { appUrl: APP })

  it('counts every row in the subject', () => {
    expect(out.subject).toBe('Inventaire Uvira — 3 point(s) à traiter')
  })

  it('renders French section headings', () => {
    expect(out.html).toContain('Maintenance en retard')
    expect(out.html).toContain('Stock faible')
    expect(out.html).toContain('Lots expirés')
  })

  it('reports days overdue', () => {
    expect(out.html).toContain('en retard de 20 j')
  })

  it('marks an item that has never been alerted as NOUVEAU', () => {
    expect(out.html).toContain('NOUVEAU')
  })

  it('omits NOUVEAU once the item has been alerted before', () => {
    const seen = digestWith({
      schedules: [sch({ last_alerted_at: '2026-09-02T06:00:00Z' })],
    })
    expect(renderDigestEmail(seen, { appUrl: APP }).html).not.toContain('NOUVEAU')
  })

  it('flags zero stock as a rupture', () => {
    expect(out.html).toContain('rupture de stock')
  })

  it('links rows back into the app', () => {
    expect(out.html).toContain(`${APP}/equipment/eq-1`)
    expect(out.html).toContain(`${APP}/inventory/items/it-1`)
  })

  it('strips a trailing slash from the app url', () => {
    const o = renderDigestEmail(digest, { appUrl: `${APP}/` })
    expect(o.html).toContain(`${APP}/equipment/eq-1`)
    expect(o.html).not.toContain('//equipment')
  })

  it('emits a plain-text part alongside the html', () => {
    expect(out.text).toContain('MAINTENANCE EN RETARD (1)')
    expect(out.text).toContain('Congélateur -80')
    expect(out.text).not.toContain('<td')
  })

  it('renders dates as dd/MM/yyyy, not a localised month', () => {
    expect(out.html).toContain('expiré le 08/06/2026')
  })

  it('prints the unit alongside a lot quantity when the join provides it', () => {
    const d = digestWith({ lots: [lot({ item_type: { name: 'RADIONE', unit: 'tests' } })] })
    expect(renderDigestEmail(d, { appUrl: APP }).html).toContain('504 tests')
  })

  it('falls back to a bare quantity when the join has no unit', () => {
    const d = digestWith({ lots: [lot({ item_type: { name: 'RADIONE' } })] })
    expect(renderDigestEmail(d, { appUrl: APP }).html).toContain('· 504')
  })
})

describe('section capping', () => {
  const many = Array.from({ length: 23 }, (_, i) =>
    item({ id: `it-${i}`, name: `Article ${i}`, min_threshold: 10 }))
  const digest = digestWith({ itemTypes: many, stockRows: many.map((m) => stock(m.id, 0)) })

  it('caps rows and reports the remainder', () => {
    const out = renderDigestEmail(digest, { appUrl: APP, maxRows: 10 })
    expect(out.html).toContain('et 13 autre(s)')
    // Each section caps independently. These 23 items are both low AND
    // never-counted, so they fill two sections: 10 rows shown in each.
    const sections = buildSections(digest, 'fr', APP, 10)
    expect(sections.map((x) => x.rows.length)).toEqual([10, 10])
    expect(sections.map((x) => x.total)).toEqual([23, 23])
    expect((out.html.match(/Article \d+/g) ?? []).length).toBe(20)
  })

  it('keeps the true total in the heading and the subject', () => {
    const out = renderDigestEmail(digest, { appUrl: APP, maxRows: 10 })
    // 23 low + 23 stale (never counted)
    expect(out.subject).toContain('46')
    expect(out.html).toContain('(23)')
  })

  it('defaults to DEFAULT_MAX_ROWS', () => {
    const sections = buildSections(digest, 'fr', APP, DEFAULT_MAX_ROWS)
    expect(sections[0].rows).toHaveLength(10)
    expect(sections[0].total).toBe(23)
  })

  it('does not add a remainder line when everything fits', () => {
    const out = renderDigestEmail(digest, { appUrl: APP, maxRows: 50 })
    expect(out.html).not.toContain('autre(s)')
  })
})

describe('escaping', () => {
  it('escapes free-text names typed by staff', () => {
    const digest = digestWith({
      itemTypes: [item({ id: 'x', name: 'Tubes & bouchons <5ml>', min_threshold: 10 })],
      stockRows: [stock('x', 0)],
    })
    const out = renderDigestEmail(digest, { appUrl: APP })
    expect(out.html).toContain('Tubes &amp; bouchons &lt;5ml&gt;')
    expect(out.html).not.toContain('<5ml>')
  })
})

describe('english rendering', () => {
  it('renders the same digest in english when asked', () => {
    const digest = digestWith({ schedules: [sch()] })
    const out = renderDigestEmail(digest, { appUrl: APP, lang: 'en' })
    expect(out.subject).toBe('Uvira inventory — 1 item(s) need attention')
    expect(out.html).toContain('Overdue maintenance')
    expect(out.html).toContain('20d overdue')
  })
})

// ── lot grouping ──────────────────────────────────────────────

describe('lot grouping', () => {
  // Reproduces real production data: one delivery of nine identical kits,
  // recorded as nine lots with sequential numbers, which filled 9 of the 12
  // rows in the expiring section.
  const kits = Array.from({ length: 9 }, (_, i) => lot({
    id: `k${i}`,
    item_type_id: 'kit',
    manufacturer: 'Bioperfectus',
    lot_number: `T2025100030020${i}`,
    expiry_date: '2026-10-19',
    quantity_initial: 1,
    quantity_remaining: 1,
    item_type: { name: 'Bioperfectus Cholera Kit', unit: 'boîtes' },
  }))
  const other = lot({
    id: 'apw', item_type_id: 'apw', manufacturer: 'Himedia', lot_number: 'LQU0466',
    expiry_date: '2026-10-31', quantity_remaining: 746,
    item_type: { name: 'APW (aliquotes 5 mL)', unit: 'flacons' },
  })
  const digest = digestWith({ lots: [...kits, other] })
  const out = renderDigestEmail(digest, { appUrl: APP })

  it('collapses nine identical lots into one row', () => {
    const sections = buildSections(digest, 'fr', APP, DEFAULT_MAX_ROWS)
    expect(sections).toHaveLength(1)
    expect(sections[0].rows).toHaveLength(2)
  })

  it('lists every lot number in the group, in order', () => {
    expect(out.html).toContain('lots T20251000300200, T20251000300201')
    expect(out.html).toContain('T20251000300208')
  })

  it('sums the grouped quantity', () => {
    expect(out.html).toContain('· 9 boîtes')
  })

  it('counts lots that have no number instead of dropping them', () => {
    const d = digestWith({ lots: [
      lot({ id: 'a', lot_number: 'ABC', expiry_date: '2026-10-19', item_type: { name: 'X' } }),
      lot({ id: 'b', lot_number: null,  expiry_date: '2026-10-19', item_type: { name: 'X' } }),
      lot({ id: 'c', lot_number: null,  expiry_date: '2026-10-19', item_type: { name: 'X' } }),
    ] })
    const html = renderDigestEmail(d, { appUrl: APP }).html
    expect(html).toContain('lot ABC')
    expect(html).toContain('2 sans numéro')
  })

  it('keeps the true lot count in the heading', () => {
    expect(out.html).toContain('(10)')
  })

  it('keeps a lone lot\'s own number', () => {
    expect(out.html).toContain('lot LQU0466')
  })

  it('does not group lots that differ by expiry date', () => {
    const d = digestWith({ lots: [
      lot({ id: 'a', expiry_date: '2026-10-19' }),
      lot({ id: 'b', expiry_date: '2026-10-20' }),
    ] })
    expect(buildSections(d, 'fr', APP, DEFAULT_MAX_ROWS)[0].rows).toHaveLength(2)
  })

  it('does not group lots from different manufacturers', () => {
    const d = digestWith({ lots: [
      lot({ id: 'a', manufacturer: 'KH Medical' }),
      lot({ id: 'b', manufacturer: 'Mast group' }),
    ] })
    expect(buildSections(d, 'fr', APP, DEFAULT_MAX_ROWS)[0].rows).toHaveLength(2)
  })

  it('counts hidden ROWS not hidden lots when capping', () => {
    // 9 lots collapse to 1 row, so with a cap of 1 nothing is hidden.
    const sections = buildSections(digestWith({ lots: kits }), 'fr', APP, 1)
    expect(sections[0].total).toBe(9)
    expect(sections[0].hiddenRows).toBe(0)
    expect(renderDigestEmail(digestWith({ lots: kits }), { appUrl: APP, maxRows: 1 }).html)
      .not.toContain('autre(s)')
  })
})

// ── deep links to the alerts page ─────────────────────────────

describe('section deep links', () => {
  const digest = digestWith({
    schedules: [sch()],
    itemTypes: [item()],
    stockRows: [stock('it-1', 0, '2026-09-01T00:00:00Z')],
    lots: [lot()],
  })

  it('links each section heading to its own filtered view', () => {
    const sections = buildSections(digest, 'fr', APP, DEFAULT_MAX_ROWS)
    // No stale section here: this fixture's item was counted 8 days ago.
    expect(sections.map((s) => s.href)).toEqual([
      `${APP}/alerts?s=overdue`,
      `${APP}/alerts?s=low`,
      `${APP}/alerts?s=expired`,
    ])
  })

  it('links the stale section too, when there is one', () => {
    const d = digestWith({
      itemTypes: [item()],
      stockRows: [stock('it-1', 100, '2026-01-01T00:00:00Z')],
    })
    const sections = buildSections(d, 'fr', APP, DEFAULT_MAX_ROWS)
    expect(sections.map((s) => s.href)).toContain(`${APP}/alerts?s=stale`)
  })

  it('makes the heading itself clickable', () => {
    const out = renderDigestEmail(digest, { appUrl: APP })
    expect(out.html).toContain(`href="${APP}/alerts?s=expired"`)
  })

  it('links the "and N more" line, which is where the reader wants the rest', () => {
    const many = Array.from({ length: 23 }, (_, i) =>
      item({ id: `it-${i}`, name: `Article ${i}`, min_threshold: 10 }))
    const big = digestWith({ itemTypes: many, stockRows: many.map((m) => stock(m.id, 0)) })
    const out = renderDigestEmail(big, { appUrl: APP, maxRows: 10 })
    expect(out.html).toContain(`<a href="${APP}/alerts?s=low"`)
    expect(out.html).toContain('et 13 autre(s)')
  })

  it('spells the url out in the plain-text part, which cannot carry links', () => {
    const many = Array.from({ length: 23 }, (_, i) =>
      item({ id: `it-${i}`, name: `Article ${i}`, min_threshold: 10 }))
    const big = digestWith({ itemTypes: many, stockRows: many.map((m) => stock(m.id, 0)) })
    const out = renderDigestEmail(big, { appUrl: APP, maxRows: 10 })
    expect(out.text).toContain(`et 13 autre(s) — ${APP}/alerts?s=low`)
  })
})
