-- ============================================================
-- Add "lab_team" role — step 2 of 2
-- Run this AFTER add_lab_team_role_1_enum.sql has been run
-- and committed (separate query in the SQL Editor).
--
-- Idempotent: each policy is dropped-if-exists before being
-- recreated, so re-running is safe (no "already exists" errors).
--
-- "lab_team" can:
--   - create new item types (but not edit/delete existing ones)
--   - add manufacturers/suppliers for items they create
--   - set up new equipment (but not edit/retire/delete equipment)
--   - set up maintenance schedules for equipment they create
--   - log equipment maintenance
--   - record deliveries
--   - run guided inventory sessions (incl. lot updates + the
--     resulting stock_counts rows on session completion)
--
-- "lab_team" CANNOT:
--   - delete or retire items/equipment (no update/delete grants)
--   - log an ad-hoc stock count (blocked in the UI — see
--     StockCountNew.tsx / canManageStock in src/lib/auth.ts)
-- ============================================================

-- Create new items (insert-only — editing/deleting stays admin+lab_manager)
drop policy if exists "lab_team insert item_types" on item_types;
create policy "lab_team insert item_types" on item_types
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

drop policy if exists "lab_team insert item_sources" on item_sources;
create policy "lab_team insert item_sources" on item_sources
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

-- Set up new equipment (insert-only — editing/retiring/deleting stays admin+lab_manager)
drop policy if exists "lab_team insert equipment" on equipment;
create policy "lab_team insert equipment" on equipment
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

drop policy if exists "lab_team insert schedules" on maintenance_schedules;
create policy "lab_team insert schedules" on maintenance_schedules
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

-- Log maintenance
drop policy if exists "lab_team write logs" on maintenance_logs;
create policy "lab_team write logs" on maintenance_logs
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

-- Record deliveries
drop policy if exists "lab_team write deliveries" on deliveries;
create policy "lab_team write deliveries" on deliveries
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

-- Guided inventory sessions (lot quantity updates)
drop policy if exists "lab_team write lots" on lots;
create policy "lab_team write lots" on lots
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

drop policy if exists "lab_team write sessions" on inventory_sessions;
create policy "lab_team write sessions" on inventory_sessions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

drop policy if exists "lab_team write entries" on inventory_session_entries;
create policy "lab_team write entries" on inventory_session_entries
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

-- Completing an inventory session writes stock_counts rows for
-- non-lot-tracked items — needed for "do inventory" to work end-to-end.
drop policy if exists "lab_team write stock_counts" on stock_counts;
create policy "lab_team write stock_counts" on stock_counts
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'lab_team')
  );

notify pgrst, 'reload schema';
