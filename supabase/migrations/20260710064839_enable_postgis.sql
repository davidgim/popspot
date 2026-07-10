-- Enable PostGIS for the geography(Point, 4326) column on Event.location
-- (PRD §4, §7 decision 1: PostGIS from day one, not bounding-box math).
-- Installed into `extensions`, not `public`, per Supabase's convention of
-- keeping extension objects out of the API-exposed public schema.
-- No app tables in this migration — extension setup only.
create extension if not exists postgis with schema extensions;
