# Decisions Log

Append-only. One entry per significant choice: decision / alternatives
considered / why rejected / date.

---

## Drop `role` (diner | vendor) from `profiles`; derive vendor-ness from existence

**Decision:** `profiles` does not store a `role` column. Whether a user "is a
vendor" is derived at query time via `EXISTS (SELECT 1 FROM vendor WHERE
owner_user_id = profiles.id AND is_active)`, not a stored flag. This diverges
from PRD §4's literal `User.role (diner | vendor)` field.

**Alternatives considered:**
- Keep `role` as PRD §4 specifies, set to `'vendor'` when a Vendor row is
  created. Rejected: it's a denormalized cache of a fact (row existence)
  that costs nothing to check directly — `owner_user_id` needs a btree index
  regardless (for the "get my vendor" query), so the EXISTS check is an
  indexed point lookup, not a real performance cost. Unlike `like_count` /
  `avg_rating` (genuine aggregates, expensive to compute live), `role` has
  no computation to cache — only a sync obligation every vendor-create and
  vendor-delete path would have to remember to honor, with no enforcement
  mechanism stopping it from drifting stale.
- `role` is also never sufficient for authorization: any real RLS check on
  a vendor mutation has to be `vendor.owner_user_id = auth.uid()` against
  the specific row, since `role='vendor'` can't say *which* vendor. So it
  would only ever serve as a UI-affordance flag, never a security primitive
  — low value for the sync risk it carries.

**Why this matters going forward:** any UI check for "is this user a
vendor" (nav CTA, etc.) must query/join `vendor`, not read a cached field.
If that becomes a real read-path cost later (unlikely — it's an indexed
lookup), revisit with a materialized flag *maintained by trigger*, not
hand-set at creation time — same triggers-over-app-code invariant already
used for `like_count`/`avg_rating`.

**Date:** 2026-07-09

---

## Error monitoring: Vercel's built-in observability instead of Sentry

**Decision:** Use Vercel's built-in error/observability tooling for Phase 1
rather than adding `@sentry/nextjs`. PRD §7/§11 explicitly left this open
("Sentry (or Vercel's equivalent)").

**Alternatives considered:**
- Sentry — richer error tracking (breadcrumbs, release tracking, custom
  alerting rules). Rejected for now: it's a new npm dependency plus a
  separate external account/DSN to manage, for a Phase 1 skeleton with no
  production traffic yet. CLAUDE.md requires justifying new dependencies
  against a no-dependency alternative, and here one already ships free with
  the Vercel deploy this project already needs.

**Why this matters going forward:** if error volume/complexity outgrows
Vercel's built-in tooling (need for breadcrumbs, custom alert routing,
better error grouping across releases), revisit and add Sentry then —
this isn't a permanent rejection, just deferred until there's a concrete
gap Vercel's tooling doesn't cover.

**Date:** 2026-07-14

---

## Route Handlers, not Server Actions, for all mutations

**Decision:** every mutation (become-a-vendor, event CRUD, image upload,
etc.) is a plain Route Handler at a stable URL, not a Next.js Server
Action. Matches PRD §7's literal wording, but the actual reason is more
specific than "the PRD said so."

**Alternatives considered:**
- Server Actions — Next.js App Router's own idiomatic mutation mechanism
  since v14: less boilerplate per mutation, progressive enhancement for
  free on forms. Rejected because they're not a stable, externally-callable
  API — a Server Action compiles to React's internal "Server Functions"
  wire protocol (custom serialization, build-specific action IDs), meant to
  be called by the matching React client runtime in the same build, not by
  an arbitrary external HTTP client. Mobile is a real, stated goal for this
  project (not hypothetical), and a mobile app has no practical way to call
  a Server Action directly.

**Why this matters going forward:** Route Handlers are plain `GET`/`POST`
JSON endpoints — exactly what a future mobile client (or anything else
outside this Next.js app) needs to call the same backend without any
rework. Keep every new mutation on this pattern; don't reach for a Server
Action later "just for one form," since that would recreate the exact
mobile-incompatibility problem this decision avoids.

**Date:** 2026-07-17

---

## Generated Supabase types, not an ORM (Prisma/Drizzle)

**Decision:** `npm run gen:types` (`supabase gen types typescript --linked`)
generates `src/lib/supabase/database.types.ts` from the live schema,
wired into `createBrowserClient<Database>`/`createServerClient<Database>`
in `client.ts`/`server.ts`/`lib/supabase/proxy.ts`. No ORM adopted.

**Alternatives considered:**
- Prisma (or Drizzle) as the schema/migration layer. Rejected: this
  project's security model is RLS + column-level `GRANT`s (every table
  this session), which ORMs have weak-to-no first-class support for —
  policies/grants/`SECURITY DEFINER` functions would still need hand-
  written SQL regardless, meaning adopting an ORM wouldn't actually
  eliminate hand-written migrations, just add a second system alongside
  them. Same story for PostGIS (`geography`, `ST_DWithin`, GIST indexes) —
  minimal-to-no ORM support, constant escape-hatches to raw SQL. Also a
  new, heavy dependency (CLAUDE.md: justify against the no-dependency
  alternative) where Supabase's own CLI — already in use — covers the
  real gap for free.
- Status quo (hand-written TS interfaces per component, no cross-check
  against the schema at all). Rejected once actually exercised: adopting
  generated types immediately surfaced real drift — `event-manager.tsx`
  hand-declared `status: "scheduled" | "cancelled" | "completed"`, but
  the actual column is `text + check constraint`, not a native Postgres
  enum, so nothing was verifying that claim. Confirms the gap was real.

**Why this matters going forward:** never hand-write a TS interface that
duplicates a table's shape. Import from `database.types.ts` (via `Pick<>`
when a component only needs a subset of columns, as in `event-manager.tsx`/
`image-manager.tsx`/`vendor-details-form.tsx`). Run `npm run gen:types`
after every migration that changes schema — the file is committed (build-
time type-checking has no network access to regenerate it live), so
forgetting to regenerate means the types silently go stale rather than
erroring, the one real risk this approach doesn't automatically catch.

**Date:** 2026-07-19

---
