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

The last P1 from the audit. Signatures agreed, SQL not yet written.

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

## 3. Verify against a seeded test project

The test Supabase project is only partly provisioned — no storage buckets, and
its lot data does not mirror production. That cost real time during the audit
work: test-server results were twice mistaken for production ones.

Bring it to parity (run `schema.sql` in full, including the storage block) so
the RPC work above can be exercised somewhere real before reaching Uvira.

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
