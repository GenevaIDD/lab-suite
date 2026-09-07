-- ============================================================
-- Correcting a recorded stock count (TODO 3b, second half)
--
-- stock_counts has been INSERT-only since the schema was written, so a
-- count keyed as 70 instead of 7 could never be fixed. Append-only was
-- protecting auditability; a history table plus triggers keeps that
-- property while giving normal edit UX -- the same trade the delivery
-- update/delete policies already make.
--
-- What this adds:
--   stock_count_history      previous values, who replaced them, when, why
--   record_stock_count_history()  BEFORE UPDATE/DELETE trigger
--   UPDATE policy on stock_counts for admin + lab_manager
--   correct_stock_count()    transactional correction
--
-- DELETE is deliberately NOT granted yet. The trigger already handles it,
-- so a delete policy can be added later without reworking history. Removing
-- a count changes which count is "latest", which has to unwind the lot
-- balance -- a separate problem from correcting a number.
--
-- Idempotent. Run on the TEST project first.
-- ============================================================

-- ------------------------------------------------------------
-- 1. History
--
-- No FK to stock_counts: history must outlive the row it describes, or a
-- delete would erase the evidence of itself. item_type_id is denormalised
-- for the same reason -- the item page can still show what happened after
-- the source row is gone.
-- ------------------------------------------------------------
create table if not exists stock_count_history (
  id                  uuid primary key default uuid_generate_v4(),
  stock_count_id      uuid not null,
  item_type_id        uuid not null,
  operation           text not null check (operation in ('update', 'delete')),
  -- every mutable field of stock_counts, as it was BEFORE this change
  prev_quantity           numeric(10, 2) not null,
  prev_counted_at         timestamptz not null,
  prev_counted_by         text,
  prev_counted_by_user_id uuid,
  prev_lot_id             uuid,
  prev_notes              text,
  -- who made the change, when, and why
  replaced_at         timestamptz not null default now(),
  replaced_by         uuid references profiles(id) on delete set null,
  reason              text
);

create index if not exists sch_count_idx on stock_count_history(stock_count_id);
create index if not exists sch_item_idx  on stock_count_history(item_type_id);
create index if not exists sch_when_idx  on stock_count_history(replaced_at desc);

alter table stock_count_history enable row level security;

drop policy if exists "authenticated read stock_count_history" on stock_count_history;
create policy "authenticated read stock_count_history" on stock_count_history
  for select using (auth.role() = 'authenticated');

-- No insert/update/delete policy on purpose. Only the trigger writes here,
-- and it is SECURITY DEFINER so it does not need one. Nothing the client
-- can send will add, alter or remove a history row.

