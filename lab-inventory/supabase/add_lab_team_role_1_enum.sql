-- ============================================================
-- Add "lab_team" role — step 1 of 2
-- Run this FIRST, on its own, in the Supabase SQL Editor.
-- Then run add_lab_team_role_2_policies.sql in a separate query.
--
-- (Postgres does not allow a newly-added enum value to be used
-- in policies created in the same transaction, so the two steps
-- must run separately.)
-- ============================================================

alter type user_role add value if not exists 'lab_team';
