-- rsvp: "I'm going" (PRD §4/§5 F5 — "going" only, no "Interested" state
-- in v1). Fully private, same shape as follow/vendor_like — no
-- rsvp_count anywhere in PRD's data model, so nothing public to
-- aggregate here. Also the eligibility source for rating's gated insert
-- (see rating.sql).
create table public.rsvp (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.event (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.rsvp enable row level security;

-- invariant: a user may only see, create, or remove their own RSVPs.
create policy "rsvp_select_own"
  on public.rsvp
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "rsvp_insert_own"
  on public.rsvp
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "rsvp_delete_own"
  on public.rsvp
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.rsvp to authenticated;
