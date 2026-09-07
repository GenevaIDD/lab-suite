-- ============================================================
-- Lab Inventory System — Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database.
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Enums
-- ============================================================

create type user_role as enum ('admin', 'lab_manager', 'tech', 'lab_team');
create type currency_code as enum ('USD', 'EUR', 'GBP', 'CHF', 'BIF', 'CDF');

-- ============================================================
-- Profiles (extends Supabase auth.users)
-- ============================================================

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        user_role not null default 'tech',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Auto-create profile on signup
-- search_path must be pinned: the trigger fires inside the auth service's
-- session, whose search_path excludes `public`, so an unqualified
-- `insert into profiles` cannot resolve and user creation fails with
-- "Database error creating new user". See fix_handle_new_user_search_path.sql.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
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
  manufacturer    text,
  model           text,
  serial_number   text,
  supplier        text,
  vendor_contact  text,
  purchase_date   date,
  warranty_expiry date,
  installed_at    date,
  cost            numeric(12, 2),
  currency        currency_code,
  notes           text,
  is_functional   boolean not null default true,
  retired_at              date,
  retirement_reason       text,
  retirement_destination  text,
  retirement_recipient    text,
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
  schedule_id   uuid references maintenance_schedules(id) on delete cascade,  -- null = ad-hoc/unscheduled

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
  track_lots          boolean not null default false,  -- if true, track lots with expiry/manufacturer
  storage_condition   text check (storage_condition in ('ambient', 'refrigerator', 'freezer')),
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

-- One row per counted thing. lot_id is the dimension, not a second store:
-- null means an item-level count (every non-tracked item, plus pre-migration
-- aggregates). See supabase/add_stock_count_lot_provenance.sql.
create table stock_counts (
  id                  uuid primary key default uuid_generate_v4(),
  item_type_id        uuid not null references item_types(id) on delete cascade,
  lot_id              uuid,   -- fk added after lots is created, below
  session_id          uuid,   -- fk added after inventory_sessions is created, below
  quantity            numeric(10, 2) not null,
  counted_at          timestamptz not null default now(),
  counted_by          text,               -- declared name, free text
  counted_by_user_id  uuid references profiles(id) on delete set null,
  -- A SUM across an item's lots, written before per-lot counts existed. The
  -- per-lot detail was never captured, so these can never be decomposed and
  -- must not be offered for correction.
  is_legacy_aggregate boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now()
);

create index sc_item_type_idx on stock_counts(item_type_id);
create index sc_counted_at_idx on stock_counts(counted_at desc);
create index sc_lot_idx on stock_counts(lot_id);
create index sc_session_idx on stock_counts(session_id);

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

-- ============================================================
-- Lots
-- Tracks individual batches for items with track_lots = true.
-- Lot identity: (item_type_id, manufacturer, expiry_date, lot_number?)
-- quantity_remaining is maintained: updated on each inventory count.
-- exhausted_at set when count = 0; cleared when corrected to non-zero.
-- ============================================================

