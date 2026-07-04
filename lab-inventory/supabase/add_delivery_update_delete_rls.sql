-- ============================================================
-- Allow admins / lab managers to correct delivery mistakes.
-- Deliveries were insert-only; this adds UPDATE and DELETE.
--
-- (Removing the lot a delivery created is handled in the app: lots
-- already have a write policy covering delete. deliveries.lot_id →
-- lots.delivery_id is ON DELETE SET NULL, so deleting a delivery leaves
-- any lot intact unless the app also deletes it.)
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

drop policy if exists "admin+lab_manager update deliveries" on deliveries;
create policy "admin+lab_manager update deliveries" on deliveries
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

drop policy if exists "admin+lab_manager delete deliveries" on deliveries;
create policy "admin+lab_manager delete deliveries" on deliveries
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'lab_manager'))
  );

notify pgrst, 'reload schema';
