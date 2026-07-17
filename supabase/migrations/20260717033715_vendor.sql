-- vendor: a pop-up food vendor's public profile. Owner-writable fields are
-- restricted by column-level grants below — engagement counters
-- (like_count/avg_rating/rating_count) are never client-writable, even by
-- the owner, since they're only ever correct when maintained by the
-- Phase-4 counter triggers (same invariant as profiles' signup trigger:
-- app-writable data and system-maintained data don't share a write path).
-- No unique constraint on owner_user_id — a user may own multiple vendors
-- (DECISIONS.md: same reasoning as dropping profiles.role).
create table public.vendor (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique,
  name text not null,
  bio text,
  cuisine_tags text[] not null default '{}',
  avatar_url text,
  cover_image_url text,
  instagram_url text,
  tiktok_url text,
  website_url text,
  like_count integer not null default 0,
  avg_rating numeric,
  rating_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.vendor enable row level security;

-- invariant: anonymous visitors see only active vendors — public pages
-- (PRD F2) must work without login, including for search-engine crawlers,
-- which are always anonymous requests at the Postgres role level.
create policy "vendor_select_public"
  on public.vendor
  for select
  to anon
  using (is_active);

-- invariant: authenticated users see active vendors publicly, plus their
-- own vendor(s) even while deactivated, so they can review/reactivate.
create policy "vendor_select_authenticated"
  on public.vendor
  for select
  to authenticated
  using (is_active or auth.uid() = owner_user_id);

-- invariant: a user may only create a vendor row owned by themselves.
create policy "vendor_insert_own"
  on public.vendor
  for insert
  to authenticated
  with check (auth.uid() = owner_user_id);

-- invariant: a user may only update their own vendor row(s), and cannot
-- reassign ownership (check clause blocks that on the new row too).
create policy "vendor_update_own"
  on public.vendor
  for update
  to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- No DELETE policy: deactivation is `is_active = false` via UPDATE, same
-- soft-cancel pattern PRD uses for events.

-- "Automatically expose new tables" is off project-wide — explicit grants
-- required alongside RLS (same two-gate pattern as profiles).
grant select on public.vendor to anon;
grant select on public.vendor to authenticated;

-- Column-level grants: id, owner_user_id, created_at, and the engagement
-- counters are never client-writable — insertable/updatable columns are
-- exactly the vendor-editable profile fields from PRD F2.
grant insert (
  owner_user_id, slug, name, bio, cuisine_tags, avatar_url,
  cover_image_url, instagram_url, tiktok_url, website_url
) on public.vendor to authenticated;

grant update (
  slug, name, bio, cuisine_tags, avatar_url,
  cover_image_url, instagram_url, tiktok_url, website_url, is_active
) on public.vendor to authenticated;
