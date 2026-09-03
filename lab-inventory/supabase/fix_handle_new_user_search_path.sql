-- ============================================================
-- Fix: creating a user fails with "Database error creating new user"
-- (dashboard shows a generic "Failed to create user").
--
-- Cause: handle_new_user() is SECURITY DEFINER but never sets
-- search_path. The trigger fires inside the auth service's session,
-- whose search_path does not include `public`, so the unqualified
-- `insert into profiles` cannot resolve the table. The exception
-- aborts the insert into auth.users, so no user is created at all.
--
-- Fix: pin search_path and schema-qualify the table. Idempotent —
-- create-or-replace, safe to run on an existing project.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

-- Trigger already exists from schema.sql; recreate defensively so this
-- file also repairs a project where it was never created.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

notify pgrst, 'reload schema';
