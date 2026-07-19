-- search_events: the core discovery query (PRD §4, §7, §8). SECURITY
-- INVOKER (default, but declared explicitly below) — respects the
-- caller's own RLS, same two-gate philosophy as every table this
-- session. event_select_public and vendor_select_authenticated/public
-- already allow anon/authenticated to read exactly what this query
-- needs; no reason to elevate and duplicate that access logic here.
--
-- Explicit AND vendor.is_active: a deactivated vendor's public page is
-- already hidden by RLS, so surfacing their event in discovery would
-- link to a page that 404s on click — excluded regardless of what RLS
-- alone would permit a caller to see (e.g. the vendor's own owner).
--
-- result_limit bounds an otherwise-unbounded result set: this is a
-- public, unauthenticated RPC, so a wide radius_m + date range must
-- still return a capped page, not every matching row in the database.
--
-- lat/lng are plain input parameters, read once per call and never
-- written to any table — geolocation privacy (PRD §11: "never persist
-- precise user location") is upheld by construction, not by an
-- additional check.
create or replace function public.search_events(
  lat float8,
  lng float8,
  radius_m int default 16090,
  date_from timestamptz default now(),
  date_to timestamptz default now() + interval '7 days',
  cuisines text[] default null,
  result_limit int default 100
)
returns table (
  event_id uuid,
  title text,
  venue_name text,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  distance_m float8,
  vendor_id uuid,
  vendor_slug text,
  vendor_name text,
  vendor_avatar_url text,
  vendor_avg_rating numeric
)
language sql
security invoker
stable
set search_path = public, extensions
as $$
  select
    e.id as event_id,
    e.title,
    e.venue_name,
    e.start_time,
    e.end_time,
    e.status,
    ST_Distance(e.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) as distance_m,
    v.id as vendor_id,
    v.slug as vendor_slug,
    v.name as vendor_name,
    v.avatar_url as vendor_avatar_url,
    v.avg_rating as vendor_avg_rating
  from event e
  join vendor v on v.id = e.vendor_id
  where
    ST_DWithin(e.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_m)
    and e.start_time between date_from and date_to
    and e.status = 'scheduled'
    and v.is_active
    and (cuisines is null or v.cuisine_tags && cuisines)
  order by distance_m, e.start_time
  limit result_limit;
$$;

-- Functions need their own EXECUTE grant — a different grant type than
-- the table-level SELECT grants used everywhere else so far.
grant execute on function public.search_events to anon, authenticated;

-- Supports the cuisines && filter above, same "index what the query
-- needs" discipline as event's existing GIST/btree indexes.
create index vendor_cuisine_tags_idx on public.vendor using gin (cuisine_tags);
