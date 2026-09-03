-- ============================================================
-- Exercise complete_inventory_session against real data. TEST PROJECT ONLY.
--
-- Builds a synthetic session over one non-lot item and one real active lot,
-- calls the RPC twice, and reports what happened.
--
-- Nothing is left behind: the block ends by raising an exception, which
-- rolls the whole thing back. The results arrive as the error message --
-- that is the intended output, not a failure. Look for "RPC TEST RESULTS".
--
-- Caveat: the SQL editor runs as postgres, so RLS is bypassed here. This
-- proves the logic, not the policies. Exercising RLS needs the app itself,
-- signed in as a tech-role user.
-- ============================================================

do $$
declare
  v_session        uuid;
  v_item_nonlot    uuid;
  v_item_lot       uuid;
  v_lot            uuid;
  v_lot_before     numeric;
  v_lot_after      numeric;
  v_r1             jsonb;
  v_r2             jsonb;
  v_counts_before  int;
  v_counts_after   int;
  v_status         text;
begin
  select id into v_item_nonlot
  from item_types where track_lots = false limit 1;

  select l.id, l.item_type_id, l.quantity_remaining
    into v_lot, v_item_lot, v_lot_before
  from lots l where l.exhausted_at is null limit 1;

  if v_item_nonlot is null or v_lot is null then
    raise exception 'RPC TEST RESULTS: cannot run -- need at least one non-lot item type and one active lot. Is this the seeded test project?';
  end if;

  insert into inventory_sessions (target_date, status, started_by)
  values (current_date, 'in_progress', 'rpc-test')
  returning id into v_session;

  insert into inventory_session_entries
    (session_id, item_type_id, lot_id, sort_order, counted_quantity, entered_by, notes)
  values
    (v_session, v_item_nonlot, null,  0, 42, 'rpc-test', 'non-lot entry'),
    (v_session, v_item_lot,    v_lot, 1,  7, 'rpc-test', 'lot entry');

  select count(*) into v_counts_before from stock_counts;

  -- First call does the work; second must be refused by the status guard.
  v_r1 := complete_inventory_session(v_session, current_date);
  v_r2 := complete_inventory_session(v_session, current_date);

  select count(*) into v_counts_after from stock_counts;
  select quantity_remaining into v_lot_after from lots where id = v_lot;
  select status::text into v_status from inventory_sessions where id = v_session;

  raise exception E'RPC TEST RESULTS (rolled back):\n%',
    jsonb_pretty(jsonb_build_object(
      'first_call',              v_r1,
      'second_call',             v_r2,
      'second_call_was_noop',    (v_r2->>'reason' = 'already_completed'),
      'stock_counts_added',      v_counts_after - v_counts_before,
      'expected_counts_added',   2,
      'lot_quantity_before',     v_lot_before,
      'lot_quantity_after',      v_lot_after,
      'expected_lot_quantity',   7,
      'session_status',          v_status
    ));
end $$;
