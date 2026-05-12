-- ============================================================
-- Lab Inventory System — Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database.
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Enums
-- ============================================================

create type user_role as enum ('admin', 'lab_manager', 'supervisor', 'tech');
create type currency_code as enum ('USD', 'EUR', 'GBP', 'CHF', 'BIF', 'CDF');

-- ============================================================
-- Profiles (extends Supabase auth.users)
-- ============================================================

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        user_role not null default 'tech',
  created_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- Equipment
-- ============================================================

create table equipment (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  category        text not null,
  serial_number   text,
  supplier        text,
  vendor_contact  text,
  purchase_date   date,
  warranty_expiry date,
  cost            numeric(12, 2),
  currency        currency_code,
  notes           text,
  photo_urls      text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- Maintenance Schedules
-- Each equipment can have multiple maintenance schedules
-- (e.g., "quarterly filter clean", "annual calibration")
-- ============================================================

create table maintenance_schedules (
  id              uuid primary key default uuid_generate_v4(),
  equipment_id    uuid not null references equipment(id) on delete cascade,
  label           text not null,         -- e.g. "Quarterly filter clean"
  interval_days   int not null,          -- recurrence interval
  lead_days       int not null default 60, -- how many days before due to alert
  next_due        date not null,
  last_alerted_at timestamptz,
  created_at      timestamptz not null default now()
);

create index ms_equipment_idx on maintenance_schedules(equipment_id);
create index ms_next_due_idx  on maintenance_schedules(next_due);

-- ============================================================
-- Maintenance Logs
-- Record when maintenance was performed
-- ============================================================

create table maintenance_logs (
  id            uuid primary key default uuid_generate_v4(),
  schedule_id   uuid not null references maintenance_schedules(id) on delete cascade,
  equipment_id  uuid not null references equipment(id) on delete cascade,
  performed_at  date not null,
  performed_by  text,
  notes         text,
  created_at    timestamptz not null default now()
);

create index ml_equipment_idx on maintenance_logs(equipment_id);
create index ml_schedule_idx  on maintenance_logs(schedule_id);

-- ============================================================
-- Item Types
-- e.g. "2µl cryotubes", "LB Broth", "Nitrile gloves (M)"
-- ============================================================

create table item_types (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  category            text not null,   -- e.g. "consumables", "reagents", "PPE"
  unit                text not null,   -- e.g. "boxes", "mL", "units"
  min_threshold       numeric(10, 2) not null default 0,
  low_stock_alerted_at timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- Item Sources
-- Different manufacturers/suppliers for the same item type
-- Stock is pooled; source is recorded per-delivery only
-- ============================================================

create table item_sources (
  id            uuid primary key default uuid_generate_v4(),
  item_type_id  uuid not null references item_types(id) on delete cascade,
  manufacturer  text not null,
  supplier      text,
  notes         text,
  created_at    timestamptz not null default now()
);

create index is_item_type_idx on item_sources(item_type_id);

-- ============================================================
-- Stock Counts
-- Ad-hoc physical count; one record per item per lab per audit
-- ============================================================

create table stock_counts (
  id            uuid primary key default uuid_generate_v4(),
  item_type_id  uuid not null references item_types(id) on delete cascade,
  quantity      numeric(10, 2) not null,
  counted_at    timestamptz not null default now(),
  counted_by    text,
  notes         text,
  created_at    timestamptz not null default now()
);

create index sc_item_type_idx on stock_counts(item_type_id);
create index sc_counted_at_idx on stock_counts(counted_at desc);

-- ============================================================
-- Deliveries
-- Incoming stock; records source/manufacturer per delivery
-- ============================================================

create table deliveries (
  id              uuid primary key default uuid_generate_v4(),
  item_type_id    uuid not null references item_types(id) on delete cascade,
  item_source_id  uuid references item_sources(id) on delete set null,
  quantity        numeric(10, 2) not null,
  lot_number      text,
  expiry_date     date,
  received_at     timestamptz not null default now(),
  received_by     text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index dv_item_type_idx on deliveries(item_type_id);
create index dv_received_at_idx on deliveries(received_at desc);

-- ============================================================
-- Inventory Sessions
-- A guided multi-item count session (monthly inventory walk)
-- ============================================================

create type session_status as enum ('in_progress', 'paused', 'completed', 'cancelled');

create table inventory_sessions (
  id            uuid primary key default uuid_generate_v4(),
  target_date   date not null,
  status        session_status not null default 'in_progress',
  started_by    text,
  paused_at     timestamptz,
  completed_at  timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);

create index is_status_idx on inventory_sessions(status);

create table inventory_session_entries (
  id               uuid primary key default uuid_generate_v4(),
  session_id       uuid not null references inventory_sessions(id) on delete cascade,
  item_type_id     uuid not null references item_types(id) on delete cascade,
  sort_order       int not null,
  counted_quantity numeric(10, 2),   -- null until entered
  entered_at       timestamptz,
  entered_by       text,
  notes            text,
  created_at       timestamptz not null default now()
);

create index ise_session_idx on inventory_session_entries(session_id);
create index ise_sort_idx    on inventory_session_entries(session_id, sort_order);

-- ============================================================
-- View: current stock per item type
-- Sums the latest count + all deliveries received since
-- ============================================================

create or replace view current_stock as
with latest_count as (
  -- Most recent physical count per item (may not exist for new items)
  select distinct on (item_type_id)
    item_type_id,
    quantity   as count_qty,
    counted_at
  from stock_counts
  order by item_type_id, counted_at desc
),
deliveries_since as (
  -- Deliveries received after the latest count, OR all deliveries if no count exists
  select
    d.item_type_id,
    coalesce(sum(d.quantity), 0) as delivered_qty
  from deliveries d
  left join latest_count lc on lc.item_type_id = d.item_type_id
  where lc.counted_at is null            -- no count yet → include all deliveries
     or d.received_at > lc.counted_at   -- count exists → only deliveries after it
  group by d.item_type_id
)
select
  it.id                                                        as item_type_id,
  it.name,
  it.category,
  it.unit,
  it.min_threshold,
  coalesce(lc.count_qty, 0) + coalesce(ds.delivered_qty, 0)  as quantity,
  lc.counted_at                                                as last_counted_at
from item_types it
left join latest_count lc    on lc.item_type_id = it.id
left join deliveries_since ds on ds.item_type_id = it.id;

-- ============================================================
-- RLS Policies
-- ============================================================

alter table profiles            enable row level security;
alter table equipment           enable row level security;
alter table maintenance_schedules enable row level security;
alter table maintenance_logs    enable row level security;
alter table item_types          enable row level security;
alter table item_sources        enable row level security;
alter table stock_counts           enable row level security;
alter table deliveries             enable row level security;
alter table inventory_sessions     enable row level security;
alter table inventory_session_entries enable row level security;

-- All authenticated users can read everything
create policy "authenticated read"  on profiles            for select using (auth.role() = 'authenticated');
create policy "authenticated read"  on equipment           for select using (auth.role() = 'authenticated');
create policy "authenticated read"  on maintenance_schedules for select using (auth.role() = 'authenticated');
create policy "authenticated read"  on maintenance_logs    for select using (auth.role() = 'authenticated');
create policy "authenticated read"  on item_types          for select using (auth.role() = 'authenticated');
create policy "authenticated read"  on item_sources        for select using (auth.role() = 'authenticated');
create policy "authenticated read"  on stock_counts        for select using (auth.role() = 'authenticated');
create policy "authenticated read"  on deliveries           for select using (auth.role() = 'authenticated');

-- admin + lab_manager: full data CRUD. tech: inserts only for logs/counts/deliveries.
-- admin additionally controls user management (enforced in UI, not RLS).

create policy "admin+lab_manager write equipment" on equipment
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

create policy "admin+lab_manager write schedules" on maintenance_schedules
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

create policy "admin+lab_manager+tech write logs" on maintenance_logs
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech'))
  );

create policy "admin+lab_manager write item_types" on item_types
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

create policy "admin+lab_manager write item_sources" on item_sources
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

create policy "admin+lab_manager+tech write stock_counts" on stock_counts
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech'))
  );

create policy "admin+lab_manager+tech write deliveries" on deliveries
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech'))
  );

