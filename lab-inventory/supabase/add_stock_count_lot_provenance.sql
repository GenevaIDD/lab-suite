-- ============================================================
-- Stage 1: make a stock count describe ONE counted thing
--
-- Today stock is stored two ways. Non-tracked items keep it in
-- stock_counts; lot-tracked items keep it in lots.quantity_remaining
-- and get an item-level SUM row written into stock_counts purely so
-- burn-rate and "last counted" have a time series. That aggregate row
-- corresponds to nothing anyone counted: it has no lot, and
-- complete_inventory_session writes it with counted_by and notes null,
-- discarding the entered_by captured on every session entry.
--
-- Consequences already paid for: fix_last_counted_lot_items.sql exists
-- because the tracked branch of current_stock had to take quantity from
-- lots and the date from stock_counts. Ad-hoc lot counts
-- (useUpdateLotCount) change a lot with no record of who or when at all.
--
-- This migration gives stock_counts the shape inventory_session_entries
-- already has -- one row per counted thing, lot as a nullable dimension:
--
--   lot_id              which lot was counted; null = item-level count
--   session_id          the session it came from; null = ad-hoc
--   counted_by_user_id  attested identity (counted_by stays as the
--                       free-text declared name, which need not match)
--   is_legacy_aggregate marks pre-migration SUM rows, which cannot be
--                       decomposed retroactively -- the per-lot detail
--                       was never captured
--
-- Stage 1 deliberately leaves lots.quantity_remaining authoritative for
-- tracked items. Merging the two branches of current_stock is stage 2.
--
-- Idempotent. Run on the TEST project first: the backfill is the part
-- that cannot be validated against an empty database.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columns
-- ------------------------------------------------------------
alter table stock_counts
  add column if not exists lot_id              uuid references lots(id)               on delete set null,
  add column if not exists session_id          uuid references inventory_sessions(id) on delete set null,
  add column if not exists counted_by_user_id  uuid references profiles(id)           on delete set null,
  add column if not exists is_legacy_aggregate boolean not null default false;

create index if not exists sc_lot_idx     on stock_counts(lot_id);
create index if not exists sc_session_idx on stock_counts(session_id);

-- Session entries record entered_by as free text. Capture the account too,
-- so the RPC can carry an attested identity onto the count it derives.
alter table inventory_session_entries
  add column if not exists entered_by_user_id uuid references profiles(id) on delete set null;

-- ------------------------------------------------------------
-- 2. Backfill session_id
--
-- complete_inventory_session writes counted_at as
-- p_target_date::timestamp at time zone 'UTC', so every row from one
-- session shares an exact midnight-UTC timestamp equal to its
-- target_date. That is the only link back that exists.
--
-- Only unambiguous matches are backfilled: where two completed sessions
-- share a target_date, rows are left null rather than guessed at. An
-- ad-hoc count that happens to land exactly on midnight UTC would be
-- mis-attributed; counted_at for ad-hoc counts comes from a date picker
-- or now(), so exact-midnight collisions are possible but rare. Review
-- the row counts this reports before running it on production.
-- ------------------------------------------------------------
with candidate as (
  select
    s.id                                        as session_id,
    (s.target_date::timestamp at time zone 'UTC') as counted_at
  from inventory_sessions s
  where s.status = 'completed'
),
unambiguous as (
  -- having count(*) = 1 means the group holds exactly one session, so the
  -- array's first element is that session. (min() has no uuid overload, and
  -- picking a "smallest" session id would be meaningless anyway.)
  select counted_at, (array_agg(session_id))[1] as session_id
  from candidate
  group by counted_at
  having count(*) = 1
)
update stock_counts sc
set session_id = u.session_id
from unambiguous u
where sc.session_id is null
  and sc.counted_at = u.counted_at;

-- ------------------------------------------------------------
-- 3. Mark the pre-migration aggregate rows
--
-- Any existing lot_id-null row belonging to a lot-tracked item is a SUM
-- across that item's lots -- written either by the session RPC (step 3
-- of the old function) or by the ad-hoc form's lot branch. Neither can
-- be split into per-lot rows now; the detail was never stored.
--
-- This reads item_types.track_lots, which is mutable, so an item whose
-- lot tracking was switched on after a count would be mis-marked. It is
-- the only signal available for historical rows, and it is applied once.
-- ------------------------------------------------------------
update stock_counts sc
set is_legacy_aggregate = true
from item_types it
where it.id = sc.item_type_id
  and it.track_lots = true
  and sc.lot_id is null
  and sc.is_legacy_aggregate = false;

