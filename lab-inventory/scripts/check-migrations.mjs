#!/usr/bin/env node
/**
 * Which migrations have actually been applied, to which project.
 *
 * TODO.md used to track this by hand and was wrong twice in a week -- once
 * badly enough that a stale line got read back as evidence. This asks the
 * databases instead.
 *
 * Uses only the anon key already in .env / .env.local. No service role, no
 * DDL, no writes: every probe is a read, and the RPC probes pass an
 * all-zeros uuid so a write-capable function returns not-found long before
 * it reaches any write.
 *
 *   node scripts/check-migrations.mjs
 *
 * Exit 0 when both projects agree and nothing is missing, 1 otherwise, so it
 * can gate a deploy.
 *
 * IMPORTANT: policies and triggers are invisible over REST. Migrations that
 * only add those are reported "not probeable" rather than quietly passing --
 * a checker that hides what it cannot see is worse than no checker.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

/** Minimal .env reader -- no dependency, and never prints the key. */
function readEnv(file) {
  const path = resolve(root, file)
  if (!existsSync(path)) return null
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  if (!out.VITE_SUPABASE_URL || !out.VITE_SUPABASE_ANON_KEY) return null
  return { url: out.VITE_SUPABASE_URL, key: out.VITE_SUPABASE_ANON_KEY }
}

// What each migration adds that REST can actually see.
//   table:  { table, column }  -- column doubles as the table check
//   fn:     { fn, args }
const MIGRATIONS = [
  {
    file: 'add_tech_item_rename.sql',
    probes: [],
    note: 'RLS policy + guard_item_type_update trigger only — invisible over REST',
  },
  {
    file: 'add_stock_count_lot_provenance.sql',
    probes: [
      { kind: 'column', table: 'stock_counts', column: 'lot_id' },
      { kind: 'column', table: 'stock_counts', column: 'session_id' },
      { kind: 'column', table: 'stock_counts', column: 'counted_by_user_id' },
      { kind: 'column', table: 'stock_counts', column: 'is_legacy_aggregate' },
      { kind: 'column', table: 'inventory_session_entries', column: 'entered_by_user_id' },
      { kind: 'fn', fn: 'complete_inventory_session',
        args: { p_session_id: ZERO_UUID, p_target_date: '2000-01-01' } },
    ],
  },
  {
    file: 'add_stock_count_correction.sql',
    probes: [
      { kind: 'column', table: 'stock_count_history', column: 'prev_quantity' },
      { kind: 'fn', fn: 'correct_stock_count',
        args: { p_count_id: ZERO_UUID, p_quantity: 0 } },
    ],
    note: 'the history table must be readable, not merely present — see the grants fix',
  },
  {
    file: 'add_stock_count_delete.sql',
    probes: [
      { kind: 'fn', fn: 'delete_stock_count', args: { p_count_id: ZERO_UUID } },
    ],
    note: 'DELETE policy is not probeable; only the function is',
  },
]

async function post(env, path, body) {
  const res = await fetch(`${env.url}/rest/v1/${path}`, {
    method: 'POST',
    headers: { apikey: env.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

async function get(env, path) {
  const res = await fetch(`${env.url}/rest/v1/${path}`, { headers: { apikey: env.key } })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

/**
 * Three outcomes, deliberately kept apart:
 *
 *   present    the object exists and anon may read it
 *   ungranted  the object EXISTS but anon has no privilege on it
 *   absent     the object is not there
 *
 * "ungranted" is not a missing migration. The app always runs as
 * `authenticated`, never anon, and the anon key cannot test the
 * authenticated role -- so an anon grant difference between projects says
 * nothing definitive about whether the app works. It is still worth
 * printing: an anon/authenticated grant gap on a NEW table is what broke
 * stock_count_history, where nothing had been granted to anyone. So it is
 * reported as a warning, not a failure.
 */
async function probe(env, p) {
  if (p.kind === 'column') {
    const { body } = await get(env, `${p.table}?select=${p.column}&limit=1`)
    const code = body?.code
    if (Array.isArray(body)) return { state: 'present' }
    if (code === '42703') return { state: 'absent', why: `column ${p.table}.${p.column} missing` }
    if (code === '42501') return { state: 'ungranted', why: `${p.table} exists; anon has no privilege` }
    if (code === 'PGRST205' || code === 'PGRST204' || code === '42P01')
      return { state: 'absent', why: `table ${p.table} absent` }
    return { state: 'absent', why: `${p.table}.${p.column}: ${code ?? 'unexpected response'}` }
  }
  const { body } = await post(env, `rpc/${p.fn}`, p.args)
  if (body?.code === 'PGRST202') return { state: 'absent', why: `function ${p.fn} absent` }
  return { state: 'present' }   // anything else means it resolved and ran
}

const projects = [
  { label: 'test', env: readEnv('.env.local') },
  { label: 'prod', env: readEnv('.env') },
]

for (const p of projects) {
  if (!p.env) {
    console.error(`Cannot read ${p.label} config — expected VITE_SUPABASE_URL and`)
    console.error(`VITE_SUPABASE_ANON_KEY in ${p.label === 'test' ? '.env.local' : '.env'}`)
    process.exit(2)
  }
}

console.log('Probing with the anon key. Reads only; nothing is written.\n')
for (const p of projects) {
  console.log(`  ${p.label.padEnd(5)} ${new URL(p.env.url).hostname.split('.')[0]}`)
}
console.log()

let drift = false
const missing = []
const warnings = []

for (const m of MIGRATIONS) {
  const cells = []
  for (const proj of projects) {
    if (m.probes.length === 0) { cells.push('not probeable'); continue }
    const results = await Promise.all(m.probes.map(p => probe(proj.env, p)))
    const absent = results.filter(r => r.state === 'absent')
    const ungranted = results.filter(r => r.state === 'ungranted')
    for (const u of ungranted) warnings.push(`  ${m.file} [${proj.label}] — ${u.why}`)
    if (absent.length === 0) cells.push(ungranted.length ? 'applied*' : 'applied')
    else {
      cells.push(absent.length === m.probes.length ? 'ABSENT' : 'PARTIAL')
      for (const a of absent) missing.push(`  ${m.file} [${proj.label}] — ${a.why}`)
    }
  }
  // Only existence drives failure. A trailing * is an anon-grant note.
  const bare = cells.map(c => c.replace('*', ''))
  if (bare[0] !== bare[1]) drift = true
  if (bare.some(c => c === 'ABSENT' || c === 'PARTIAL')) drift = true
  console.log(`  ${m.file.padEnd(38)} ${cells[0].padEnd(14)} ${cells[1]}`)
  if (m.note) console.log(`  ${''.padEnd(38)} ${m.note}`)
}

if (missing.length) {
  console.log('\nMissing:')
  for (const d of missing) console.log(d)
}

if (warnings.length) {
  console.log('\nanon-grant notes (* above) — not failures:')
  for (const w of warnings) console.log(w)
  console.log('  The app runs as `authenticated`, which the anon key cannot test.')
  console.log('  Worth a look on a NEW table: nothing granted to anyone is what')
  console.log('  silently broke stock_count_history.')
}

console.log()
if (drift) {
  console.log('DRIFT or missing migrations. Run on test first, then production.')
  process.exit(1)
}
console.log('Both projects agree on everything probeable.')
console.log('Policies and triggers are NOT covered — see the "not probeable" rows.')
