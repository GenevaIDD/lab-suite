-- ============================================================
-- Fix: current_stock view ignored lot-tracked items.
--
-- Symptom: a lot-tracked item shows "Stock actuel: 0 / Jamais compté"
-- even though its Lots list has remaining quantity. The production view
-- predated lot-tracking and only computed stock as (last manual count +
-- deliveries since), which is always 0 for lot-tracked items.
--
-- This recreates the view with two branches:
--   - non-tracked items: last count + deliveries since (original logic)
--   - lot-tracked items: sum of active (non-exhausted) lot quantities
--
-- Safe: create-or-replace, read-only view. Run once in the SQL Editor.
-- ============================================================

create or replace view current_stock as
with latest_count as (
  select distinct on (item_type_id)
    item_type_id,
    quantity   as count_qty,
    counted_at
  from stock_counts
  order by item_type_id, counted_at desc
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
    it.id                                   as item_type_id,
    it.name,
    it.category,
    it.unit,
    it.min_threshold,
    coalesce(sum(l.quantity_remaining), 0)  as quantity,
    max(l.created_at)::timestamptz          as last_counted_at
  from item_types it
  left join lots l on l.item_type_id = it.id and l.exhausted_at is null
  where it.track_lots = true
  group by it.id, it.name, it.category, it.unit, it.min_threshold
)
select * from non_tracked
union all
select * from tracked;

notify pgrst, 'reload schema';
