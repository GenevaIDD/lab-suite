-- ============================================================
-- Lot identity constraint (v0.18.1)
--
-- Background: useUpsertLot matched candidate lots with
--   .is('lot_number', <string>)
-- PostgREST's `is` operator only accepts null/true/false, so for any lot
-- WITH a lot number the filter was invalid, the error was discarded, and the
-- lookup returned no match. Every repeat delivery of an existing lot
-- therefore inserted a NEW lot row instead of merging into the existing one.
--
-- The application-side fix is in src/lib/mutations.ts (useUpsertLot). This
-- migration cleans up the duplicates that bug already created and adds the
-- database constraint that should have been backstopping it.
--
-- RUN STEP 1 ON ITS OWN FIRST AND REVIEW THE OUTPUT.
-- Steps 2 and 3 modify live stock records.
--
-- APPLIED 2026-09-03 (production): step 1 returned zero rows -- the bug
-- never fired, because it requires a second delivery matching an existing
-- lot's identity and none had been recorded. Step 2 was skipped; only the
-- step 3 index was created. Step 2 is retained for any other environment
-- that ran the affected code long enough to accumulate duplicates, and has
-- NOT been executed anywhere.
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1 — DETECTION (read-only, safe to run any time)
-- Lists every group of active lots sharing one identity key.
-- If this returns zero rows, skip step 2 and run step 3 alone.
-- ------------------------------------------------------------

select
  it.name                           as item,
  l.manufacturer,
  l.expiry_date,
  coalesce(min(l.lot_number), '(none)') as lot_number,
  count(*)                          as duplicate_rows,
  sum(l.quantity_initial)           as merged_quantity_initial,
  sum(l.quantity_remaining)         as merged_quantity_remaining,
  array_agg(l.quantity_remaining order by l.created_at) as remaining_per_row,
  array_agg(l.id order by l.created_at)                 as lot_ids
from lots l
join item_types it on it.id = l.item_type_id
where l.exhausted_at is null
group by it.name, l.item_type_id, l.manufacturer, l.expiry_date, coalesce(l.lot_number, '')
having count(*) > 1
order by count(*) desc, it.name;


-- ------------------------------------------------------------
-- STEP 2 — MERGE DUPLICATES  ** MODIFIES STOCK DATA **
--
-- For each duplicate group, the oldest lot row survives. Quantities from the
-- other rows are added to it, references from inventory_session_entries,
-- item_observations and disposals are repointed to the survivor, and the
-- redundant rows are deleted.
--
-- Summing quantity_remaining is the correct reconciliation here: inventory
-- sessions enumerate one entry per lot, so each duplicate was counted
-- independently and the sum is the true quantity on the shelf.
--
-- Wrapped in a transaction — inspect the row counts, then COMMIT or ROLLBACK.
-- ------------------------------------------------------------

begin;

create temporary table lot_merge_map on commit drop as
select
  id as duplicate_id,
  first_value(id) over (
    partition by item_type_id, manufacturer, expiry_date, coalesce(lot_number, '')
    order by created_at, id
  ) as survivor_id
from lots
where exhausted_at is null;

delete from lot_merge_map where duplicate_id = survivor_id;

-- Fold the duplicates' quantities into the survivor.
update lots l
set quantity_initial   = l.quantity_initial   + agg.add_initial,
    quantity_remaining = l.quantity_remaining + agg.add_remaining
from (
  select m.survivor_id,
         sum(d.quantity_initial)   as add_initial,
         sum(d.quantity_remaining) as add_remaining
  from lot_merge_map m
  join lots d on d.id = m.duplicate_id
  group by m.survivor_id
) agg
where l.id = agg.survivor_id;

-- Preserve history by repointing every reference to the survivor.
update inventory_session_entries e
set lot_id = m.survivor_id
from lot_merge_map m
where e.lot_id = m.duplicate_id;

update item_observations o
set lot_id = m.survivor_id
from lot_merge_map m
where o.lot_id = m.duplicate_id;

update disposals dp
set lot_id = m.survivor_id
from lot_merge_map m
where dp.lot_id = m.duplicate_id;

delete from lots
where id in (select duplicate_id from lot_merge_map);

-- Verify: this must return zero rows before you commit.
select
  item_type_id,
  manufacturer,
  expiry_date,
  coalesce(min(lot_number), '(none)') as lot_number,
  count(*)
from lots
where exhausted_at is null
group by item_type_id, manufacturer, expiry_date, coalesce(lot_number, '')
having count(*) > 1;

commit;


-- ------------------------------------------------------------
-- STEP 3 — CONSTRAINT
--
-- Enforces lot identity in the database so a concurrent delivery can no
-- longer slip a duplicate past the application's read-then-write check.
--
-- Partial: exhausted lots are excluded, so a lot number can legitimately be
-- reused after the previous batch is used up.
-- coalesce(): NULLs compare as distinct in a unique index, so without it two
-- lots with no lot number would not collide.
-- ------------------------------------------------------------

create unique index if not exists lots_identity_idx
  on lots (item_type_id, manufacturer, expiry_date, coalesce(lot_number, ''))
  where exhausted_at is null;
