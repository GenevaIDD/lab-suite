-- ============================================================
-- Item observations — informal, timestamped notes staff can log
-- against an inventory item over time (who, when, optionally which
-- lot). Mirrors equipment_observations. Separate from item_types.notes
-- (a single static field) and from stock_counts.notes (tied to a count).
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

create table if not exists item_observations (
  id           uuid primary key default uuid_generate_v4(),
  item_type_id uuid not null references item_types(id) on delete cascade,
  lot_id       uuid references lots(id) on delete set null,
  note         text not null,
  created_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists io_item_idx    on item_observations(item_type_id);
create index if not exists io_created_idx on item_observations(created_at desc);

alter table item_observations enable row level security;

drop policy if exists "authenticated read item obs" on item_observations;
create policy "authenticated read item obs" on item_observations
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated write item obs" on item_observations;
create policy "authenticated write item obs" on item_observations
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "admin+lab_manager delete item obs" on item_observations;
create policy "admin+lab_manager delete item obs" on item_observations
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

grant select, insert, update, delete on item_observations to authenticated;
grant select on item_observations to anon;
grant all privileges on item_observations to service_role;

notify pgrst, 'reload schema';
