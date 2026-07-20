-- search_events was missing per-event coordinates entirely — distance_m
-- alone can't place a marker on a map. Found while designing the
-- discovery-map.tsx client component (Phase 3): the original return
-- columns were scoped tightly to what PRD F4's result *card* needs, and
-- the map's own requirement (a literal lat/lng per pin) was overlooked.
--
-- Postgres won't let CREATE OR REPLACE change a table-returning
-- function's column signature in place — DROP FUNCTION first, same
-- migration.
drop function if exists public.search_events(
  float8, float8, int, timestamptz, timestamptz, text[], int
);

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
  latitude float8,
  longitude float8,
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
    ST_Y(e.location::geometry) as latitude,
    ST_X(e.location::geometry) as longitude,
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

grant execute on function public.search_events to anon, authenticated;
