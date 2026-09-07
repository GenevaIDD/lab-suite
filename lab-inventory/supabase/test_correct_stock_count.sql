-- ============================================================
-- Exercise correct_stock_count against real data. TEST PROJECT ONLY.
--
-- Picks a real lot-tracked item, inserts two per-lot counts for one of its
-- lots (an older one and a newer one), then corrects each in turn and
-- reports what happened.
--
-- Nothing is left behind: the block ends by raising an exception, which
-- rolls the whole thing back. The results arrive as the error message --
-- that is the intended output, not a failure. Look for "CORRECTION TEST".
--
-- Caveat: the SQL editor runs as postgres, so RLS is bypassed and
-- auth.uid() is null -- history rows will show replaced_by null here. This
-- proves the logic, not the policies. Exercising RLS needs the app itself,
-- signed in as a lab_manager and (to confirm refusal) as a tech.
-- ============================================================

do $$
declare
  v_lot          uuid;
  v_item         uuid;
  v_old_count    uuid;
  v_new_count    uuid;
  v_lot_start    numeric;
  v_lot_after1   numeric;
  v_lot_after2   numeric;
  v_r_old        jsonb;
  v_r_new        jsonb;
  v_r_legacy     jsonb;
  v_legacy       uuid;
  v_hist         int;
  v_hist_reason  text;
begin
  -- A real active lot on a tracked item.
  select l.id, l.item_type_id, l.quantity_remaining
    into v_lot, v_item, v_lot_start
  from lots l
  join item_types it on it.id = l.item_type_id
  where it.track_lots and l.exhausted_at is null
  limit 1;

  if v_lot is null then
    raise exception 'CORRECTION TEST: no active lot on a tracked item; cannot run';
  end if;

  -- Two counts of that lot: an older one, then a newer one.
  insert into stock_counts (item_type_id, lot_id, quantity, counted_at, counted_by)
  values (v_item, v_lot, 100, now() - interval '10 days', 'test-old')
  returning id into v_old_count;

  insert into stock_counts (item_type_id, lot_id, quantity, counted_at, counted_by)
  values (v_item, v_lot, 50, now() - interval '1 day', 'test-new')
  returning id into v_new_count;

  update lots set quantity_remaining = 50 where id = v_lot;

  -- 1. Correcting the OLDER count must not touch the lot balance.
  v_r_old := correct_stock_count(v_old_count, 90, null, null, 'test: older count');
  select quantity_remaining into v_lot_after1 from lots where id = v_lot;

  -- 2. Correcting the NEWEST count must move the lot balance.
  v_r_new := correct_stock_count(v_new_count, 7, null, null, 'test: newest count');
  select quantity_remaining into v_lot_after2 from lots where id = v_lot;

  -- 3. History captured both, with the reason carried through.
  select count(*) into v_hist
  from stock_count_history
  where stock_count_id in (v_old_count, v_new_count);

  select reason into v_hist_reason
  from stock_count_history
  where stock_count_id = v_new_count
  order by replaced_at desc limit 1;

  -- 4. A legacy aggregate must be refused.
  select id into v_legacy from stock_counts where is_legacy_aggregate limit 1;
  if v_legacy is not null then
    v_r_legacy := correct_stock_count(v_legacy, 1, null, null, 'test: should refuse');
  end if;

  raise exception E'CORRECTION TEST RESULTS\n'
    '  lot start / after older / after newest : % / % / %  (expect %, %, 7)\n'
    '  older count  -> %\n'
    '  newest count -> %\n'
    '  history rows written: %  (expect 2)\n'
    '  reason carried through: %  (expect "test: newest count")\n'
    '  legacy aggregate -> %  (expect corrected=false, reason=legacy_aggregate,\n'
    '                          or null if this project has no legacy rows)',
    v_lot_start, v_lot_after1, v_lot_after2, v_lot_start, 50,
    v_r_old, v_r_new, v_hist, v_hist_reason, v_r_legacy;
end $$;
