-- Auto-creates a public.profiles row whenever a new auth.users row is
-- inserted (email signup or OAuth). This lives in Postgres, not app code,
-- so there is no race/missing-row window between "user authenticated" and
-- "profile exists" — every downstream FK (e.g. Vendor.owner_user_id ->
-- profiles.id, once Phase 2 adds it) can rely on the row already existing.
--
-- security definer + explicit search_path: the function runs as its owner
-- (postgres, via this migration), not as the caller, so it can insert into
-- public.profiles despite profiles having no INSERT grant/policy for any
-- client role (see 20260710064850_profiles.sql). `set search_path = public`
-- is required on security definer functions — without it, a caller could
-- manipulate their session's search_path to redirect unqualified names
-- (e.g. an attacker-owned `profiles` in another schema) into this
-- elevated-privilege execution context.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
