-- ============================================================
-- Fix: "Last counted" never moved for lot-tracked items.
--
-- Symptom (reported for the Antibiogrammes category, e.g.
-- "Acide Nalidixique 30 µg"): the item is counted in a Complete inventory
-- session, the count shows up in the item's count history, but the Inventory
-- list still shows the old date ("il y a 49j" — the day the lots were first
-- entered).
--
-- Cause: the tracked branch of current_stock computed
--   last_counted_at = max(lots.created_at)
-- i.e. when the lots were *created*, not when they were last *counted*.
-- Completing a session updates lots.quantity_remaining and writes an
-- item-level snapshot into stock_counts, but neither touches lots.created_at,
-- so the date was frozen at lot entry.
--
-- Fix: for tracked items take the latest stock_counts.counted_at when there is
-- one, and fall back to max(lots.created_at) for lots that have never been
-- counted. quantity is unchanged (still the sum of active lots).
--
-- Safe: create-or-replace, read-only view. Run once in the SQL Editor.
-- ============================================================

create or replace view current_stock as
with latest_count as (
  -- created_at breaks the tie when the same item is counted twice for the same
  -- date (a repeated session): the row entered last wins, deterministically.
  select distinct on (item_type_id)
    item_type_id,
    quantity   as count_qty,
    counted_at
  from stock_counts
  order by item_type_id, counted_at desc, created_at desc
),
deliveries_since as (
  select
    d.item_type_id,
    coalesce(sum(d.quantity), 0) as delivered_qty
  from deliveries d
  left join latest_count lc on lc.item_type_id = d.item_type_id
  where lc.counted_at is null
     or d.received_at > lc.counted_at
  group by d.item_type_id
),
non_tracked as (
  select
    it.id                                                        as item_type_id,
    it.name,
    it.category,
    it.unit,
    it.min_threshold,
    coalesce(lc.count_qty, 0) + coalesce(ds.delivered_qty, 0)  as quantity,
    lc.counted_at                                                as last_counted_at
  from item_types it
  left join latest_count lc    on lc.item_type_id = it.id
  left join deliveries_since ds on ds.item_type_id = it.id
  where it.track_lots = false
),
tracked as (
  select
    it.id                                                        as item_type_id,
    it.name,
    it.category,
    it.unit,
    it.min_threshold,
    coalesce(sum(l.quantity_remaining), 0)                       as quantity,
    coalesce(lc.counted_at, max(l.created_at)::timestamptz)      as last_counted_at
  from item_types it
  left join lots l          on l.item_type_id = it.id and l.exhausted_at is null
  left join latest_count lc on lc.item_type_id = it.id
  where it.track_lots = true
  group by it.id, it.name, it.category, it.unit, it.min_threshold, lc.counted_at
)
select * from non_tracked
union all
select * from tracked;

notify pgrst, 'reload schema';
