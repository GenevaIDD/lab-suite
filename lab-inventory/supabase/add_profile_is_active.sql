-- ============================================================
-- Add profiles.is_active — reflects whether a user is allowed to
-- sign in. Mirrors the Supabase auth "ban" state so the Users
-- page can show a deactivated badge from the normal profiles read.
--
-- The /api/admin-users function keeps this in sync when an admin
-- deactivates/reactivates a user. Run once in the SQL Editor.
-- ============================================================

alter table profiles
  add column if not exists is_active boolean not null default true;

notify pgrst, 'reload schema';
