-- ============================================================
-- Deleting a recorded stock count (follows add_stock_count_correction.sql)
--
-- Correcting says "this count was wrong". Deleting says "this count should
-- never have existed" -- a duplicate, typically from a double-submitted form
-- or a session run twice for the same date. Correcting a duplicate would
-- leave an invented number in the record; deleting it is the honest act.
--
-- Per-lot counts are handled too. Deleting one changes which count is newest
-- for that lot, and lots.quantity_remaining is what current_stock reads for
-- tracked items, so the balance is rebuilt to the state it would have been in
-- had the deleted count never happened:
--
--   next-newest count for that lot  ->  its quantity
--   no count left for that lot      ->  lots.quantity_initial
--
-- quantity_initial is the total ever delivered into that lot identity
-- (useUpsertLot adds to it on each delivery), which is exactly where a
-- never-counted lot already sits. So the fallback is not a guess: it is the
-- same value current_stock would show for a lot that had never been counted.
-- It does assume nothing was consumed since delivery -- unknowable without a
-- count, and the assumption the system already makes everywhere else.
--
-- The history trigger from add_stock_count_correction.sql already fires on
-- DELETE and writes operation = 'delete', so nothing is lost. This adds only
-- the policy and the guarded entry point.
--
-- Idempotent. Run on TEST first.
-- ============================================================

drop policy if exists "admin+lab_manager delete stock_counts" on stock_counts;
create policy "admin+lab_manager delete stock_counts" on stock_counts
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

-- SECURITY INVOKER: the policy above decides who may do this. The RPC exists
-- rather than a plain delete so the reason reaches the history trigger (it
-- travels through a transaction-local setting) and so the lot guard cannot
-- be bypassed by the client.
create or replace function public.delete_stock_count(
  p_count_id uuid,
  p_reason   text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row       stock_counts;
  v_prev_qty  numeric;
  v_restored  numeric;
  v_source    text := 'none';
begin
  select * into v_row from stock_counts where id = p_count_id for update;

  if not found then
    return jsonb_build_object('deleted', false, 'reason', 'count_not_found');
  end if;

  if v_row.is_legacy_aggregate then
    return jsonb_build_object('deleted', false, 'reason', 'legacy_aggregate');
  end if;

  perform set_config('app.correction_reason', coalesce(p_reason, ''), true);

  delete from stock_counts where id = p_count_id;

  -- An item-level count needs nothing further: current_stock derives from
  -- whichever count is newest, so removing one is enough.
  if v_row.lot_id is null then
    return jsonb_build_object(
      'deleted',          true,
      'deleted_quantity', v_row.quantity,
      'item_type_id',     v_row.item_type_id,
      'lot_updated',      false
    );
  end if;

  -- For a lot, rebuild the balance. Order on (counted_at, created_at) so
  -- same-day sessions resolve the way current_stock resolves them.
  select sc.quantity into v_prev_qty
  from stock_counts sc
  where sc.lot_id = v_row.lot_id
  order by sc.counted_at desc, sc.created_at desc
  limit 1;

  if v_prev_qty is not null then
    v_restored := v_prev_qty;
    v_source   := 'count';
  else
    select l.quantity_initial into v_restored from lots l where l.id = v_row.lot_id;
    v_source := 'delivery';
  end if;

  update lots
  set quantity_remaining = v_restored,
      exhausted_at       = case when v_restored = 0 then now() else null end
  where id = v_row.lot_id;

  return jsonb_build_object(
    'deleted',          true,
    'deleted_quantity', v_row.quantity,
    'item_type_id',     v_row.item_type_id,
    'lot_updated',      true,
    'restored_to',      v_restored,
    'restored_from',    v_source
  );
end;
$$;

grant execute on function public.delete_stock_count(uuid, text) to authenticated;

notify pgrst, 'reload schema';
