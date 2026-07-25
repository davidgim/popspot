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

## Map tile source: OpenFreeMap, not Mapbox's hosted styles (revises Phase 3 decision 1)

**Decision:** `/discover`'s MapLibre map renders `https://tiles.openfreemap.org/styles/liberty` — a free, MapLibre-native style — instead of Mapbox's hosted Styles API. MapLibre stays the renderer; only the tile/style *source* changed. Mapbox Geocoding (server-side, `create-event`) is unaffected and unchanged.

**What Phase 3's original decision 1 assumed:** "MapLibre GL JS (renderer) + Mapbox tiles (data source)" was a standard, low-friction pairing — reasonable at the time, since it's a commonly cited pattern and matches the PRD's literal wording.

**What actually happened, in order:**
1. `streets-v12`'s style JSON includes `"projection": {"name": "globe"}`. MapLibre rejected it — not because MapLibre lacks globe support (it's had it since v5), but because MapLibre's style spec uses `projection.type` while Mapbox's uses `projection.name`: two style-spec dialects that have been diverging since MapLibre's 2020 fork from Mapbox GL JS, not a single missing feature.
2. Switching to `streets-v11` (predates that property) got past that error, then failed differently: the style internally references `mapbox://...` scheme URLs for sprites/sources, which MapLibre doesn't natively resolve into HTTPS requests — confirmed via Mapbox's own docs, which state exactly this and recommend direct HTTPS tile URLs instead.
3. Mapbox's classic raster tile API (a potential simpler fallback) returned 403 — classic raster styles are deprecated in favor of vector-only tilesets, so there's no simple non-vector escape hatch either.

**Alternatives considered and rejected:**
- `maplibregl-mapbox-request-transformer` (npm package, rewrites `mapbox://` URLs for MapLibre). Rejected: its own documented fix for the v12 projection error is passing `validateStyle: false` — disabling MapLibre's style validation entirely, masking every future spec divergence rather than fixing this one. Also v0.0.3, no test suite, pinned to `maplibre-gl ^4` (project is on v5), last released over a year ago, single maintainer — real ongoing-maintenance risk for a workaround, not a fix. Mapbox's own docs additionally warn this path bills tiles individually (Vector Tiles API) instead of Mapbox's bundled map-loads model — worse unit economics on top of everything else.
- Mapbox GL JS (switch the renderer instead of the tile source). Coherent, and would have zero further compatibility risk — but reverses the original license-avoidance reasoning to solve a problem this app doesn't have (a plain streets-and-pins basemap needs none of Mapbox GL JS's exclusive features — globe projection, 3D terrain, Studio styling). Worth revisiting only if a future feature genuinely needs a Mapbox-exclusive capability.

**Why OpenFreeMap specifically:** publishes standard MapLibre-native style JSON (OpenMapTiles schema) — no `mapbox://` references, no proprietary properties, verified directly before wiring it in. Free, no API key, no request limits on the public instance; production basemap for at least one other real product (MapHub) since mid-2024. Honest caveat: no SLA, donation-funded, runs without a CDN in front — a reasonable risk at this project's current stage, and cheap to exit if it isn't later: OpenFreeMap serves standard MapLibre style JSON, so swapping to a commercial MapLibre-native provider (MapTiler, Stadia Maps — both have free tiers and SLAs) is a one-line style-URL change, not a re-architecture. That swappability is the structural difference from the Mapbox pairing this replaces.

**Why this matters going forward:** within the MapLibre ecosystem, tile/style providers are commodity-swappable by design (all speak the same open style spec) — the Mapbox pairing wasn't, because Mapbox's hosted styles are a proprietary product tied to their own SDK. Don't reach for Mapbox's Styles API for anything MapLibre-rendered again; Mapbox's role in this project is geocoding only.

**Noted for later, not built now:** if OpenFreeMap's public instance ever becomes a real reliability concern, Protomaps/PMTiles (a self-hosted static basemap extract, e.g. Washington state, served from Cloudflare R2/S3 for pennies) is the natural upgrade — eliminates third-party tile-uptime dependency entirely. Not worth the setup cost for Phase 3.

