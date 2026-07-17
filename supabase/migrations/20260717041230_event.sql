-- event: a single scheduled appearance for a vendor. `title` is nullable
-- and has no stored default — "defaults to vendor name" (PRD F3) is
-- resolved at display time from the joined vendor row, not copied in at
-- insert, so it never goes stale if the vendor renames later.
--
-- location is computed server-side from address_text via Mapbox
-- geocoding (PRD §11) — enforced by the mutation's Zod schema/server
-- logic (only address_text is accepted as input), not by column grants.
-- See migration-authoring discussion: the worst case of a vendor
-- bypassing the app to PATCH their own event's location directly is
-- self-inflicted data integrity on a row they already own, not
-- unauthorized access — same risk tier PRD §11 already accepts at v1
-- scale (no CAPTCHA/WAF; harden only if abuse materializes).
create table public.event (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor (id) on delete cascade,
  title text,
  venue_name text not null,
  address_text text not null,
  location extensions.geography(point, 4326) not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  description text,
  created_at timestamptz not null default now()
);

-- PRD §4: GIST for ST_DWithin proximity queries (Phase 3 discovery),
-- btree for the date-range filter that always accompanies it.
create index event_location_idx on public.event using gist (location);
create index event_start_time_idx on public.event (start_time);

alter table public.event enable row level security;

-- invariant: events are public with no status filter — cancelled events
-- must stay visible (struck-through, PRD F3), not disappear. Hiding
-- cancelled/completed events from *discovery results* is a query-level
-- concern for Phase 3's search_events, not an RLS concern.
create policy "event_select_public"
  on public.event
  for select
  to anon, authenticated
  using (true);

-- invariant: a user may only create an event for a vendor they own.
-- Events have no owner_user_id of their own — ownership is one hop
-- through vendor.
create policy "event_insert_own"
  on public.event
  for insert
  to authenticated
  with check (
    vendor_id in (select id from public.vendor where owner_user_id = auth.uid())
  );

-- invariant: a user may only edit/cancel events belonging to a vendor
-- they own. Same one-hop ownership check on both sides so a vendor_id
-- can't be swapped to one the caller doesn't own.
create policy "event_update_own"
  on public.event
  for update
  to authenticated
  using (
    vendor_id in (select id from public.vendor where owner_user_id = auth.uid())
  )
  with check (
    vendor_id in (select id from public.vendor where owner_user_id = auth.uid())
  );

-- No DELETE policy: cancellation is `status = 'cancelled'` via UPDATE,
-- never a row delete (PRD F3: "not deleted").

grant select on public.event to anon;
grant select on public.event to authenticated;

-- Column-level grants: id, created_at auto-generate; status starts at its
-- 'scheduled' default and is only ever changed via UPDATE (cancel-event);
-- vendor_id is settable on insert (checked against ownership above) but
-- never reassignable afterward.
grant insert (
  vendor_id, title, venue_name, address_text, location,
  start_time, end_time, description
) on public.event to authenticated;

grant update (
  title, venue_name, address_text, location,
  start_time, end_time, status, description
) on public.event to authenticated;