create table lots (
  id                 uuid primary key default uuid_generate_v4(),
  item_type_id       uuid not null references item_types(id) on delete cascade,
  delivery_id        uuid references deliveries(id) on delete set null,
  manufacturer       text not null,
  expiry_date        date not null,
  lot_number         text,
  quantity_initial   numeric(10, 2) not null,
  quantity_remaining numeric(10, 2) not null default 0,
  exhausted_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index lots_item_idx     on lots(item_type_id);
create index lots_active_idx   on lots(item_type_id) where exhausted_at is null;
create index lots_expiry_idx   on lots(expiry_date) where exhausted_at is null;

-- Lot identity. Partial so a lot number can be reused once the previous
-- batch is exhausted; coalesce() because NULLs compare as distinct in a
-- unique index, which would let unnumbered lots duplicate freely.
create unique index lots_identity_idx
  on lots (item_type_id, manufacturer, expiry_date, coalesce(lot_number, ''))
  where exhausted_at is null;

create table inventory_session_entries (
  id               uuid primary key default uuid_generate_v4(),
  session_id       uuid not null references inventory_sessions(id) on delete cascade,
  item_type_id     uuid not null references item_types(id) on delete cascade,
  lot_id           uuid references lots(id) on delete set null,  -- null for non-tracked items
  sort_order       int not null,
  counted_quantity numeric(10, 2),   -- null until entered
  entered_at       timestamptz,
  entered_by       text,             -- declared name, free text
  entered_by_user_id uuid references profiles(id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now()
);

create index ise_session_idx on inventory_session_entries(session_id);
create index ise_sort_idx    on inventory_session_entries(session_id, sort_order);

-- stock_counts is declared above lots and inventory_sessions (it predates
-- both), so its foreign keys are attached here, once every table exists.
alter table stock_counts
  add constraint stock_counts_lot_id_fkey
    foreign key (lot_id) references lots(id) on delete set null,
  add constraint stock_counts_session_id_fkey
    foreign key (session_id) references inventory_sessions(id) on delete set null;


-- ============================================================
-- View: current stock per item type
-- Sums the latest count + all deliveries received since
-- ============================================================

create or replace view current_stock as
-- latest_item_count is item-level rows only: a per-lot row is one lot's
-- quantity, never the item's. latest_count_date spans both kinds, because a
-- tracked item's "last counted" is the newest count of any of its lots.
-- Stage 2 will merge these two branches; see
-- supabase/add_stock_count_lot_provenance.sql.
with latest_item_count as (
  -- created_at breaks the tie when the same item is counted twice for the same
  -- date (a repeated session): the row entered last wins, deterministically.
  select distinct on (item_type_id)
    item_type_id,
    quantity as count_qty,
    counted_at
  from stock_counts
  where lot_id is null
  order by item_type_id, counted_at desc, created_at desc
),
latest_count_date as (
  select item_type_id, max(counted_at) as counted_at
  from stock_counts
  group by item_type_id
),
deliveries_since as (
  select
    d.item_type_id,
    coalesce(sum(d.quantity), 0) as delivered_qty
  from deliveries d
  left join latest_item_count lc on lc.item_type_id = d.item_type_id
  where lc.counted_at is null
     or d.received_at > lc.counted_at
  group by d.item_type_id
),
-- Non-tracked items: last count + deliveries since.
non_tracked as (
  select
    it.id                                                       as item_type_id,
    it.name,
    it.category,
    it.unit,
    it.min_threshold,
    coalesce(lc.count_qty, 0) + coalesce(ds.delivered_qty, 0)   as quantity,
    lc.counted_at                                               as last_counted_at
  from item_types it
  left join latest_item_count lc on lc.item_type_id = it.id
  left join deliveries_since ds  on ds.item_type_id = it.id
  where it.track_lots = false
),
-- Tracked items: sum of active (non-exhausted) lot quantities.
-- lots.created_at is only the fallback for lots never counted
-- (see fix_last_counted_lot_items.sql).
tracked as (
  select
    it.id                                                       as item_type_id,
    it.name,
    it.category,
    it.unit,
    it.min_threshold,
    coalesce(sum(l.quantity_remaining), 0)                      as quantity,
    coalesce(lcd.counted_at, max(l.created_at)::timestamptz)    as last_counted_at
  from item_types it
  left join lots l                on l.item_type_id = it.id and l.exhausted_at is null
  left join latest_count_date lcd on lcd.item_type_id = it.id
  where it.track_lots = true
  group by it.id, it.name, it.category, it.unit, it.min_threshold, lcd.counted_at
)
select * from non_tracked
union all
select * from tracked;

-- ============================================================
-- RLS Policies
-- ============================================================

alter table profiles            enable row level security;
alter table equipment           enable row level security;
alter table maintenance_schedules enable row level security;
alter table maintenance_logs    enable row level security;
alter table item_types          enable row level security;
alter table item_sources        enable row level security;
alter table stock_counts              enable row level security;
alter table deliveries                enable row level security;
alter table inventory_sessions        enable row level security;
alter table inventory_session_entries enable row level security;
alter table lots                      enable row level security;

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
-- admin additionally controls user management.

-- Admins can change any user's role (in-app role editing on the Users page).
create policy "admin update profiles" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

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

-- tech + lab_team may correct item details (typos, wrong category/threshold).
-- unit and track_lots stay admin+lab_manager -- see the guard_item_type_update
-- trigger below and supabase/add_tech_item_rename.sql for why.
create policy "tech+lab_team update item_types" on item_types
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('tech', 'lab_team'))
  );

create or replace function public.guard_item_type_update()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  caller_role text;
begin
  select role into caller_role from profiles where id = auth.uid();

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

create trigger guard_item_type_update
  before update on item_types
  for each row execute function public.guard_item_type_update();

create policy "admin+lab_manager write item_sources" on item_sources
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

create policy "admin+lab_manager+tech write stock_counts" on stock_counts
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech'))
  );

-- admin+lab_manager can correct a recorded count. Techs and lab_team record
-- counts but do not rewrite them. Every change is captured by the
-- record_stock_count_history trigger below.
-- See supabase/add_stock_count_correction.sql (which also holds the
-- correct_stock_count RPC, kept there like complete_inventory_session).
create policy "admin+lab_manager update stock_counts" on stock_counts
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

create policy "admin+lab_manager+tech write deliveries" on deliveries
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech'))
  );
