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

## 3. Test project parity — DONE 2026-09-03, resynced 2026-09-07

**Schema parity drifts every time a migration is run on one project and not
the other, and it drifted twice in a week.** Current state (2026-09-07):

    add_tech_item_rename.sql              test + prod
    add_stock_count_lot_provenance.sql    test + prod
    add_stock_count_correction.sql        test + prod
    (grants fix, appended to the above)   test + prod
    add_stock_count_delete.sql            test + prod

Run every migration on test FIRST, then production. Working the other way
round leaves nowhere to validate the next change.

**This list is hand-maintained and has been wrong before.** Do not trust it:

    npm run check:migrations

`scripts/check-migrations.mjs` asks both databases directly, using only the
anon key already in `.env` / `.env.local`. Reads only -- RPC probes pass an
all-zeros uuid, so a write-capable function returns not-found long before it
reaches any write. Exits 1 on drift, so it can gate a deploy.

Add a row to its MIGRATIONS array whenever you add a migration; the table
above is the human summary, the script is the truth.

What it cannot see, and says so rather than passing quietly:
  - **policies and triggers.** `add_tech_item_rename.sql` is entirely policy
    and trigger, so it shows "not probeable". Same for the DELETE policy.
  - **the `authenticated` role.** The app never runs as anon, and the anon
    key cannot test authenticated. An anon-grant difference is printed as a
    note, not a failure -- `inventory_session_entries` is ungranted to anon
    on production and the app is fine. But on a NEW table it is worth
    checking: nothing granted to anyone is what silently broke
    `stock_count_history`.

Project refs, because the app calls the test project "STAGING" (via
`VITE_APP_ENV` in `.env.local`) while this file calls it the test project --
same database, and the names have caused confusion:

    test / "staging"   uizvyziucufrkdxinzda   <- .env.local, npm run dev
    production         eviwieggwuweqezkrtli   <- .env

`docs/STAGING.md` describes a separate staging Supabase + Vercel pair that
was never stood up (`.vercel-staging.env` does not exist). Local dev against
the test project is the working path.

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

### DONE 2026-09-07 -- correcting a recorded count

`stock_counts` had been INSERT-only since the schema was written, so a count
keyed as 70 instead of 7 could never be fixed. Append-only was protecting
auditability; a history table plus triggers keeps that while giving normal
edit UX -- the trade the delivery update policies already make.

`supabase/add_stock_count_correction.sql`:
  - `stock_count_history` -- previous values, who replaced them, when, why.
    No FK to stock_counts and item_type_id denormalised, so history outlives
    the row it describes; otherwise a delete erases the evidence of itself.
  - `record_stock_count_history()` BEFORE UPDATE/DELETE. SECURITY DEFINER, so
    the audit write cannot fail on RLS or be bypassed by the person doing the
    correcting. The history table has NO write policy at all -- only the
    trigger writes there.
  - `correct_stock_count()` -- transactional. For a lot-tracked item the
    count row and `lots.quantity_remaining` must agree, and only the NEWEST
    count for a lot may move that balance. Returns `stock_changed` so the UI
    can say which happened.
  - UPDATE policy for admin + lab_manager.

The reason travels from RPC to trigger through a transaction-local setting
(`set_config('app.correction_reason', ..., true)`), because it describes the
correction, not the row being replaced. Verified working.

UI: `components/inventory/CountActions.tsx`, on the item's count history.
The dialog states the consequence BEFORE saving -- amber for the newest
count ("will change current stock", with a `4 -> 7` preview), grey for an
older one ("history and burn rate only"). Without that, people fix a number,
see nothing change, and fix it again. Reason is optional.

Verified on test 2026-09-07: RPC via `supabase/test_correct_stock_count.sql`
(6/6 assertions); both UI branches driven through the app; stock moved on the
newest correction and did not on the older; `replaced_by` populated through a
real session (the SQL editor runs as postgres with auth.uid() null, so this
could only be proven in-app); as a tech the pencil column is absent entirely
while "Modifier" and "Comptage rapide" remain.

Still untested: a tech calling `correct_stock_count` directly, bypassing the
UI. Covered by the UPDATE policy, not exercised.

**Missed on the first pass:** the migration granted only `execute` on the
function, never table privileges on `stock_count_history`. Every sibling
migration here does that (see `add_disposals_table.sql`) -- RLS is only
consulted once a GRANT lets the role touch the table at all. It went
unnoticed because the test project's default privileges are permissive
enough to cover it and production's are not, so the same SQL produced
different privileges on the two databases. Symptom on production: the
`(corrigé)` marker silently vanishes -- corrections still apply, because the
SECURITY DEFINER trigger writes as the owner, but reading history fails and
`useItemCountHistory` defaults to `[]`. Grants added to the migration
2026-09-07; re-run it on both projects.

