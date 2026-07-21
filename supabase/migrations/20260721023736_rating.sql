-- rating: gated on having RSVP'd to a past, non-cancelled event for this
-- vendor (PRD §4, plus a correctness fix beyond PRD's literal wording —
-- see below). PK (user_id, vendor_id), not including event_id — PRD's
-- own literal schema: "one rating per vendor, updatable." event_id is
-- stored only as a pointer to which event established eligibility.
create table public.rating (
  user_id uuid not null references public.profiles (id) on delete cascade,
  vendor_id uuid not null references public.vendor (id) on delete cascade,
  event_id uuid not null references public.event (id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);

alter table public.rating enable row level security;

-- invariant: a user may only see their own ratings — public-facing
-- numbers are the aggregate vendor.avg_rating/rating_count (maintained
-- by a trigger in the next migration), never individual rating rows.
create policy "rating_select_own"
  on public.rating
  for select
  to authenticated
  using (auth.uid() = user_id);

-- invariant: a rating row can exist only if the user has a past,
-- non-cancelled 'going' RSVP for THIS specific event, and that event
-- belongs to THIS specific vendor. Ties both vendor_id and event_id on
-- the new row to one real, qualifying RSVP — not just "some qualifying
-- event exists for this vendor somewhere." The `status != 'cancelled'`
-- clause is a correctness fix beyond PRD's literal "RSVP'd to a past
-- event" wording: a cancelled event that's chronologically past didn't
-- actually happen, so an RSVP to it shouldn't grant rating eligibility.
create policy "rating_insert_gated"
  on public.rating
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from rsvp r
      join event e on e.id = r.event_id
      where r.user_id = auth.uid()
        and r.event_id = rating.event_id
        and e.vendor_id = rating.vendor_id
        and e.end_time < now()
        and e.status != 'cancelled'
    )
  );

-- invariant: a user may update only the stars on their own rating —
-- vendor_id/event_id are pinned at insert time (enforced by the column
-- grant below, same pattern as vendor/event's protected columns). No
-- gate re-check needed here: the row's existence already proved
-- eligibility once, and which vendor/event it applies to can't change.
create policy "rating_update_own"
  on public.rating
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No DELETE policy: PRD only calls for "editable," not removable —
-- not in this phase's scope (CLAUDE.md: don't build what isn't asked
-- for). Revisit if a real need for it surfaces.

grant select on public.rating to authenticated;
grant insert (user_id, vendor_id, event_id, stars) on public.rating to authenticated;
grant update (stars) on public.rating to authenticated;