-- admin+lab_manager can correct mistakes (update/delete a delivery)
create policy "admin+lab_manager update deliveries" on deliveries
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );
create policy "admin+lab_manager delete deliveries" on deliveries
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

-- Lots: all authenticated can read; admin+lab_manager+tech can write
create policy "authenticated read lots"    on lots for select using (auth.role() = 'authenticated');
create policy "admin+lab_manager+tech write lots" on lots
  for all using (
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

-- lab_team: insert-only on item_sources/equipment/maintenance_schedules
-- (set up new equipment, but cannot edit/retire/delete). On item_types they
-- may also update (see "tech+lab_team update item_types" above), but not delete;
-- full read/write on sessions/entries/lots/stock_counts/deliveries/maintenance_logs
-- needed to run guided inventory sessions, record deliveries and log maintenance.
-- Ad-hoc stock counts are additionally blocked in the UI (see canManageStock).

create policy "lab_team insert item_types" on item_types
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

create policy "lab_team insert item_sources" on item_sources
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

create policy "lab_team insert equipment" on equipment
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

create policy "lab_team insert schedules" on maintenance_schedules
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

create policy "lab_team write logs" on maintenance_logs
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

create policy "lab_team write deliveries" on deliveries
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

create policy "lab_team write lots" on lots
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

create policy "lab_team write sessions" on inventory_sessions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

create policy "lab_team write entries" on inventory_session_entries
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

create policy "lab_team write stock_counts" on stock_counts
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

-- ============================================================
-- Equipment Observations
-- Informal notes staff can log e.g. "freezer making noise".
-- Separate from formal maintenance logs.
-- ============================================================

create table equipment_observations (
  id           uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  note         text not null,
  created_by   text,
  created_at   timestamptz not null default now()
);

create index eo_equipment_idx on equipment_observations(equipment_id);
create index eo_created_idx   on equipment_observations(created_at desc);

alter table equipment_observations enable row level security;
create policy "authenticated read obs"       on equipment_observations for select using (auth.role() = 'authenticated');
create policy "authenticated write obs"      on equipment_observations for insert with check (auth.role() = 'authenticated');
create policy "admin+lab_manager delete obs" on equipment_observations for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
);

-- ============================================================
-- Item Observations
-- Informal, timestamped notes staff can log against an inventory item
-- over time (who, when, optionally which lot). Mirrors
-- equipment_observations.
-- ============================================================

create table item_observations (
  id           uuid primary key default uuid_generate_v4(),
  item_type_id uuid not null references item_types(id) on delete cascade,
  lot_id       uuid references lots(id) on delete set null,
  note         text not null,
  created_by   text,
  created_at   timestamptz not null default now()
);

create index io_item_idx    on item_observations(item_type_id);
create index io_created_idx on item_observations(created_at desc);

alter table item_observations enable row level security;
create policy "authenticated read item obs"       on item_observations for select using (auth.role() = 'authenticated');
create policy "authenticated write item obs"      on item_observations for insert with check (auth.role() = 'authenticated');
create policy "admin+lab_manager delete item obs" on item_observations for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
);

-- ============================================================
-- Equipment Documents
-- ============================================================

create table equipment_documents (
  id              uuid primary key default uuid_generate_v4(),
  equipment_id    uuid not null references equipment(id) on delete cascade,
  description     text not null,
  file_url        text not null,
  file_name       text not null,
  file_size_bytes bigint,
  uploaded_at     timestamptz not null default now(),
  uploaded_by     text
);

create index ed_equipment_idx on equipment_documents(equipment_id);

alter table equipment_documents enable row level security;
create policy "authenticated read docs"         on equipment_documents for select using (auth.role() = 'authenticated');
create policy "admin+lab_manager write docs"    on equipment_documents for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
);

-- ============================================================
-- Equipment status log
-- One row per functional-status change (working ⇄ not working), with a note
-- (the issue when it breaks, the corrective action when it's fixed).
-- ============================================================

create table equipment_status_log (
  id            uuid primary key default uuid_generate_v4(),
  equipment_id  uuid not null references equipment(id) on delete cascade,
  is_functional boolean not null,
  note          text,
  changed_by    text,
  changed_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index esl_equipment_idx on equipment_status_log(equipment_id);
create index esl_changed_idx   on equipment_status_log(changed_at desc);

alter table equipment_status_log enable row level security;
create policy "authenticated read equip status" on equipment_status_log for select using (auth.role() = 'authenticated');
create policy "write equip status" on equipment_status_log for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
);

-- ============================================================
-- Equipment accessories
-- Many-to-many link: a host machine can have several accessories,
-- and an accessory can be shared across multiple hosts (e.g. one
-- rotor used on two centrifuges). Directional: host -> accessory.
-- Deleting either equipment cascades only the link rows, never the
-- other piece of equipment.
-- ============================================================

create table equipment_accessories (
  id           uuid primary key default uuid_generate_v4(),
  host_id      uuid not null references equipment(id) on delete cascade,
  accessory_id uuid not null references equipment(id) on delete cascade,
  created_at   timestamptz not null default now(),
  created_by   text,
  unique (host_id, accessory_id),
  check (host_id <> accessory_id)
);

create index ea_host_idx      on equipment_accessories(host_id);
create index ea_accessory_idx on equipment_accessories(accessory_id);

alter table equipment_accessories enable row level security;
create policy "authenticated read equip accessories" on equipment_accessories for select using (auth.role() = 'authenticated');
create policy "write equip accessories" on equipment_accessories for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
);