-- ------------------------------------------------------------
-- 4. complete_inventory_session: one row per counted thing
--
-- Replaces the old steps 1 and 3 (item-level counts, then a separate
-- lot SUM snapshot) with a single insert carrying lot_id. Lot entries
-- still drive lots.quantity_remaining -- stage 1 keeps that
-- authoritative -- but they now also leave a per-lot count record,
-- which is the row a correction will target.
-- ------------------------------------------------------------
create or replace function public.complete_inventory_session(
  p_session_id  uuid,
  p_target_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status     session_status;
  v_counted_at timestamptz;
  v_counts_ins int := 0;
  v_lots_upd   int := 0;
begin
  select status into v_status
  from inventory_sessions
  where id = p_session_id
  for update;

  if not found then
    return jsonb_build_object('completed', false, 'reason', 'session_not_found');
  end if;

  if v_status = 'completed' then
    return jsonb_build_object('completed', false, 'reason', 'already_completed');
  end if;

  v_counted_at := p_target_date::timestamp at time zone 'UTC';

  -- 1. Lot entries still set the lot balance. Zero exhausts it; any
  --    non-zero correction clears a previous exhaustion.
  update lots l
  set quantity_remaining = e.counted_quantity,
      exhausted_at       = case when e.counted_quantity = 0 then now() else null end
  from inventory_session_entries e
  where e.session_id = p_session_id
    and e.lot_id     = l.id
    and e.counted_quantity is not null;
  get diagnostics v_lots_upd = row_count;

  -- 2. Every entry -- lot or not -- becomes exactly one stock count.
  --    lot_id carries through, so a tracked item now has per-lot history
  --    instead of one anonymous SUM.
  insert into stock_counts (
    item_type_id, lot_id, session_id, quantity, counted_at,
    counted_by, counted_by_user_id, notes
  )
  select
    e.item_type_id, e.lot_id, p_session_id, e.counted_quantity, v_counted_at,
    e.entered_by, e.entered_by_user_id, e.notes
  from inventory_session_entries e
  where e.session_id = p_session_id
    and e.counted_quantity is not null;
  get diagnostics v_counts_ins = row_count;

  -- 3. Only now mark it done.
  update inventory_sessions
  set status       = 'completed',
      completed_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'completed',             true,
    'stock_counts_inserted', v_counts_ins,
    'lots_updated',          v_lots_upd
  );
end;
$$;

grant execute on function public.complete_inventory_session(uuid, date) to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 5. current_stock: make latest_count mean what it says
--
-- Not a behaviour change -- it is hardening. With per-lot rows present,
-- the old latest_count (distinct on item_type_id, no lot filter) could
-- return a single lot's quantity as though it were the item's count.
-- Nothing reads it that way today: the non_tracked branch only sees
-- items that have no lot rows, and the tracked branch uses only the
-- date. But the CTE is now one filter away from silently understating
-- a tracked item, so split the two uses apart while the reason is fresh.
--
--   latest_item_count -- item-level rows only; quantity + date for
--                        non-tracked items
--   latest_count_date -- newest count of any kind; the "last counted"
--                        date for tracked items, whose quantity still
--                        comes from lots (stage 2 merges these)
-- ------------------------------------------------------------
create or replace view current_stock as
with latest_item_count as (
  -- created_at breaks the tie when the same item is counted twice for the
  -- same date (a repeated session): the row entered last wins.
  select distinct on (item_type_id)
    item_type_id,
    quantity as count_qty,
    counted_at
  from stock_counts
  where lot_id is null
  order by item_type_id, counted_at desc, created_at desc
),
latest_count_date as (
  select item_type_id, max(counted_at) as counted_at
  from stock_counts
  group by item_type_id
),
deliveries_since as (
  select
    d.item_type_id,
    coalesce(sum(d.quantity), 0) as delivered_qty
  from deliveries d
  left join latest_item_count lc on lc.item_type_id = d.item_type_id
  where lc.counted_at is null
     or d.received_at > lc.counted_at
  group by d.item_type_id
),
non_tracked as (
  select
    it.id                                                       as item_type_id,
    it.name,
    it.category,
    it.unit,
    it.min_threshold,
    coalesce(lc.count_qty, 0) + coalesce(ds.delivered_qty, 0)   as quantity,
    lc.counted_at                                               as last_counted_at
  from item_types it
  left join latest_item_count lc on lc.item_type_id = it.id
  left join deliveries_since ds  on ds.item_type_id = it.id
  where it.track_lots = false
),
tracked as (
  select
    it.id                                                       as item_type_id,
    it.name,
    it.category,
    it.unit,
    it.min_threshold,
    coalesce(sum(l.quantity_remaining), 0)                      as quantity,
    coalesce(lcd.counted_at, max(l.created_at)::timestamptz)    as last_counted_at
  from item_types it
  left join lots l              on l.item_type_id = it.id and l.exhausted_at is null
  left join latest_count_date lcd on lcd.item_type_id = it.id
  where it.track_lots = true
  group by it.id, it.name, it.category, it.unit, it.min_threshold, lcd.counted_at
)
select * from non_tracked
union all
select * from tracked;

notify pgrst, 'reload schema';
