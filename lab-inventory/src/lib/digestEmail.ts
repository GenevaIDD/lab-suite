/**
 * Weekly digest email rendering.
 *
 * Pure: takes a Digest from alerts.ts and returns a subject, an HTML body
 * and a plain-text body. Reads nothing, sends nothing. Same constraints as
 * alerts.ts — no React, no Supabase, no `@/` alias — because api/ imports it.
 *
 * The HTML is deliberately old-fashioned: tables, inline styles, no <style>
 * block, no flexbox, no grid, no web fonts, no external images. Gmail,
 * Outlook and most webmail clients strip or ignore anything more modern, and
 * a digest that renders as an unstyled column of text is worse than one that
 * looks plain everywhere. Dark mode is left to the client.
 *
 * Dates render as dd/MM/yyyy rather than a localised month name, so the
 * output does not depend on date-fns locale files being bundled into the
 * serverless function.
 */

import { translations } from './translations.js'
import type { Digest, AlertSchedule, AlertEquipment, AlertItemType } from './alerts'
import type { Lot } from './lotCalc'

export type DigestLang = 'fr' | 'en'

export interface DigestEmailOptions {
  /** Base URL of the app, no trailing slash — used for the deep links. */
  appUrl: string
  lang?: DigestLang
  /** Rows shown per section before collapsing into "et N autre(s)". */
  maxRows?: number
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/** Rows per section before the rest are collapsed into a count. */
export const DEFAULT_MAX_ROWS = 10

// ── Small helpers ─────────────────────────────────────────────

type Vars = Record<string, string | number>

function tr(lang: DigestLang, key: string, vars: Vars = {}): string {
  const dict = translations[lang] as Record<string, string>
  let out = dict[key] ?? key
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

/**
 * Escape before interpolating anything into the HTML. Item and equipment
 * names are free text typed by staff; an ampersand in "Tubes & bouchons"
 * would otherwise produce invalid markup, and a stray angle bracket could
 * break the layout of the whole email.
 */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

/** Trim a number to at most 2 decimals without trailing zeros. */
function fmtQty(n: number): string {
  return String(Math.round(n * 100) / 100)
}

// ── Section model ─────────────────────────────────────────────

interface Row {
  primary: string
  secondary: string
  /** Right-hand pill. */
  badge?: string
  /** Urgent styling for the badge. */
  urgent?: boolean
  /** First time this has been reported. */
  isNew?: boolean
  href?: string
}

interface Section {
  title: string
  rows: Row[]
  /** Underlying items (lots, not rows) — what the heading reports. */
  total: number
  /** Rows suppressed by the cap. Not the same as total - rows.length once
   *  lots are grouped: one row can stand for nine lots. */
  hiddenRows: number
}

export function buildSections<
  S extends AlertSchedule,
  E extends AlertEquipment,
  I extends AlertItemType,
  L extends Lot & { item_type?: { name?: string; unit?: string } | null },
>(
  digest: Digest<S, E, I, L>,
  lang: DigestLang,
  appUrl: string,
  maxRows: number,
): Section[] {
  const cap = <T,>(items: T[]): T[] => items.slice(0, maxRows)
  const sections: Section[] = []

  /**
   * Collapse lots that differ only by lot number.
   *
   * A single delivery of nine identical kits is recorded as nine lots with
   * sequential numbers, and rendered one-per-row it buries everything else
   * in the section — real production data had nine Bioperfectus rows out of
   * twelve. Same item, same manufacturer, same expiry date is one thing to
   * act on, so it gets one row carrying the combined quantity and a count.
   */
  const groupLots = (lots: L[]): { lots: L[]; qty: number }[] => {
    const groups = new Map<string, { lots: L[]; qty: number }>()
    for (const l of lots) {
      const key = `${l.item_type_id}|${l.manufacturer}|${l.expiry_date}`
      const g = groups.get(key)
      if (g) { g.lots.push(l); g.qty += l.quantity_remaining }
      else groups.set(key, { lots: [l], qty: l.quantity_remaining })
    }
    return [...groups.values()]
  }

  const lotName = (l: L): string => l.item_type?.name ?? '—'
  const groupDetail = (g: { lots: L[]; qty: number }): string => {
    const first = g.lots[0]
    const bits = [first.manufacturer]
    // Every lot number, not a count: they are what you read off the boxes on
    // the shelf, so a row you cannot act on without opening the app is only
    // half a row. Sorted so sequential numbers from one delivery read in order.
    const numbers = g.lots.map((l) => l.lot_number).filter((n): n is string => !!n).sort()
    const unnumbered = g.lots.length - numbers.length
    if (numbers.length) {
      bits.push(`${tr(lang, numbers.length > 1 ? 'digest.lots' : 'digest.lot')} ${numbers.join(', ')}`)
    }
    if (unnumbered > 0) bits.push(tr(lang, 'digest.lots.unnumbered', { n: unnumbered }))
    // Unit included when the join provides it: a bare "274" reads as a lot
    // number rather than a quantity.
    const unit = first.item_type?.unit
    bits.push(unit ? `${fmtQty(g.qty)} ${unit}` : fmtQty(g.qty))
    return bits.join(' · ')
  }

  if (digest.overdue.length) {
    sections.push({
      title: tr(lang, 'digest.section.overdue'),
      total: digest.overdue.length,
      hiddenRows: Math.max(0, digest.overdue.length - maxRows),
      rows: cap(digest.overdue).map((m) => ({
        primary: m.equipment.name,
        secondary: m.schedule.label,
        badge: tr(lang, 'digest.days.overdue', { n: Math.abs(m.days) }),
        urgent: true,
        isNew: m.schedule.last_alerted_at == null,
        href: `${appUrl}/equipment/${m.equipment.id}`,
      })),
    })
  }

  if (digest.dueSoon.length) {
    sections.push({
      title: tr(lang, 'digest.section.duesoon'),
      total: digest.dueSoon.length,
      hiddenRows: Math.max(0, digest.dueSoon.length - maxRows),
      rows: cap(digest.dueSoon).map((m) => ({
        primary: m.equipment.name,
        secondary: m.schedule.label,
        badge: m.days === 0 ? tr(lang, 'digest.due.today') : tr(lang, 'digest.days.until', { n: m.days }),
        isNew: m.schedule.last_alerted_at == null,
        href: `${appUrl}/equipment/${m.equipment.id}`,
      })),
    })
  }

  if (digest.lowStock.length) {
    sections.push({
      title: tr(lang, 'digest.section.low'),
      total: digest.lowStock.length,
      hiddenRows: Math.max(0, digest.lowStock.length - maxRows),
      rows: cap(digest.lowStock).map((i) => ({
        primary: i.name,
        secondary: tr(lang, 'digest.stock', { q: fmtQty(i.quantity), u: i.unit, m: fmtQty(i.min_threshold) }),
        badge: i.quantity <= 0 ? tr(lang, 'digest.outofstock') : undefined,
        urgent: i.quantity <= 0,
        isNew: i.low_stock_alerted_at == null,
        href: `${appUrl}/inventory/items/${i.id}`,
      })),
    })
  }

  if (digest.expired.length) {
    const groups = groupLots(digest.expired)
    sections.push({
      title: tr(lang, 'digest.section.expired'),
      total: digest.expired.length,
      hiddenRows: Math.max(0, groups.length - maxRows),
      rows: cap(groups).map((g) => ({
        primary: lotName(g.lots[0]),
        secondary: groupDetail(g),
        badge: tr(lang, 'digest.expired.on', { d: fmtDate(g.lots[0].expiry_date) }),
        urgent: true,
        href: `${appUrl}/inventory/items/${g.lots[0].item_type_id}`,
      })),
    })
  }

  if (digest.expiring.length) {
    const groups = groupLots(digest.expiring)
    sections.push({
      title: tr(lang, 'digest.section.expiring', { n: digest.expiryHorizonDays }),
      total: digest.expiring.length,
      hiddenRows: Math.max(0, groups.length - maxRows),
      rows: cap(groups).map((g) => ({
        primary: lotName(g.lots[0]),
        secondary: groupDetail(g),
        badge: tr(lang, 'digest.expires.on', { d: fmtDate(g.lots[0].expiry_date) }),
        href: `${appUrl}/inventory/items/${g.lots[0].item_type_id}`,
      })),
    })
  }

  if (digest.stale.length) {
    sections.push({
      title: tr(lang, 'digest.section.stale', { n: digest.staleDays }),
      total: digest.stale.length,
      hiddenRows: Math.max(0, digest.stale.length - maxRows),
      rows: cap(digest.stale).map((i) => ({
        primary: i.name,
        secondary: tr(lang, 'digest.stock', { q: fmtQty(i.quantity), u: i.unit, m: fmtQty(i.min_threshold) }),
        badge: i.daysSince === null
          ? tr(lang, 'digest.never')
          : tr(lang, 'digest.since', { n: i.daysSince }),
        urgent: i.daysSince === null,
        href: `${appUrl}/inventory/items/${i.id}`,
      })),
    })
  }

  return sections
}

// ── Rendering ─────────────────────────────────────────────────

const INK = '#1c1917'
const MUTED = '#78716c'
const LINE = '#e7e5e4'
const URGENT = '#b91c1c'
const URGENT_BG = '#fef2f2'
const CHIP_BG = '#f5f5f4'
const NEW_BG = '#ecfdf5'
const NEW_INK = '#047857'
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

function renderRow(row: Row, lang: DigestLang): string {
  const badge = row.badge
    ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;white-space:nowrap;`
      + `background:${row.urgent ? URGENT_BG : CHIP_BG};color:${row.urgent ? URGENT : MUTED};">${esc(row.badge)}</span>`
    : ''
  const isNew = row.isNew
    ? `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:10px;font-size:11px;`
      + `font-weight:600;background:${NEW_BG};color:${NEW_INK};">${esc(tr(lang, 'digest.new'))}</span>`
    : ''
  const name = row.href
    ? `<a href="${esc(row.href)}" style="color:${INK};text-decoration:none;">${esc(row.primary)}</a>`
    : esc(row.primary)

  return `<tr>
  <td style="padding:8px 0;border-bottom:1px solid ${LINE};font-family:${FONT};">
    <div style="font-size:14px;color:${INK};">${name}${isNew}</div>
    <div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(row.secondary)}</div>
  </td>
  <td align="right" style="padding:8px 0;border-bottom:1px solid ${LINE};font-family:${FONT};vertical-align:top;">${badge}</td>
</tr>`
}

function renderSection(section: Section, lang: DigestLang): string {
  const hidden = section.hiddenRows
  const more = hidden > 0
    ? `<div style="font-size:12px;color:${MUTED};padding-top:8px;font-family:${FONT};">${esc(tr(lang, 'digest.more', { n: hidden }))}</div>`
    : ''
  return `<tr><td style="padding:24px 0 0 0;">
  <div style="font-family:${FONT};font-size:13px;font-weight:600;color:${INK};text-transform:uppercase;letter-spacing:.04em;">
    ${esc(section.title)} <span style="color:${MUTED};font-weight:400;">(${section.total})</span>
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:collapse;">
    ${section.rows.map((r) => renderRow(r, lang)).join('\n')}
  </table>
  ${more}
</td></tr>`
}

export function renderDigestEmail<
  S extends AlertSchedule,
  E extends AlertEquipment,
  I extends AlertItemType,
  L extends Lot & { item_type?: { name?: string; unit?: string } | null },
>(digest: Digest<S, E, I, L>, options: DigestEmailOptions): RenderedEmail {
  const lang = options.lang ?? 'fr'
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS
  const appUrl = options.appUrl.replace(/\/+$/, '')
  const dateStr = fmtDate(digest.generatedAt)

  const subject = digest.isEmpty
    ? tr(lang, 'digest.subject.clear')
    : tr(lang, 'digest.subject.items', { n: digest.total })

  const sections = buildSections(digest, lang, appUrl, maxRows)

  const body = digest.isEmpty
    ? `<tr><td style="padding:24px 0 0 0;font-family:${FONT};">
         <div style="font-size:15px;color:${INK};font-weight:600;">${esc(tr(lang, 'digest.empty.title'))}</div>
         <div style="font-size:13px;color:${MUTED};margin-top:6px;">${esc(tr(lang, 'digest.empty.body'))}</div>
       </td></tr>`
    : sections.map((s) => renderSection(s, lang)).join('\n')

  const intro = digest.isEmpty
    ? ''
    : `<div style="font-family:${FONT};font-size:13px;color:${MUTED};margin-top:4px;">${esc(tr(lang, 'digest.intro', { d: dateStr, n: digest.total }))}</div>`

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:8px;padding:24px;">
  <tr><td>
    <div style="font-family:${FONT};font-size:18px;font-weight:600;color:${INK};">${esc(tr(lang, 'digest.title'))}</div>
    ${intro}
  </td></tr>
  ${body}
  <tr><td style="padding:28px 0 0 0;">
    <a href="${esc(appUrl)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${FONT};font-size:14px;text-decoration:none;padding:10px 18px;border-radius:6px;">${esc(tr(lang, 'digest.cta'))}</a>
  </td></tr>
  <tr><td style="padding:20px 0 0 0;border-top:1px solid ${LINE};margin-top:20px;">
    <div style="font-family:${FONT};font-size:11px;color:${MUTED};padding-top:16px;">${esc(tr(lang, 'digest.footer'))}</div>
  </td></tr>
</table>
</td></tr>
</table>`

  // Plain text matters more than it looks: some clients show it, and a
  // text part markedly improves the odds of not being filed as spam.
  const textLines: string[] = [tr(lang, 'digest.title'), '='.repeat(40), '']
  if (digest.isEmpty) {
    textLines.push(tr(lang, 'digest.empty.title'), '', tr(lang, 'digest.empty.body'))
  } else {
    textLines.push(tr(lang, 'digest.intro', { d: dateStr, n: digest.total }), '')
    for (const s of sections) {
      textLines.push(`${s.title.toUpperCase()} (${s.total})`)
      for (const r of s.rows) {
        const badge = r.badge ? `  [${r.badge}]` : ''
        const isNew = r.isNew ? ` *${tr(lang, 'digest.new')}*` : ''
        textLines.push(`  - ${r.primary}${isNew} — ${r.secondary}${badge}`)
      }
      if (s.hiddenRows > 0) textLines.push(`  ${tr(lang, 'digest.more', { n: s.hiddenRows })}`)
      textLines.push('')
    }
  }
  textLines.push('', appUrl, '', tr(lang, 'digest.footer'))

  return { subject, html, text: textLines.join('\n') }
}
