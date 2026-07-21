-- follow: "notify me / it's in my list" (PRD §4 design note). Fully
-- private — no public read, no counter trigger. PRD's data model has no
-- follow_count anywhere on vendor, unlike like_count which is explicit —
-- confirming follows aren't meant to be a public-facing count.
create table public.follow (
  user_id uuid not null references public.profiles (id) on delete cascade,
  vendor_id uuid not null references public.vendor (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);

alter table public.follow enable row level security;

-- invariant: a user may only see, create, or remove their own follows —
-- never another user's list.
create policy "follow_select_own"
  on public.follow
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "follow_insert_own"
  on public.follow
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "follow_delete_own"
  on public.follow
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- No UPDATE policy: a follow is either present or absent, nothing to
-- edit — same shape as vendor_like/rsvp.

-- "Automatically expose new tables" is off project-wide — explicit
-- grants required alongside RLS (same two-gate pattern as every table
-- this session).
grant select, insert, delete on public.follow to authenticated;
