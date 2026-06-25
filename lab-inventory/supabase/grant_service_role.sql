-- ============================================================
-- Grant table access to service_role (used by api/admin-users.ts).
--
-- Fixes: admin actions (invite / deactivate) failing with
--   "permission denied for table profiles"
-- The original schema granted privileges to anon + authenticated only,
-- so the service_role — used by the server function with the secret key —
-- lacked direct table access. service_role bypasses RLS *policies* but
-- still needs the table-level GRANT. It is the privileged backend role and
-- is meant to have full access.
--
-- Safe + idempotent. Run once in the Supabase SQL Editor. No redeploy needed.
-- ============================================================

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Cover tables/sequences created in the future too.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

notify pgrst, 'reload schema';