Worth remembering generally: do not assume two Supabase projects grant the
same privileges for an identically-created table. Probe with an anon REST
call -- `permission denied for table X` proves the table exists but is
ungranted, which is a different failure from a missing table.

### DONE 2026-09-07 -- deleting a count (v0.22.0)

Deferred from the above, then requested straight away: a duplicate entry is a
row that should never have existed, and correcting it would leave an invented
number in the record.

`supabase/add_stock_count_delete.sql` -- DELETE policy for admin +
lab_manager, and `delete_stock_count(p_count_id, p_reason)`. The history
trigger already fired on DELETE, so history needed no change.

The lot unwind, which is why this was deferred, resolves cleanly:

    next-newest count for that lot  ->  its quantity
    no count left for that lot      ->  lots.quantity_initial

`quantity_initial` is the total ever delivered into that lot identity
(`useUpsertLot` adds to it on each delivery), so the fallback is not a guess
-- it is exactly where a never-counted lot already sits, and what
current_stock would show for one. It assumes nothing was consumed since
delivery, which is unknowable without a count and is the assumption the
system already makes for uncounted lots.

Deleted counts are listed under the count history on ItemDetail (date,
quantity, who, reason). Without that the row simply vanishes and the audit
record in `stock_count_history` is invisible, which would defeat the point of
keeping it.

Verified on test 2026-09-07: `supabase/test_delete_stock_count.sql` (all
three paths -- item-level, lot with an earlier count, lot with none left);
then driven through the app as lab_manager. Item-level delete moved stock
7 -> 4 and left the row listed below the table with its reason. Per-lot
delete on a real lot restored `quantity_remaining` 240 -> 250, exactly
`quantity_initial`, with the lot-specific warning shown beforehand. Legacy
aggregate rows offer neither pencil nor bin.

Shipped to production 2026-09-07 (v0.22.0); presence of `delete_stock_count`
confirmed by probe, not assumed.

Left behind on the test project: real corrections on "Abaisse-langue"
(now 7 and 2) plus two history rows.

### Two things learned, worth keeping

**Several sessions completing on one target_date is normal here** -- 5 on
2026-08-12, 4 on 2026-08-13. Not an anomaly; it looks like a campaign split
across rooms or categories. Two consequences:
  - The `session_id` backfill in stage 1 assumed collisions were rare and
    only attributed unambiguous dates, so it linked 5 of 273 rows on test.
    Harmless -- new rows get `session_id` from the RPC directly -- but
    historical rows are essentially all unattributed. A stronger backfill is
    possible by joining through `inventory_session_entries` on
    (item_type_id, counted_quantity); not done, and a wrong attribution is
    worse than none.
  - It caused a real bug: `rollUpCounts` grouped by `counted_at` alone and
    took whichever row the array ended on. Fixed in v0.20.1 by breaking ties
    on `created_at`, matching how `current_stock` already ordered.

**`npx tsc --noEmit` checks nothing.** It resolves to the root
project-references tsconfig. 14 type errors in the correction work went
unreported until `tsc -b` ran. Use `npm run build`. CLAUDE.md corrected.

## 3c. Stage 2 -- one stock mechanism  ** not started **

`current_stock` still has two branches: non-tracked items derive stock from
counts, tracked items from `lots.quantity_remaining`. Stage 1 made the count
rows uniform; stage 2 would make the *view* uniform, deriving tracked stock
from the latest count per lot and demoting `quantity_remaining` to a cache.

Not scheduled, and bigger than it sounds: `quantity_remaining` is written
from four places (delivery upsert, the session RPC, the ad-hoc count form,
discard), so demoting it means turning each into an event the view reads.
Do the count correction above first -- it does not depend on this.

## 7. Weekly digest email  ** live since 2026-09-09 **

Requested 2026-09-07: a Monday email covering maintenance overdue/upcoming,
low stock, expired and expiring lots, items not counted in a while, and
"strange numbers". The first five shipped; anomaly detection was explicitly
deferred and is NOT built (`buildAnomalies` in stockCalc.ts predates this and
is unrelated to the digest).

Cron `0 4 * * 1` in vercel.json -- 04:00 UTC is 06:00 in Uvira. First
automatic run: Monday 2026-09-14.

First real send went to all 7 recipients on 2026-09-09, triggered manually,
reported as successful. That send stamped the alert columns, so from Monday
onward NOUVEAU marks only newly-appearing problems rather than everything.
Not independently verified -- CRON_SECRET is a Vercel "sensitive" variable
and cannot be read back, so every send is triggered by a human and the
response is the only evidence.

### Shape

Detection lives in `src/lib/alerts.ts`, shared with Dashboard.tsx so the
email and the screen cannot disagree. Rendering is `src/lib/digestEmail.ts`
(French; `?lang=en` works). `api/weekly-digest.ts` does the I/O. All three
avoid the `@/` alias -- see the build note below.

  GET /api/weekly-digest?dry=1              renders, sends nothing
  GET /api/weekly-digest?dry=1&format=json  counts + recipient list
  GET /api/weekly-digest?to=<email>         real send to one person

