// Keep-alive health check.
//
// Makes a lightweight database request so a free-tier Supabase project does
// not auto-pause after ~7 days of inactivity. Called daily by the Vercel
// Cron entry in vercel.json (crons run only on the production deployment).
// Also usable as a manual health probe: GET /api/health.

import { createClient } from '@supabase/supabase-js'

interface Res {
  status(code: number): Res
  json(body: unknown): void
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''

export default async function handler(_req: unknown, res: Res) {
  if (!url || !anonKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not configured' })
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // A HEAD count is the cheapest request that still hits Postgres and counts
  // as project activity. The row count itself is irrelevant.
  const { error } = await supabase.from('item_types').select('id', { head: true, count: 'exact' })

  return res.status(200).json({ ok: !error, ts: new Date().toISOString(), error: error?.message ?? null })
}
