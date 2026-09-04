-- ============================================================
-- Read-only checks for add_stock_count_lot_provenance.sql.
-- Safe to run anywhere, any number of times: selects only.
-- Run each block and compare against what it says to expect.
-- ============================================================

-- 1. Columns landed.
--    Expect 4 rows: is_legacy_aggregate, lot_id, session_id, counted_by_user_id.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'stock_counts'
  and column_name in ('lot_id', 'session_id', 'counted_by_user_id', 'is_legacy_aggregate')
order by column_name;

-- 2. Backfill shape.
--    legacy_aggregates should be roughly one row per lot-tracked item per
--    completed session. with_session should be most rows; the rest are
--    ad-hoc counts, which correctly have no session.
select
  count(*)                                          as total_rows,
  count(*) filter (where session_id is not null)    as with_session,
  count(*) filter (where lot_id is not null)        as per_lot,
  count(*) filter (where is_legacy_aggregate)       as legacy_aggregates,
  count(*) filter (where counted_by is not null)    as with_declared_name,
  count(*) filter (where counted_by_user_id is not null) as with_account
from stock_counts;

-- 3. Sessions the backfill could not attribute, because two completed
--    sessions share a target_date. Expect 0 rows on a small history; any
--    rows here are counts left with session_id null on purpose.
select s.target_date, count(*) as completed_sessions_that_day
from inventory_sessions s
where s.status = 'completed'
group by s.target_date
having count(*) > 1
order by s.target_date;

-- 4. Nothing should be BOTH a real per-lot count and a legacy aggregate.
--    Expect 0.
select count(*) as contradictory_rows
from stock_counts
where lot_id is not null and is_legacy_aggregate;

-- 5. Lot-tracked items whose newest count is still an aggregate: these are
--    items not yet counted since the migration. They will start producing
--    per-lot rows at their next session or quick count. Informational.
select it.name, max(sc.counted_at) as last_counted
from stock_counts sc
join item_types it on it.id = sc.item_type_id
where it.track_lots
group by it.name
having bool_and(sc.lot_id is null)
order by it.name;

-- 6. current_stock still returns one row per item, no nulls in quantity.
--    Expect items = item_types count, null_quantities = 0.
select
  (select count(*) from item_types)              as item_types,
  (select count(*) from current_stock)           as items,
  (select count(*) from current_stock
     where quantity is null)                     as null_quantities;
