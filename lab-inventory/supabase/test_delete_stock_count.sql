-- ============================================================
-- Exercise delete_stock_count against real data. TEST PROJECT ONLY.
--
-- Covers the three paths: an item-level count (nothing to rebuild), a per-lot
-- count with an earlier count to fall back to, and a per-lot count with none
-- left, which must fall back to the delivered quantity (lots.quantity_initial).
--
-- Nothing is left behind: the block ends by raising an exception, which rolls
-- the whole thing back. The results arrive as the error message -- that is
-- the intended output, not a failure. Look for "DELETE TEST RESULTS".
--
-- Caveat: the SQL editor runs as postgres, so RLS is bypassed and auth.uid()
-- is null. This proves the logic, not the policies.
-- ============================================================

do $$
declare
  v_lot        uuid;
  v_item       uuid;
  v_initial    numeric;
  v_item_plain uuid;
  v_c_item     uuid;
  v_c_old      uuid;
  v_c_new      uuid;
  v_r_item     jsonb;
  v_r_lot1     jsonb;
  v_r_lot2     jsonb;
  v_after1     numeric;
  v_after2     numeric;
  v_hist_del   int;
begin
  select l.id, l.item_type_id, l.quantity_initial
    into v_lot, v_item, v_initial
  from lots l join item_types it on it.id = l.item_type_id
  where it.track_lots and l.exhausted_at is null
  limit 1;

  select id into v_item_plain from item_types where not track_lots limit 1;

  if v_lot is null or v_item_plain is null then
    raise exception 'DELETE TEST: need one active lot and one non-tracked item';
  end if;

  -- 1. Item-level count: delete should touch no lot.
  insert into stock_counts (item_type_id, quantity, counted_at, counted_by)
  values (v_item_plain, 123, now() - interval '2 days', 'test-item')
  returning id into v_c_item;
  v_r_item := delete_stock_count(v_c_item, 'test: item-level duplicate');

  -- 2. Per-lot, with an earlier count left behind.
  insert into stock_counts (item_type_id, lot_id, quantity, counted_at, counted_by)
  values (v_item, v_lot, 80, now() - interval '9 days', 'test-old')
  returning id into v_c_old;
  insert into stock_counts (item_type_id, lot_id, quantity, counted_at, counted_by)
  values (v_item, v_lot, 20, now() - interval '2 days', 'test-new')
  returning id into v_c_new;
  update lots set quantity_remaining = 20 where id = v_lot;

  v_r_lot1 := delete_stock_count(v_c_new, 'test: duplicate lot count');
  select quantity_remaining into v_after1 from lots where id = v_lot;

  -- 3. Per-lot, nothing left -> falls back to the delivered quantity.
  --    (Any pre-existing counts for this lot are removed first so the
  --    fallback path is actually the one under test.)
  delete from stock_counts where lot_id = v_lot and id <> v_c_old;
  v_r_lot2 := delete_stock_count(v_c_old, 'test: last lot count');
  select quantity_remaining into v_after2 from lots where id = v_lot;

  select count(*) into v_hist_del
  from stock_count_history where operation = 'delete';

  raise exception E'DELETE TEST RESULTS\n'
    '  item-level  -> %\n'
    '     (expect deleted=true, lot_updated=false)\n'
    '  lot, earlier count exists -> %\n'
    '     lot now % (expect 80, restored_from=count)\n'
    '  lot, no count left -> %\n'
    '     lot now % (expect %, restored_from=delivery)\n'
    '  history rows with operation=delete: % (expect 3)',
    v_r_item, v_r_lot1, v_after1, v_r_lot2, v_after2, v_initial, v_hist_del;
end $$;
