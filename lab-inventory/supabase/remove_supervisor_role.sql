-- ============================================================
-- Remove the unused 'supervisor' value from the user_role enum.
--
-- OPTIONAL / ADVANCED. The app no longer offers 'supervisor'
-- anywhere, so no new accounts can get it. This migration only
-- removes the dormant enum value from the database.
--
-- Postgres has no "ALTER TYPE ... DROP VALUE", and the enum is
-- referenced by ~20 RLS policies (via the profiles.role column),
-- so we must: reassign any supervisor users, drop every
-- role-referencing policy, recreate the enum, then recreate the
-- policies. It runs as a single transaction — if anything fails
-- (e.g. a policy name in your DB differs), the whole thing rolls
-- back and your database is left unchanged.
--
-- Run add_admin_manage_profiles.sql FIRST if you want in-app role
-- editing (this script recreates that policy too, guarded).
-- ============================================================

begin;

-- 1. Reassign any existing supervisor accounts (none expected).
--    They become 'tech'; an admin can adjust afterwards on the Users page.
update profiles set role = 'tech' where role = 'supervisor';

-- 2. Drop every policy that references profiles.role.
--    (Read policies use auth.role() — the JWT claim — not the column,
--     so they are left untouched.)
drop policy if exists "admin+lab_manager write equipment"        on equipment;
drop policy if exists "admin+lab_manager write schedules"        on maintenance_schedules;
drop policy if exists "admin+lab_manager+tech write logs"        on maintenance_logs;
drop policy if exists "admin+lab_manager write item_types"       on item_types;
drop policy if exists "admin+lab_manager write item_sources"     on item_sources;
drop policy if exists "admin+lab_manager+tech write stock_counts" on stock_counts;
drop policy if exists "admin+lab_manager+tech write deliveries"  on deliveries;
drop policy if exists "admin+lab_manager+tech write lots"        on lots;
drop policy if exists "admin+lab_manager+tech write sessions"    on inventory_sessions;
drop policy if exists "admin+lab_manager+tech write entries"     on inventory_session_entries;
drop policy if exists "lab_team insert item_types"   on item_types;
drop policy if exists "lab_team insert item_sources" on item_sources;
drop policy if exists "lab_team insert equipment"    on equipment;
drop policy if exists "lab_team insert schedules"    on maintenance_schedules;
drop policy if exists "lab_team write logs"          on maintenance_logs;
drop policy if exists "lab_team write deliveries"    on deliveries;
drop policy if exists "lab_team write lots"          on lots;
drop policy if exists "lab_team write sessions"      on inventory_sessions;
drop policy if exists "lab_team write entries"       on inventory_session_entries;
drop policy if exists "lab_team write stock_counts"  on stock_counts;
drop policy if exists "admin+lab_manager delete obs" on equipment_observations;
drop policy if exists "admin+lab_manager write docs" on equipment_documents;
drop policy if exists "admin update profiles"        on profiles;

-- 3. Swap the enum.
alter type user_role rename to user_role_old;
create type user_role as enum ('admin', 'lab_manager', 'tech', 'lab_team');

alter table profiles alter column role drop default;
alter table profiles alter column role type user_role using role::text::user_role;
alter table profiles alter column role set default 'tech';

drop type user_role_old;

-- 4. Recreate the policies (identical to schema.sql, minus supervisor).
create policy "admin+lab_manager write equipment" on equipment
  for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager')));
create policy "admin+lab_manager write schedules" on maintenance_schedules
  for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager')));
create policy "admin+lab_manager+tech write logs" on maintenance_logs
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech')));
create policy "admin+lab_manager write item_types" on item_types
  for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager')));
create policy "admin+lab_manager write item_sources" on item_sources
  for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager')));
create policy "admin+lab_manager+tech write stock_counts" on stock_counts
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech')));
create policy "admin+lab_manager+tech write deliveries" on deliveries
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech')));
create policy "admin+lab_manager+tech write lots" on lots
  for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech')));
create policy "admin+lab_manager+tech write sessions" on inventory_sessions
  for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech')));
create policy "admin+lab_manager+tech write entries" on inventory_session_entries
  for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager', 'tech')));

create policy "lab_team insert item_types" on item_types
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));
create policy "lab_team insert item_sources" on item_sources
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));
create policy "lab_team insert equipment" on equipment
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));
create policy "lab_team insert schedules" on maintenance_schedules
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));
create policy "lab_team write logs" on maintenance_logs
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));
create policy "lab_team write deliveries" on deliveries
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));
create policy "lab_team write lots" on lots
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));
create policy "lab_team write sessions" on inventory_sessions
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));
create policy "lab_team write entries" on inventory_session_entries
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));
create policy "lab_team write stock_counts" on stock_counts
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'lab_team'));

create policy "admin+lab_manager delete obs" on equipment_observations
  for delete using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager')));
create policy "admin+lab_manager write docs" on equipment_documents
  for all using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager')));

-- Recreate the admin-update-profiles policy (only effective if you use
-- in-app role editing; harmless otherwise).
create policy "admin update profiles" on profiles
  for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

commit;

notify pgrst, 'reload schema';
