# TODO

Outstanding work from the September 2026 external audit, plus items found
while acting on it. Items 1–5 of the audit are done, deployed and verified.

## 1. Teach the offline queue to replay RPC calls

**Blocks:** the `record_delivery` / `complete_inventory_session` RPC work below.

`offline-queue.ts` stores `{ table, operation, payload }` and replays through
`supabase.from(table)`. An RPC does not fit that shape. Until it does, moving
deliveries and session completion to RPCs would silently drop their offline
support.

Sketch: add `operation: 'rpc'` with `{ fn, args }`, and have `flushQueue`
dispatch to `supabase.rpc(fn, args)`. Idempotency keys (below) make replay
safe — an RPC replayed twice must be a no-op, which table writes never
guaranteed.

**Offline write capture is currently DISABLED** (`OFFLINE_WRITES_ENABLED` in
`src/lib/offline-queue.ts`). Writes attempted with no connection now fail
with a translated message rather than being deferred. Entries queued before
it was switched off still drain on reconnect. Re-enabling is gated on this
item plus queue scoping (item 4).

## 2. Transactional RPCs for delivery and session completion

The last P1 from the audit. Session completion DONE 2026-09-03; delivery
still outstanding.

### complete_inventory_session — DONE

`supabase/add_complete_session_rpc.sql`, client cut over in v0.19.0.
Verified on the test project against real data
(`supabase/test_complete_session_rpc.sql`): one call applied 1 stock count,
1 lot update and 1 snapshot; the second returned `already_completed` and
wrote nothing; the lot moved 200 -> 7 and rolled back cleanly.

Not yet proven: RLS. The test script runs as `postgres` in the SQL editor,
which bypasses policies. Completing a session in the app as a tech-role
user is what exercises those.

- `record_delivery(p_request_id uuid, …) returns jsonb`
  Creates the delivery and its lot in one transaction. Idempotent on a
  client-generated `p_request_id`, held in a new `deliveries.request_id`
  unique column, generated once per form mount.

  The lot write becomes a single `insert … on conflict … do update` against
  the `lots_identity_idx` partial unique index, replacing the read-then-write.

- `complete_inventory_session(p_session_id uuid, p_target_date date) returns jsonb`
  Takes no entries parameter: entries are already persisted in
  `inventory_session_entries`, so the function reads them itself. Guarded by
  `select … for update` on the session row, returning early when already
  completed.

Both `SECURITY INVOKER` with `set search_path = public`, so existing RLS
policies keep applying.

**Why this matters, with evidence.** On 2026-09-03 production held two
duplicate lot groups. One was a genuine repeat delivery. The other — 96 Wells
Background plate, lot 2606211 — was two delivery rows created 149ms apart,
neither ever counted: a double-clicked form. The submit guard keys off
`createDelivery.isPending`, which only goes true after a re-render, so a
normal double-click gets two submissions through.

For lot-tracked items that leaves a detectable duplicate row. For non-tracked
items a double-submit just adds the delivery quantity twice with no trace, and
cannot be audited retrospectively. Fixing the write path is the only remedy.

## 3. Test project parity — DONE 2026-09-03

The test project (`uizvyziucufrkdxinzda`, eu-west-1) now holds a copy of
production's public schema data:

    item_types 178   equipment 76   lots 99   deliveries 134
    sessions 22      stock_counts 271         session_entries 692

Schema was already at full parity — every table, column, enum value, the
current_stock view and both storage buckets. Only data was missing.

Copied with `pg_dump --data-only --schema=public --exclude-table=profiles`
via the session pooler (direct connections are IPv6-only and unreachable
from an IPv4 network). `profiles` is excluded because it foreign-keys to
`auth.users`; test keeps its own logins.

Known gaps, both expected:
  - Equipment photos render blank. Image files live in storage, not
    Postgres, so they do not travel in a database dump.
  - Test data is a point-in-time snapshot and will drift from production.

Note for future debugging: an anon key cannot read `storage.buckets` or
PostgREST's OpenAPI root, and both return empty rather than an error. During
this work that made buckets and tables look absent when they existed. Verify
schema questions in the SQL editor, not through the anon key.

## 4. Offline queue ownership (audit finding 4)

Queued writes carry no user or project identity and live under one global
`localStorage` key, surviving logout. On a shared device they would flush
under whichever session is active later. Scope the key by user id and Supabase
project ref, and never flush across an identity change.

Lower priority while capture is disabled, but must land before it is re-enabled.

## 5. Admin profile sync (audit finding 7)

`api/admin-users.ts` updates Auth first, then discards the error from the
`profiles` update. An invite can return `ok: true` with the user silently left
on the default `tech` role. Check and return those errors.

## 6. Housekeeping

- 15 ESLint errors, mostly `react-hooks/set-state-in-effect`.
- 9 high-severity advisories, chiefly `react-router-dom`.
- ~1 MB main bundle; no code splitting.
- Root `package.json` / `package-lock.json` and 104 MB of `node_modules` sit
  above this project and mask missing subproject dependencies through upward
  resolution — which is exactly how the missing `vitest` dependency stayed
  hidden. Remove them.
