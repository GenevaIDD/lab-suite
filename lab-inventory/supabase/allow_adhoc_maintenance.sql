-- ============================================================
-- Allow ad-hoc maintenance logs not tied to a schedule.
-- maintenance_logs.schedule_id was NOT NULL; make it nullable so a log can
-- be recorded for unscheduled/one-off maintenance (schedule_id = null).
-- Run once in the Supabase SQL Editor.
-- ============================================================

alter table maintenance_logs alter column schedule_id drop not null;

notify pgrst, 'reload schema';
