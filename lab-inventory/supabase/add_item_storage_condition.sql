-- ============================================================
-- Add storage_condition to item_types (ambient / refrigerator / freezer).
-- Nullable — existing items stay unspecified until set.
-- Run once in the Supabase SQL Editor.
-- ============================================================

alter table item_types
  add column if not exists storage_condition text
  check (storage_condition in ('ambient', 'refrigerator', 'freezer'));

notify pgrst, 'reload schema';
