-- ============================================================
-- Equipment functional status + change history.
--   equipment.is_functional  — current state (true = working)
--   equipment_status_log      — one row per status change, with a note
--     (the issue when going down, the corrective action when going back up)
-- Run once in the Supabase SQL Editor.
-- ============================================================

alter table equipment
  add column if not exists is_functional boolean not null default true;

create table if not exists equipment_status_log (
  id            uuid primary key default uuid_generate_v4(),
  equipment_id  uuid not null references equipment(id) on delete cascade,
  is_functional boolean not null,   -- the new state this row records
  note          text,               -- issue (down) or corrective action (up)
  changed_by    text,
  changed_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists esl_equipment_idx on equipment_status_log(equipment_id);
create index if not exists esl_changed_idx   on equipment_status_log(changed_at desc);

alter table equipment_status_log enable row level security;

drop policy if exists "authenticated read equip status" on equipment_status_log;
create policy "authenticated read equip status" on equipment_status_log
  for select using (auth.role() = 'authenticated');

drop policy if exists "write equip status" on equipment_status_log;
create policy "write equip status" on equipment_status_log
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

grant select, insert, update, delete on equipment_status_log to authenticated;
grant select on equipment_status_log to anon;
grant all privileges on equipment_status_log to service_role;

notify pgrst, 'reload schema';
