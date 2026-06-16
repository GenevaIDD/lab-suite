-- ============================================================
-- Let admins update any profile's role (in-app role editing).
-- Run once in the Supabase SQL Editor.
--
-- Without this, the profiles table has only a SELECT policy, so
-- the role dropdown on the Users page would silently fail to save.
-- Account creation/deletion still happens in the Supabase dashboard.
-- ============================================================

drop policy if exists "admin update profiles" on profiles;

create policy "admin update profiles" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

notify pgrst, 'reload schema';
