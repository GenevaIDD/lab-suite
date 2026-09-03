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
-- APPLIED 2026-09-03, both environments:
--   staging/test - no duplicates present; step 3 index created.
--   production   - two duplicate groups found and reconciled by hand (see
--                  step 2), then the step 3 index created successfully.
--                  Index creation is self-verifying: it cannot succeed while
--                  a duplicate active group remains.
--
-- The client fix shipped alongside as v0.18.2, so the constraint and the
-- corrected upsert went live together.
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
-- STEP 2 - RECONCILE DUPLICATES  ** DO NOT RUN BLIND **
--
-- An automated "merge every duplicate group by summing quantities" script
-- used to live here. It has been removed, because when this migration was
-- actually applied the production data disagreed with its central assumption.
--
-- Production had exactly two duplicate groups, and they needed OPPOSITE
-- treatment:
--
--  1. Sachets autoclave auto-adhesif (grand), Westfield medical,
--     exp 2028-10-31, lot 344416
--       Two genuine deliveries 4m19s apart, quantities 71 and 104, and BOTH
--       lots had been counted in inventory sessions (session_entries = 1 on
--       each). The quantities were independently observed, so summing them
--       is correct. Merged to 175 initial / 166 remaining.
--
--  2. 96 Wells Background plate, Applied biosystem, exp 2027-06-26,
--     lot 2606211
--       Two lots created 149 MILLISECONDS apart, from two separate delivery
--       rows, neither ever counted (session_entries = 0 on both). That is a
--       double-click on the delivery form, not a repeat delivery -- the
--       DeliveryNew submit guard keys off createDelivery.isPending, which
--       only goes true after a re-render, so a fast double-click gets two
--       submissions through.
--
--       Summing here would have recorded 2 plates where 1 was delivered.
--       The duplicate lot AND its phantom delivery row were deleted instead.
--
-- The lesson: a duplicate lot group can come from the .is() lookup bug OR
-- from a double-submitted delivery, and the correct repair is different for
-- each. Distinguish them with the drill-down below before touching anything.
--
--   - different delivery_id, minutes/days apart, both counted   -> merge
--   - near-simultaneous created_at, never counted               -> delete
--     the duplicate lot and its delivery
--
-- Always confirm against physical stock where the counts are ambiguous.
-- ------------------------------------------------------------

-- Drill-down: per-row detail for every duplicate group. rn = 1 is the oldest
-- row in each group. Read delivery_id, created_at and session_entries before
-- deciding merge vs delete.

with dup as (
  select item_type_id, manufacturer, expiry_date, coalesce(lot_number, '') as key
  from lots
  where exhausted_at is null
  group by item_type_id, manufacturer, expiry_date, coalesce(lot_number, '')
  having count(*) > 1
)
select
  it.name as item,
  l.lot_number,
  row_number() over (
    partition by l.item_type_id, l.manufacturer, l.expiry_date, coalesce(l.lot_number, '')
    order by l.created_at, l.id
  ) as rn,
  l.id as lot_id,
  l.created_at,
  l.delivery_id,
  l.quantity_initial,
  l.quantity_remaining,
  (select count(*) from inventory_session_entries e where e.lot_id = l.id) as session_entries,
  (select count(*) from item_observations o        where o.lot_id = l.id) as observations,
  (select count(*) from disposals d                where d.lot_id = l.id) as disposals
from lots l
join dup on dup.item_type_id = l.item_type_id
        and dup.manufacturer = l.manufacturer
        and dup.expiry_date  = l.expiry_date
        and dup.key          = coalesce(l.lot_number, '')
join item_types it on it.id = l.item_type_id
where l.exhausted_at is null
order by it.name, l.created_at;


-- Statements actually applied to production on 2026-09-03, kept as worked
-- examples of the two shapes. Do not re-run: these ids no longer exist.
--
--   -- merge (Sachets): survivor takes the summed quantities
--   update lots set quantity_initial = 175.00, quantity_remaining = 166.00
--   where id = '4a2421e0-7a5c-4373-a637-570cc4440ad9';
--   update inventory_session_entries set lot_id = '4a2421e0-...'
--   where lot_id = '970eb95f-...';
--   delete from lots where id = '970eb95f-...';
--
--   -- delete (plate): drop the duplicate lot and the phantom delivery
--   delete from lots      where id = '5ec6f216-...';
--   delete from deliveries where id = '053d51a0-...';

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
