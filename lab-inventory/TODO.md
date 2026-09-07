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

RLS verified 2026-09-03 through the app on the test project, signed in as a
tech-role user: the session completed, and a deliberate double-click on
Terminer wrote exactly one stock-count row (42.00) rather than two. So the
status guard holds through the real call path, and the tech role carries
enough grant to write stock_counts, lots and inventory_sessions inside a
SECURITY INVOKER function.

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

## 3. Test project parity — DONE 2026-09-03, **now stale**

**2026-09-07:** the test project is BEHIND production again. Both
`add_tech_item_rename.sql` and `add_stock_count_lot_provenance.sql` were run
on production only. Run them on test before starting 3b's count correction,
or there is nowhere safe to validate it.

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

## 3b. Correcting misentries  ** requested 2026-09-03 **

Staff notice a past entry was wrong -- a typo in a name, a count keyed as 70
instead of 7 -- and want to fix it themselves. Split into two halves; the
first shipped in v0.20.0, the second has not started.

### DONE 2026-09-04 -- correcting item details

`item_types` was admin+lab_manager-only for update, so whoever created a
misspelled item could not fix it. Worse, the Edit button on ItemDetail and
EquipmentDetail was not role-gated at all: a tech saw it, filled the form and
the save failed at RLS. That silent failure was most of the original
complaint.

  - tech + lab_team can now update item_types, EXCEPT `unit` and
    `track_lots`, which rewrite the meaning of historical data.
    `supabase/add_tech_item_rename.sql`: an UPDATE policy plus a
    `guard_item_type_update` BEFORE UPDATE trigger. Column-level GRANTs
    cannot express this -- every app user shares the `authenticated`
    Postgres role, the app role lives in `profiles.role`.
  - Edit buttons gated; both edit routes guard on direct navigation.
  - `cap.edit` in the Users capability matrix split into `cap.edit.item`,
    `cap.edit.units`, `cap.edit.equip`.

Run on production 2026-09-05. Verified: a tech can rename an item.

### DONE 2026-09-05 -- one stock count = one counted thing (stage 1)

Prerequisite for correcting counts, and a fix in its own right. Lots had
become a second *storage mechanism* rather than a dimension of a count:
tracked items kept stock in `lots.quantity_remaining` while their
`stock_counts` rows were an item-level SUM that nobody counted, written with
`counted_by` and `notes` null. `fix_last_counted_lot_items.sql` exists
because that split forced the view to take quantity from lots and the date
from stock_counts.

`supabase/add_stock_count_lot_provenance.sql`:
  - `stock_counts` gains `lot_id`, `session_id`, `counted_by_user_id`,
    `is_legacy_aggregate`; `inventory_session_entries` gains
    `entered_by_user_id`.
  - `complete_inventory_session` writes one row per entry carrying `lot_id`,
    replacing the old two-path insert. Ad-hoc lot counts likewise.
  - `session_id` backfilled by matching completed sessions on the exact
    midnight-UTC `counted_at` the RPC writes. Ambiguous target_dates left
    null rather than guessed.
  - `current_stock` split into `latest_item_count` (item-level rows only)
    and `latest_count_date`, so a per-lot row can never be read as an item
    total.

Client: `rollUpCounts` (`src/lib/stockCalc.ts`) collapses per-lot rows into
one item-level point before the chart builders see them. Without it
`buildBurnRate` compares one lot against another and invents consumption --
silently, with no error. It carries a running per-lot quantity rather than
grouping by timestamp, because the ad-hoc form counts ONE lot per
submission, so each row gets its own timestamp.

Run on production 2026-09-06, deployed same day. Team confirmed a completed
session produces per-lot rows with attribution, 2026-09-07.
Read-only checks: `supabase/verify_stock_count_provenance.sql`.

Legacy aggregate rows cannot be decomposed -- the per-lot detail was never
captured -- so history is clean going forward, not backwards.

### TODO -- correcting a recorded count

Not started. `stock_counts` is still INSERT-only (schema.sql), and the count
history on ItemDetail is read-only.

Decisions taken:
  - Who: admin + lab_manager, matching the delivery policy in
    `components/inventory/DeliveryActions.tsx`.
  - History: edits in place, with a BEFORE UPDATE/DELETE trigger copying the
    previous row into a history table (who, when). Keeps auditability while
    giving normal edit UX.
  - Lot-tracked items are corrected **per lot**, never through the item-level
    aggregate. Decided 2026-09-05; stage 1 exists to make that possible.

Work:
1. `stock_count_history` table: source row id, every mutable field's previous
   value, replaced_at, replaced_by.
2. BEFORE UPDATE and BEFORE DELETE triggers writing OLD into it. Triggers
   rather than application code, so nothing can bypass them.
3. UPDATE and DELETE policies on stock_counts for admin + lab_manager.
4. A transactional RPC for the correction itself. Correcting a lot's count is
   two writes that must agree -- the `stock_counts` row and
   `lots.quantity_remaining` -- which is the same problem audit finding 2
   applied an RPC to. Stage 2 (below) would remove the second write.
5. UI: edit affordance on the count history table, showing that a row was
   amended and what it was before.
6. i18n keys, FR and EN.

Watch out:
  - Correcting the LATEST count changes displayed stock immediately;
    correcting an older one changes only history and the burn rate. The UI
    must make clear which is happening, or people will "fix" a number and
    see nothing change.
  - Legacy aggregate rows (`is_legacy_aggregate`) must never be offered for
    correction: they summarise lots that were never individually recorded.
  - Session entries stay a historical record. A completed session's entries
    already produced stock_counts rows; the correction belongs on those rows,
    not on the entry. This settles the open question in the original 3b.

## 3c. Stage 2 -- one stock mechanism  ** not started **

`current_stock` still has two branches: non-tracked items derive stock from
counts, tracked items from `lots.quantity_remaining`. Stage 1 made the count
rows uniform; stage 2 would make the *view* uniform, deriving tracked stock
from the latest count per lot and demoting `quantity_remaining` to a cache.

Not scheduled, and bigger than it sounds: `quantity_remaining` is written
from four places (delivery upsert, the session RPC, the ad-hoc count form,
discard), so demoting it means turning each into an event the view reads.
Do the count correction above first -- it does not depend on this.

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
