-- profiles mirrors app-facing fields for an auth.users row (id, display_name,
-- avatar_url). It intentionally does NOT duplicate `email` (stays in
-- auth.users only — minimal PII surface, no sync risk) and does NOT have a
-- `role` column (see DECISIONS.md: "Drop role from profiles" — vendor-ness
-- is derived from existence of a row in `vendor`, not a stored flag).
--
-- Row creation is exclusively via the signup trigger in the next migration
-- (security definer, bypasses RLS) — no INSERT grant is given to
-- authenticated/anon, so a client can never fabricate a profile row.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- invariant: a user may read only their own profile row. No v1 feature
-- displays another user's identity — ratings are anonymous aggregate stars,
-- likes are an anonymous aggregate count (PRD §4, §5 F6) — so profiles are
-- not public. Revisit if a later feature needs to show display names.
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- invariant: a user may update only their own profile row, and cannot
-- reassign it to another id (check clause blocks that on the new row too).
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No INSERT or DELETE policy: rows are created only by the signup trigger
-- (runs as a security definer function, not the `authenticated` role) and
-- removed only via `on delete cascade` from auth.users, i.e. through a
-- dedicated account-deletion flow (PRD §11), never a direct client delete.

-- "Automatically expose new tables" is disabled at the project level
-- (DECISIONS.md), so API access requires an explicit grant on top of RLS —
-- these are the two independent PostgREST gates (Postgres privileges, then
-- row policies). No grant is given to `anon`: no v1 feature reads profiles
-- without auth.
grant select, update on public.profiles to authenticated;