-- Inventory sessions: all authenticated can read; admin+lab_manager+tech can create/update
create policy "authenticated read sessions"   on inventory_sessions for select using (auth.role() = 'authenticated');
create policy "authenticated read entries"    on inventory_session_entries for select using (auth.role() = 'authenticated');
create policy "admin+lab_manager+tech write sessions" on inventory_sessions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech'))
  );
create policy "admin+lab_manager+tech write entries" on inventory_session_entries
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech'))
  );

-- ============================================================
-- Storage bucket for equipment photos
-- ============================================================

insert into storage.buckets (id, name, public) values ('equipment-photos', 'equipment-photos', false)
  on conflict (id) do nothing;

-- ============================================================
-- Table grants (required alongside RLS policies)
-- ============================================================

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on all tables in schema public to anon;

-- ============================================================
-- Storage bucket for equipment photos (continued)
-- ============================================================

drop policy if exists "authenticated upload photos" on storage.objects;
drop policy if exists "authenticated read photos" on storage.objects;

create policy "authenticated upload photos" on storage.objects
  for insert with check (bucket_id = 'equipment-photos' and auth.role() = 'authenticated');

create policy "authenticated read photos" on storage.objects
  for select using (bucket_id = 'equipment-photos' and auth.role() = 'authenticated');