All require `Authorization: Bearer $CRON_SECRET`. Vercel supplies that header
automatically on cron invocations when CRON_SECRET is set. `?to=` refuses any
address that is not already an active admin/lab_manager, and deliberately
does NOT stamp the alert columns -- one test would otherwise mark all current
alerts announced and strip every NOUVEAU badge from the real run.

Recipients are active `admin` + `lab_manager` profiles. On 2026-09-09 that
resolved to 7 people across UNIGE, LSHTM, Oxfam and one gmail address. Nobody
explicitly chose that list; it is a side effect of role assignment. A
`profiles.digest_opt_in` toggle on the Users page is the obvious next step
and is NOT built.

`maintenance_schedules.last_alerted_at` and `item_types.low_stock_alerted_at`
existed since the original schema and had never been written by anything.
The digest stamps them after a successful send, so a row reported for the
first time renders NOUVEAU and afterwards does not. No migration was needed.
Lots have no equivalent column, so expiry rows carry no badge.

### Two things this cost, worth keeping

**`npm run build` cannot catch an ESM resolution failure.** The first deploy
returned FUNCTION_INVOCATION_FAILED on every request:

    ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/src/lib/alerts'

package.json is `"type": "module"` and Vercel transpiles each api/ file
without rewriting import specifiers, so extensionless relative imports that
Vite resolves happily are unresolvable to Node in Lambda. Runtime imports in
the shared chain now carry explicit `.js`. `vercel build` did not catch it
either -- it printed "Build completed successfully" while emitting an
unrelated wall of TS errors. The check that works, and the one to run before
trusting a deploy of this function:

    npx vercel build --prod --yes
    cd .vercel/output/functions/api/weekly-digest.func
    node -e "import('./api/weekly-digest.js')"

`tsconfig.api.json` now puts api/ under `tsc -b` (it was outside every
`include` and had never been typechecked). It omits the `@/*` alias on
purpose, so an aliased import in shared code fails the build rather than
404ing in production -- verified by deliberately introducing one.

**Real data broke the layout in a way fixtures did not.** The first
production dry run showed 9 of 12 expiring rows were one delivery of
Bioperfectus Cholera Kits, lot numbers T20251000300205-213, one boîte each,
same expiry. Lots sharing item+manufacturer+expiry now collapse to one row
carrying every lot number and the summed quantity. Section headings still
report the true lot count, so Section tracks `hiddenRows` separately from
`total`.

A fixture preview also caught buildDigest passing a placeholder quantity of 0
on rebuilt stale rows, which rendered every stale item as empty --
"Éthanol 96%: 0 boîtes" for an item holding 40. Regression test added.

### Known gaps

- The stale section is capped at 10 rows of 26. Capping harder (5) was
  suggested and not done; the /alerts page now makes the full list one click
  away, so the cap costs less than it did.
- **26 stale items, roughly half with `min_threshold = 0`** -- created,
  never given a threshold, never counted. findLowStock ignores them
  (nothing is below zero), so stale is the only place they surface. Whether
  to demote or exclude them is undecided; excluding would hide things like
  "Master mix, 0 plaquettes, jamais compté", which looks worth knowing.
- The sending domain (mail.diseasedynamics.ch) is new and has no reputation.
  Deliverability to LSHTM and Oxfam addresses in particular is unproven; if
  someone reports not receiving it, check their spam folder before assuming
  the job failed.
- The /alerts page has never been checked against real data by anyone who
  wrote it. It typechecks and its deep links are tested, but the layout of a
  26-row stale section has not been seen.
- Lot-number sorting is lexicographic, correct only because these numbers are
  fixed-width.
- No test covers api/weekly-digest.ts itself. alerts.ts and digestEmail.ts
  are covered (219 tests); the I/O layer is exercised only by real requests.

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

Re-measured 2026-09-07 rather than carried over from the audit:

- 15 ESLint errors + 2 warnings, mostly `react-hooks/set-state-in-effect`.
  Unchanged since the audit.
- 16 npm advisories, 10 of them high: brace-expansion, browserslist,
  fast-uri, hono, ip-address, js-yaml, nanoid, postcss and others. The audit
  said "chiefly react-router-dom"; that is no longer what they are, so check
  before acting on the old description.
- 1.04 MB main bundle (`dist/assets/index-*.js`), still unsplit. It has grown
  with each of v0.20-v0.22.
- Root `package.json` / `package-lock.json` and 104 MB of `node_modules` sit
  above this project and mask missing subproject dependencies through upward
  resolution — which is exactly how the missing `vitest` dependency stayed
  hidden. Remove them.