**Date:** 2026-07-20

---

## New Phase 5.5 — visual design, sequenced before Phase 6

**Decision:** the 6-phase roadmap never had a phase dedicated to visual/
aesthetic design (color palette, typography, spacing rhythm, a cohesive
look-and-feel). Every page through Phase 4 was deliberately built with
minimal, functional-only Tailwind — correct for those phases (features
and correctness first), but the gap was never actually scheduled to close.
Raised during Phase 5 planning, not something I noticed and silently
decided on. New Phase 5.5 inserted between Phase 5 and Phase 6 in both
PRD.md §10 and CLAUDE.md's phase tracker.

**Alternatives considered:**
- Fold a visual-design pass into Phase 5 itself (already touching every
  page for the mobile-responsiveness work — arguably efficient to do
  both at once). Rejected: keeps Phase 5 scoped exactly to PRD §10's
  literal 4 bullets, and visual design deserves its own dedicated
  planning session (palette/typography choices, not just layout fixes),
  not to be squeezed in as a rider on a different phase's plan.
- Defer past Phase 6 (matches PRD §5's own stated priority ordering,
  which frames the IG ingestion agent as "the killer feature... the
  resume-relevant agentic component," ahead of pure aesthetics).
  Rejected — user's explicit call: visual design before Phase 6, not
  after.

**Why this matters going forward:** Phase 5 (this one) stays scoped to
functional polish only — do not add visual/aesthetic changes to it.
CLAUDE.md's phase tracker also had stale unchecked boxes for Phases 1-4
(all actually shipped) — corrected in the same edit, since it was the
same checklist already being touched for a related reason, not a
separate unrequested change.

**Date:** 2026-07-23

---

## Image optimization: `next/image` via Vercel, not Supabase's image transforms (revises Phase 5 plan decision 2)

**Decision:** all 4 files that render vendor/gallery images (`/v/[slug]`,
`/v/[slug]/edit/image-manager.tsx`, `/events/[id]`, `/me/vendors`) use
`next/image`'s `<Image>` component, which resizes/compresses via Vercel's
own image-optimization pipeline (included on the free Hobby tier). Storage
URLs are passed through unmodified — no Supabase-side transform query
params are applied.

**What the Phase 5 plan assumed:** PRD §11 literally specifies "Serve via
Supabase image transforms (resized/compressed), never originals," and the
approved plan's decision 2 scoped exactly that.

**What actually happened:** verified against Supabase's own pricing docs
*before* writing any code, not assumed or discovered after something broke
— image transformations are not available on the free tier at all; Pro
plan ($25/mo) or higher is required. This project has no paid Supabase
tier and no budget line to add one for this.

**Alternatives considered:**
- Upgrade to Supabase Pro to unlock transforms as PRD §11 specifies.
  Rejected: a new recurring cost purely to satisfy the letter of an NFR
  that has a free-tier-compatible alternative achieving the same practical
  outcome (no unoptimized originals served to the browser).
- Serve Storage URLs directly with no optimization at all (drop the NFR).
  Rejected: PRD §11's actual concern — not shipping full-resolution
  originals to every client — is real and cheap to address; dropping it
  entirely would be settling for less than a free option already covers.

**Why `next/image` specifically:** already the standard Next.js pattern
for any image whose dimensions are known ahead of render, ships on the
Hobby tier with no new dependency (it's part of `next`, already installed),
and performs the same fetch-original → resize/compress → serve pipeline
Supabase's transforms would have, just executed by Vercel's infrastructure
at request time instead of Supabase's.

**Why this matters going forward:** if this project ever moves to Supabase
Pro for other reasons, revisit whether Supabase-side transforms are worth
adding on top of `next/image` — likely redundant at that point, since both
solve the same problem. Until then, any new image-rendering surface should
use `next/image`, not a plain `<img>`, to stay consistent with this
decision. Full detail in TODO.md under "Supabase Storage image transforms
— blocked on plan tier."

**Date:** 2026-07-25

---
