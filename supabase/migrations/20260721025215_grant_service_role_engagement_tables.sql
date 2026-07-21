-- Same recurring gap as Phase 2's grant_service_role.sql: "Automatically
-- expose new tables" being off project-wide means new tables get zero
-- service_role grants by default, despite BYPASSRLS — GRANT and RLS are
-- two independent Postgres privilege systems. Confirmed via direct query
-- before writing this migration, not assumed. Unrestricted (no column
-- limits), same reasoning as before: service_role's whole purpose is
-- trusted, unrestricted access.
grant select, insert, update, delete on public.follow to service_role;
grant select, insert, update, delete on public.vendor_like to service_role;
grant select, insert, update, delete on public.rsvp to service_role;
grant select, insert, update, delete on public.rating to service_role;
