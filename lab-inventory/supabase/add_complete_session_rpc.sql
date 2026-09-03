-- ============================================================
-- complete_inventory_session RPC (audit finding 2)
--
-- Replaces the client-side useCompleteSession, which performed a stock-count
-- insert, N lot updates, a second insert and finally the status update as
-- four separate round trips. Any failure midway left inventory partially
-- applied, and a retry re-inserted the stock snapshots while reapplying only
-- some lot values.
--
-- This runs all four as one transaction (a plpgsql function is atomic), and
-- guards on session status behind a row lock so a double-click or a retry
-- after a timeout is a no-op rather than a second application.
--
-- Entries are NOT passed in: inventory_session_entries already holds them,
-- persisted as each item is counted. The client's handleComplete mapped over
-- the same rows it had just fetched, so reading them here is equivalent and
-- removes the chance of client and server disagreeing about what was counted.
--
-- SECURITY INVOKER: existing RLS policies on stock_counts, lots and
-- inventory_sessions keep applying. No privilege escalation.
-- search_path is pinned -- see fix_handle_new_user_search_path.sql for what
-- happens to a SECURITY DEFINER function without it.
--
-- Idempotent: create or replace. Safe to re-run.
-- ============================================================

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
  v_status         session_status;
  v_counted_at     timestamptz;
  v_counts_ins     int := 0;
  v_lots_upd       int := 0;
  v_snapshots_ins  int := 0;
begin
  -- Lock the session row first. Two concurrent completions serialise here;
  -- the second sees 'completed' below and returns without writing.
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

  -- The client sent new Date('YYYY-MM-DD').toISOString(), i.e. UTC midnight.
  -- Match that exactly rather than depending on the server's timezone.
  v_counted_at := p_target_date::timestamp at time zone 'UTC';

  -- 1. Non-lot entries become item-level stock counts.
  insert into stock_counts (item_type_id, quantity, counted_at, counted_by, notes)
  select e.item_type_id, e.counted_quantity, v_counted_at, e.entered_by, e.notes
  from inventory_session_entries e
  where e.session_id = p_session_id
    and e.lot_id is null
    and e.counted_quantity is not null;
  get diagnostics v_counts_ins = row_count;

  -- 2. Lot entries update the lot itself. Zero exhausts it; any non-zero
  --    correction clears a previous exhaustion.
  update lots l
  set quantity_remaining = e.counted_quantity,
      exhausted_at       = case when e.counted_quantity = 0 then now() else null end
  from inventory_session_entries e
  where e.session_id = p_session_id
    and e.lot_id     = l.id
    and e.counted_quantity is not null;
  get diagnostics v_lots_upd = row_count;

  -- 3. Lot-tracked items also get an item-level snapshot, so burn-rate has a
  --    time series. A session counts every active lot of an item, so the sum
  --    is that item's total.
  insert into stock_counts (item_type_id, quantity, counted_at, counted_by, notes)
  select e.item_type_id, sum(e.counted_quantity), v_counted_at, null, null
  from inventory_session_entries e
  where e.session_id = p_session_id
    and e.lot_id is not null
    and e.counted_quantity is not null
  group by e.item_type_id;
  get diagnostics v_snapshots_ins = row_count;

  -- 4. Only now mark it done. Reached only if everything above committed.
  update inventory_sessions
  set status       = 'completed',
      completed_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'completed',              true,
    'stock_counts_inserted',  v_counts_ins,
    'lots_updated',           v_lots_upd,
    'lot_snapshots_inserted', v_snapshots_ins
  );
end;
$$;

grant execute on function public.complete_inventory_session(uuid, date) to authenticated;

notify pgrst, 'reload schema';