-- ============================================================
-- Disposals
-- Records lot stock destroyed/discarded (expired, damaged, etc.).
-- Kept separate from consumption so burn-rate excludes disposed quantity.
-- ============================================================

create table disposals (
  id            uuid primary key default uuid_generate_v4(),
  item_type_id  uuid not null references item_types(id) on delete cascade,
  lot_id        uuid references lots(id) on delete set null,
  quantity      numeric(10, 2) not null,
  reason        text,
  disposed_at   timestamptz not null default now(),
  disposed_by   text,
  created_at    timestamptz not null default now()
);

create index disp_item_idx on disposals(item_type_id);
create index disp_date_idx on disposals(disposed_at desc);

alter table disposals enable row level security;
create policy "authenticated read disposals" on disposals for select using (auth.role() = 'authenticated');
create policy "write disposals" on disposals for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech', 'lab_team'))
);

-- ============================================================
-- Stock Count History
-- Previous values of any corrected or deleted stock count.
-- No FK to stock_counts: history must outlive the row it describes, or a
-- delete would erase the evidence of itself.
-- ============================================================

create table stock_count_history (
  id                  uuid primary key default uuid_generate_v4(),
  stock_count_id      uuid not null,
  item_type_id        uuid not null,
  operation           text not null check (operation in ('update', 'delete')),
  prev_quantity           numeric(10, 2) not null,
  prev_counted_at         timestamptz not null,
  prev_counted_by         text,
  prev_counted_by_user_id uuid,
  prev_lot_id             uuid,
  prev_notes              text,
  replaced_at         timestamptz not null default now(),
  replaced_by         uuid references profiles(id) on delete set null,
  reason              text
);

create index sch_count_idx on stock_count_history(stock_count_id);
create index sch_item_idx  on stock_count_history(item_type_id);
create index sch_when_idx  on stock_count_history(replaced_at desc);

alter table stock_count_history enable row level security;
create policy "authenticated read stock_count_history" on stock_count_history
  for select using (auth.role() = 'authenticated');
-- No write policy on purpose: only the SECURITY DEFINER trigger below writes
-- here, so nothing a client sends can add, alter or remove a history row.

create or replace function public.record_stock_count_history()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
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

create trigger record_stock_count_history
  before update or delete on stock_counts
  for each row execute function public.record_stock_count_history();

-- ============================================================
-- Storage bucket for equipment photos
-- ============================================================

-- Both buckets are private: the app reads them through signed URLs
-- (src/lib/file-storage.ts). NOTE: on the production project as of
-- 2026-09-03 equipment-photos is public=true -- it was flipped in the
-- dashboard to work around the old getPublicUrl() read path, before signed
-- URLs existed. That drift can now be closed by setting it back to false.
insert into storage.buckets (id, name, public) values ('equipment-photos', 'equipment-photos', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('equipment-documents', 'equipment-documents', false)
  on conflict (id) do nothing;

-- ============================================================
-- Table grants (required alongside RLS policies)
-- ============================================================

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on all tables in schema public to anon;

-- service_role (used by the server-side api/admin-users function) needs full
-- table access — it bypasses RLS policies but still requires the GRANT.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- ============================================================
-- Storage bucket for equipment photos (continued)
-- ============================================================

drop policy if exists "authenticated upload photos" on storage.objects;
drop policy if exists "authenticated read photos" on storage.objects;
drop policy if exists "authenticated upload docs" on storage.objects;
drop policy if exists "authenticated read docs storage" on storage.objects;

create policy "authenticated upload photos" on storage.objects
  for insert with check (bucket_id = 'equipment-photos' and auth.role() = 'authenticated');

create policy "authenticated read photos" on storage.objects
  for select using (bucket_id = 'equipment-photos' and auth.role() = 'authenticated');

create policy "authenticated upload docs" on storage.objects
  for insert with check (bucket_id = 'equipment-documents' and auth.role() = 'authenticated');

create policy "authenticated read docs storage" on storage.objects
  for select using (bucket_id = 'equipment-documents' and auth.role() = 'authenticated');
