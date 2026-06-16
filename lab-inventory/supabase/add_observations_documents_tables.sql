-- ============================================================
-- Add equipment_observations and equipment_documents tables
-- Run once in the Supabase SQL Editor.
-- These tables were added to the app but never migrated to prod.
-- ============================================================

-- Equipment Observations
create table if not exists equipment_observations (
  id           uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  note         text not null,
  created_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists eo_equipment_idx on equipment_observations(equipment_id);
create index if not exists eo_created_idx   on equipment_observations(created_at desc);

alter table equipment_observations enable row level security;

create policy "authenticated read obs"       on equipment_observations for select using (auth.role() = 'authenticated');
create policy "authenticated write obs"      on equipment_observations for insert with check (auth.role() = 'authenticated');
create policy "admin+lab_manager delete obs" on equipment_observations for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
);

-- Equipment Documents
create table if not exists equipment_documents (
  id              uuid primary key default uuid_generate_v4(),
  equipment_id    uuid not null references equipment(id) on delete cascade,
  description     text not null,
  file_url        text not null,
  file_name       text not null,
  file_size_bytes bigint,
  uploaded_at     timestamptz not null default now(),
  uploaded_by     text
);

create index if not exists ed_equipment_idx on equipment_documents(equipment_id);

alter table equipment_documents enable row level security;

create policy "authenticated read docs"      on equipment_documents for select using (auth.role() = 'authenticated');
create policy "admin+lab_manager write docs" on equipment_documents for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
);

-- Storage buckets (safe to re-run — on conflict do nothing)
insert into storage.buckets (id, name, public) values ('equipment-photos', 'equipment-photos', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('equipment-documents', 'equipment-documents', false)
  on conflict (id) do nothing;

-- Table grants
grant select, insert, update, delete on equipment_observations to authenticated;
grant select, insert, update, delete on equipment_documents    to authenticated;

-- Storage policies (drop first to avoid duplicate-name errors on re-run)
drop policy if exists "authenticated upload photos"     on storage.objects;
drop policy if exists "authenticated read photos"       on storage.objects;
drop policy if exists "authenticated upload docs"       on storage.objects;
drop policy if exists "authenticated read docs storage" on storage.objects;

create policy "authenticated upload photos" on storage.objects
  for insert with check (bucket_id = 'equipment-photos' and auth.role() = 'authenticated');

create policy "authenticated read photos" on storage.objects
  for select using (bucket_id = 'equipment-photos' and auth.role() = 'authenticated');

create policy "authenticated upload docs" on storage.objects
  for insert with check (bucket_id = 'equipment-documents' and auth.role() = 'authenticated');

create policy "authenticated read docs storage" on storage.objects
  for select using (bucket_id = 'equipment-documents' and auth.role() = 'authenticated');

notify pgrst, 'reload schema';
