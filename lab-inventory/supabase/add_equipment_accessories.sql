-- ============================================================
-- Equipment accessories — many-to-many link between equipment records.
-- A host machine (e.g. a centrifuge) can have several accessories
-- (rotors, blocks…), and an accessory can be shared across multiple
-- hosts (e.g. one rotor used on two centrifuges). Directional:
-- host -> accessory, with a reverse "used by" view on the accessory.
-- Deleting either equipment cascades only the link row, never the
-- other piece of equipment.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

create table if not exists equipment_accessories (
  id           uuid primary key default uuid_generate_v4(),
  host_id      uuid not null references equipment(id) on delete cascade,
  accessory_id uuid not null references equipment(id) on delete cascade,
  created_at   timestamptz not null default now(),
  created_by   text,
  unique (host_id, accessory_id),
  check (host_id <> accessory_id)
);

create index if not exists ea_host_idx      on equipment_accessories(host_id);
create index if not exists ea_accessory_idx on equipment_accessories(accessory_id);

alter table equipment_accessories enable row level security;

drop policy if exists "authenticated read equip accessories" on equipment_accessories;
create policy "authenticated read equip accessories" on equipment_accessories
  for select using (auth.role() = 'authenticated');

drop policy if exists "write equip accessories" on equipment_accessories;
create policy "write equip accessories" on equipment_accessories
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  ) with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

grant select, insert, update, delete on equipment_accessories to authenticated;
grant select on equipment_accessories to anon;
grant all privileges on equipment_accessories to service_role;

notify pgrst, 'reload schema';
