-- ============================================================
-- Let tech + lab_team correct item details
-- Requested 2026-09-04. See TODO.md "misentry correction".
--
-- Staff who enter data are the ones who notice a typo, but
-- item_types was admin+lab_manager-only for update, so a
-- misspelled item could not be fixed by whoever created it.
--
-- tech + lab_team may now update item_types, EXCEPT:
--   - unit        changing it silently reinterprets every
--                 historical stock_count / delivery quantity
--                 (mL -> L rewrites the meaning of years of data)
--   - track_lots  flips where the item's stock is read from
--                 (lots.quantity_remaining vs stock_counts)
-- Both stay admin + lab_manager.
--
-- Enforcement is a BEFORE UPDATE trigger, not the policy:
-- Postgres column privileges are per-database-role, and every
-- app user shares the single `authenticated` role -- the app
-- role lives in profiles.role. So RLS grants the update and the
-- trigger rejects the fields the caller may not touch.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- 1. Allow the update at all.
drop policy if exists "tech+lab_team update item_types" on item_types;
create policy "tech+lab_team update item_types" on item_types
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('tech', 'lab_team'))
  );

-- 2. Reject the two protected fields for anyone below lab_manager.
--    security definer so the profiles lookup is not itself
--    subject to RLS; search_path pinned per Supabase guidance.
create or replace function public.guard_item_type_update()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  caller_role text;
begin
  select role into caller_role from profiles where id = auth.uid();

  -- admin + lab_manager keep full edit rights.
  if caller_role in ('admin', 'lab_manager') then
    return new;
  end if;

  if new.unit is distinct from old.unit then
    raise exception 'Changing an item unit requires the admin or lab manager role'
      using errcode = '42501';
  end if;

  if new.track_lots is distinct from old.track_lots then
    raise exception 'Changing lot tracking requires the admin or lab manager role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_item_type_update on item_types;
create trigger guard_item_type_update
  before update on item_types
  for each row execute function public.guard_item_type_update();