-- ------------------------------------------------------------
-- 2. Trigger
--
-- SECURITY DEFINER so the history write cannot fail on RLS and cannot be
-- bypassed by whoever is doing the correcting. search_path pinned -- see
-- fix_handle_new_user_search_path.sql for what happens without it.
--
-- The reason comes from a transaction-local setting rather than a column,
-- because it describes the correction, not the row being replaced.
-- correct_stock_count() sets it; a direct UPDATE simply records no reason.
-- ------------------------------------------------------------
create or replace function public.record_stock_count_history()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  -- A legacy aggregate summarises lots that were never individually
  -- recorded, so there is no single number a correction could mean.
  if old.is_legacy_aggregate then
    raise exception 'This is a total across lots recorded before per-lot counting; correct the lot instead'
      using errcode = '42501';
  end if;

  insert into stock_count_history (
    stock_count_id, item_type_id, operation,
    prev_quantity, prev_counted_at, prev_counted_by,
    prev_counted_by_user_id, prev_lot_id, prev_notes,
    replaced_by, reason
  ) values (
    old.id, old.item_type_id, lower(tg_op),
    old.quantity, old.counted_at, old.counted_by,
    old.counted_by_user_id, old.lot_id, old.notes,
    auth.uid(), nullif(current_setting('app.correction_reason', true), '')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists record_stock_count_history on stock_counts;
create trigger record_stock_count_history
  before update or delete on stock_counts
  for each row execute function public.record_stock_count_history();

-- ------------------------------------------------------------
-- 3. RLS: who may correct
--
-- admin + lab_manager, matching the delivery update policy. Techs and
-- lab_team can record counts but not rewrite them -- correcting history is
-- a different act from entering it.
-- ------------------------------------------------------------
drop policy if exists "admin+lab_manager update stock_counts" on stock_counts;
create policy "admin+lab_manager update stock_counts" on stock_counts
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

-- ------------------------------------------------------------
-- 4. correct_stock_count
--
-- Correcting a lot's count is two writes that must agree: the stock_counts
-- row, and lots.quantity_remaining, which is still what current_stock reads
-- for tracked items. Audit finding 2 applied an RPC to exactly this shape of
-- problem in complete_inventory_session; same treatment here. (TODO 3c would
-- remove the second write by deriving lot balances from counts.)
--
-- The lot balance is only touched when the corrected row is the NEWEST count
-- for that lot. Correcting an older count rewrites history and the burn rate
-- but must not overwrite a more recent count's value.
--
-- SECURITY INVOKER: the UPDATE policy above decides who may do this.
-- Returns what actually happened, so the UI can tell the user whether
-- displayed stock moved or only history did.
-- ------------------------------------------------------------
create or replace function public.correct_stock_count(
  p_count_id   uuid,
  p_quantity   numeric,
  p_counted_at timestamptz default null,
  p_notes      text        default null,
  p_reason     text        default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row        stock_counts;
  v_counted_at timestamptz;
  v_is_latest  boolean;
  v_lot_upd    int := 0;
begin
  if p_quantity is null or p_quantity < 0 then
    return jsonb_build_object('corrected', false, 'reason', 'invalid_quantity');
  end if;

  select * into v_row from stock_counts where id = p_count_id for update;

  if not found then
    return jsonb_build_object('corrected', false, 'reason', 'count_not_found');
  end if;

  if v_row.is_legacy_aggregate then
    return jsonb_build_object('corrected', false, 'reason', 'legacy_aggregate');
  end if;

  v_counted_at := coalesce(p_counted_at, v_row.counted_at);

  -- Is anything newer, among counts of the same thing? Compare on
  -- (counted_at, created_at) so same-day sessions order the way
  -- current_stock orders them.
  select not exists (
    select 1
    from stock_counts sc
    where sc.id <> p_count_id
      and sc.item_type_id = v_row.item_type_id
      and sc.lot_id is not distinct from v_row.lot_id
      and (sc.counted_at, sc.created_at) > (v_counted_at, v_row.created_at)
  ) into v_is_latest;

  -- Read by the history trigger; transaction-local, so it cannot leak into
  -- an unrelated statement on the same connection.
  perform set_config('app.correction_reason', coalesce(p_reason, ''), true);

  update stock_counts
  set quantity   = p_quantity,
      counted_at = v_counted_at,
      notes      = coalesce(p_notes, notes)
  where id = p_count_id;

  -- Only the newest count for a lot defines that lot's current balance.
  if v_row.lot_id is not null and v_is_latest then
    update lots
    set quantity_remaining = p_quantity,
        exhausted_at       = case when p_quantity = 0 then now() else null end
    where id = v_row.lot_id;
    get diagnostics v_lot_upd = row_count;
  end if;

  return jsonb_build_object(
    'corrected',        true,
    'was_latest',       v_is_latest,
    'lot_updated',      v_lot_upd > 0,
    'previous_quantity', v_row.quantity,
    -- true when the correction moved what the app displays as current stock
    'stock_changed',    v_is_latest
  );
end;
$$;

grant execute on function public.correct_stock_count(uuid, numeric, timestamptz, text, text) to authenticated;

notify pgrst, 'reload schema';
