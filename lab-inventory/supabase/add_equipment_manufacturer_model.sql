-- ============================================================
-- Add manufacturer + model to equipment. Nullable. Run once.
-- ============================================================

alter table equipment add column if not exists manufacturer text;
alter table equipment add column if not exists model text;

notify pgrst, 'reload schema';
