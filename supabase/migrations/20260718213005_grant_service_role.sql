-- service_role had zero table grants on profiles/vendor/event/vendor_image
-- despite bypassing RLS — discovered via real E2E testing (a service_role
-- query hit "permission denied," not an RLS-empty result). BYPASSRLS only
-- skips row-policy evaluation (Gate 2); it says nothing about table-level
-- GRANTs (Gate 1), a separate, more fundamental Postgres privilege system.
-- Root cause: "Automatically expose new tables" being off (deliberate,
-- DECISIONS.md) apparently governs default grants for service_role too,
-- not just anon/authenticated.
--
-- Unlike the anon/authenticated grants elsewhere in this schema, these are
-- deliberately NOT column-restricted — service_role's whole purpose is
-- trusted, unrestricted server-side/admin access (Auth Admin API access
-- and Storage policy bypass are already unrestricted by design), so
-- column-level limits here would be inconsistent with what the role
-- already implies, not a meaningful additional protection.
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.vendor to service_role;
grant select, insert, update, delete on public.event to service_role;
grant select, insert, update, delete on public.vendor_image to service_role;
