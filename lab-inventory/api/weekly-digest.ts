// Weekly digest email — Monday 06:00 Uvira time (04:00 UTC).
//
// Runs every check on the dashboard, plus the stale-count check the
// dashboard does not show, and emails the result to the lab's admins and
// managers. Detection itself lives in ../src/lib/alerts.ts and rendering in
// ../src/lib/digestEmail.ts, both shared with the browser so the email and
// the screen can never disagree about what counts as a problem.
//
// Required Vercel environment variables (Production):
//   SUPABASE_URL               project URL (falls back to VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY  server-only secret; NEVER give it a VITE_ prefix
//   RESEND_API_KEY             re_… key with Sending access
//   DIGEST_FROM                e.g. "Uvira Lab <noreply@mail.diseasedynamics.ch>"
//   CRON_SECRET                any long random string
//   APP_URL                    public app URL used for the links in the email
//
// CRON_SECRET is special-cased by Vercel: define it and Vercel sends it as a
// bearer token on scheduled invocations, which is what the guard below
// checks. Without that, this URL would let anyone on the internet make the
// lab's inbox ring.
//
// Manual dry run (renders, sends nothing, no secret needed only when
// CRON_SECRET is unset, i.e. locally):
//   GET /api/weekly-digest?dry=1

import { createClient } from '@supabase/supabase-js'
import { buildDigest } from '../src/lib/alerts.js'
import { renderDigestEmail } from '../src/lib/digestEmail.js'
import type { DigestLang } from '../src/lib/digestEmail.js'

interface Req {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
}
interface Res {
  status(code: number): Res
  json(body: unknown): void
  setHeader(name: string, value: string): void
  send(body: string): void
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const resendKey = process.env.RESEND_API_KEY ?? ''
const from = process.env.DIGEST_FROM ?? ''
const cronSecret = process.env.CRON_SECRET ?? ''
const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL ?? ''

/** Roles that receive the digest until the opt-in toggle exists. */
const RECIPIENT_ROLES = ['admin', 'lab_manager']

export default async function handler(req: Req, res: Res) {
  const query = new URL(req.url ?? '/', 'http://localhost').searchParams
  const dry = query.get('dry') === '1'
  const lang = (query.get('lang') === 'en' ? 'en' : 'fr') as DigestLang

  // ── Auth ───────────────────────────────────────────────────
  // When CRON_SECRET is configured (always, in production) it is required,
  // dry run or not. When it is absent the endpoint is local-only and will
  // not send: rendering is safe, sending is not.
  const auth = (req.headers['authorization'] ?? req.headers['Authorization']) as string | undefined
  if (cronSecret) {
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  } else if (!dry) {
    return res.status(500).json({
      error: 'CRON_SECRET is not configured. Refusing to send from an unauthenticated endpoint.',
    })
  }

  if (!url || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured (missing SUPABASE_SERVICE_ROLE_KEY)' })
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // ── Read ───────────────────────────────────────────────────
  const [eqR, schR, itemR, stockR, lotR, countR, profileR] = await Promise.all([
    db.from('equipment').select('id, name'),
    db.from('maintenance_schedules').select('*'),
    db.from('item_types').select('*'),
    db.from('current_stock').select('*'),
    db.from('lots').select('*, item_type:item_types(id, name, unit)').is('exhausted_at', null),
    // Only what is needed to derive a true last-count date per item. This is
    // the whole table, but it is a narrow projection of a few hundred rows
    // and avoids a group-by that PostgREST cannot express directly.
    db.from('stock_counts').select('item_type_id, counted_at'),
    db.from('profiles').select('email, full_name, role').eq('is_active', true).in('role', RECIPIENT_ROLES),
  ])

  const failed = [eqR, schR, itemR, stockR, lotR, countR, profileR].find((r) => r.error)
  if (failed?.error) {
    return res.status(500).json({ error: `Query failed: ${failed.error.message}` })
  }

  // True last-count dates, straight from stock_counts. The current_stock
  // view coalesces this to max(lots.created_at) for lot-tracked items, which
  // makes a delivered-but-never-counted item look freshly counted. See the
  // caveat on findStaleCounts.
  const lastCountedByItem = new Map<string, string>()
  for (const row of countR.data ?? []) {
    const prev = lastCountedByItem.get(row.item_type_id)
    if (!prev || row.counted_at > prev) lastCountedByItem.set(row.item_type_id, row.counted_at)
  }

  const digest = buildDigest({
    equipment: eqR.data ?? [],
    schedules: schR.data ?? [],
    itemTypes: itemR.data ?? [],
    stockRows: stockR.data ?? [],
    lots: lotR.data ?? [],
    lastCountedByItem,
  })

  const email = renderDigestEmail(digest, { appUrl: appUrl || url, lang })
  const recipients = (profileR.data ?? []).map((p) => p.email).filter(Boolean)

  // ── Dry run ────────────────────────────────────────────────
  if (dry) {
    if (query.get('format') === 'json') {
      return res.status(200).json({
        subject: email.subject,
        recipients,
        total: digest.total,
        sections: {
          overdue: digest.overdue.length,
          dueSoon: digest.dueSoon.length,
          lowStock: digest.lowStock.length,
          expired: digest.expired.length,
          expiring: digest.expiring.length,
          stale: digest.stale.length,
        },
        text: email.text,
      })
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(email.html)
  }

  // ── Send ───────────────────────────────────────────────────
  if (!resendKey || !from) {
    return res.status(500).json({ error: 'Email not configured (missing RESEND_API_KEY or DIGEST_FROM)' })
  }
  if (recipients.length === 0) {
    return res.status(200).json({ ok: true, sent: 0, note: 'No active admin or lab_manager recipients' })
  }

  // Resend's REST API directly rather than its SDK: one POST, no dependency
  // added to a project that already has a node_modules resolution problem
  // above it (TODO item 6).
  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  })

  if (!send.ok) {
    const detail = await send.text()
    return res.status(502).json({ error: 'Resend rejected the message', status: send.status, detail })
  }

  // ── Stamp what was reported ────────────────────────────────
  // Only after a successful send, so a failed run does not silently mark
  // everything as already-announced and suppress next week's NOUVEAU badges.
  // Errors here are reported, not swallowed: a stamp that quietly fails
  // leaves every row marked NOUVEAU forever, which is how the badge stops
  // meaning anything. (Same class of bug as TODO item 5.)
  const now = new Date().toISOString()
  const scheduleIds = [...digest.overdue, ...digest.dueSoon]
    .filter((m) => m.schedule.last_alerted_at == null)
    .map((m) => m.schedule.id)
  const itemIds = digest.lowStock.filter((i) => i.low_stock_alerted_at == null).map((i) => i.id)

  const stampErrors: string[] = []
  if (scheduleIds.length) {
    const { error } = await db.from('maintenance_schedules').update({ last_alerted_at: now }).in('id', scheduleIds)
    if (error) stampErrors.push(`maintenance_schedules: ${error.message}`)
  }
  if (itemIds.length) {
    const { error } = await db.from('item_types').update({ low_stock_alerted_at: now }).in('id', itemIds)
    if (error) stampErrors.push(`item_types: ${error.message}`)
  }

  return res.status(200).json({
    ok: true,
    sent: recipients.length,
    subject: email.subject,
    total: digest.total,
    stamped: { schedules: scheduleIds.length, items: itemIds.length },
    stampErrors: stampErrors.length ? stampErrors : undefined,
    ts: now,
  })
}
