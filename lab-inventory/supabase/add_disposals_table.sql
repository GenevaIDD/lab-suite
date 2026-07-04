-- ============================================================
-- Disposals — records lot stock destroyed/discarded (expired, damaged,
-- contaminated…). Kept separate from consumption so burn-rate calculations
-- can exclude disposed quantity (destroying expired stock is not usage).
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

create table if not exists disposals (
  id            uuid primary key default uuid_generate_v4(),
  item_type_id  uuid not null references item_types(id) on delete cascade,
  lot_id        uuid references lots(id) on delete set null,
  quantity      numeric(10, 2) not null,
  reason        text,                    -- 'expired' | 'damaged' | 'contaminated' | 'other'
  disposed_at   timestamptz not null default now(),
  disposed_by   text,
  created_at    timestamptz not null default now()
);

create index if not exists disp_item_idx on disposals(item_type_id);
create index if not exists disp_date_idx on disposals(disposed_at desc);

alter table disposals enable row level security;

drop policy if exists "authenticated read disposals" on disposals;
create policy "authenticated read disposals" on disposals
  for select using (auth.role() = 'authenticated');

drop policy if exists "write disposals" on disposals;
create policy "write disposals" on disposals
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech', 'lab_team'))
  );

grant select, insert, update, delete on disposals to authenticated;
grant select on disposals to anon;
grant all privileges on disposals to service_role;

notify pgrst, 'reload schema';
