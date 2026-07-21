# TODO

Deferred issues and "noticed but didn't fix" items. Not a backlog of
features — see PRD.md §5/§10 for those.

---

## Rate-limit middleware — RESOLVED (Phase 2 + Phase 4)

`src/lib/rate-limit.ts` — real `@upstash/ratelimit` limiters wired into
every mutation route across Phases 2 and 4: become-a-vendor,
update-vendor, create/update/cancel-event, upload/delete-vendor-image
(Phase 2, incl. the stricter <48h-old-account cap for event creation),
and follow/like/rsvp/rating (Phase 4, `followLimiter`/`likeLimiter` at
PRD §11's literal 60/min/user; `rsvpLimiter`/`ratingLimiter` not
PRD-numbered, chosen with reasoning in code comments). No mutation route
in this codebase is unprotected.

---

## Custom SMTP for Supabase Auth — before real users sign up

**What's deferred:** configuring a custom SMTP provider for Supabase Auth
emails (magic link, confirmations). Currently using Supabase's built-in
shared email service.

**Why it matters:** the built-in service caps at 2 emails/hour project-wide
(confirmed in dashboard, 2026-07) and is meant for low-volume/testing use
— deliverability is also weaker (more likely to land in spam) than a
dedicated provider. Fine for Phase 1-4 development; not fine once real
diners/vendors are signing up.

**Pick up:** before Phase 5 (seed real Seattle vendors) at the latest —
real users hitting a 2/hour global email cap would be a broken signup
experience, not just a rare edge case.

---

## Orphaned Storage objects on avatar/cover replacement

**What's deferred:** when a vendor replaces their avatar or cover image,
`upload-vendor-image` just repoints `vendor.avatar_url`/`cover_image_url`
at the new file — the *previous* Storage object is never deleted, so it
sits in the bucket unreferenced.

**Why it matters:** storage-quota hygiene, not security or correctness —
no other row or policy depends on the orphaned file, it's just wasted
space. At the scale of a few images per vendor, not urgent.

**Pick up:** if it ever becomes a real quota concern — fetch the current
`avatar_url`/`cover_image_url` before overwriting and delete the old
Storage object after the update succeeds, same ordering reasoning as
`delete-vendor-image` (DB write first, Storage cleanup second, log and
continue on Storage failure rather than fail the request).

---

## Weighted rate limiting for repeat-weekly event creation

**What's deferred:** `create-event`'s rate limit is consumed once per API
call, not once per row actually created — a single `repeatWeeks: 12`
request costs 1 unit of the 20/day budget, not 12. User has explicitly
asked to revisit this properly later.

**Why it matters:** the 20/day limit exists to prevent fake-event spam
(PRD §11), and "how many events got created" is the thing that actually
matters, not "how many API calls were made." Current behavior means the
practical ceiling is higher than 20/day when repeatWeeks is used.

**Pick up:** either call the limiter once per row before inserting
(bounded by MAX_REPEAT_WEEKS=12, so worst case 12 sequential Redis
round-trips) and reject the whole batch if any would exceed the budget,
or check if `@upstash/ratelimit` supports a weighted/multi-unit `.limit()`
call directly (cleaner, avoids N round-trips, needs checking against the
installed version's API).

---

## Derived vendor location — "vendors near me" browse mode

**What's deferred:** the whole feature, and the schema for it. Raised and
discussed during Phase 2 planning: should `vendor` carry a general "based
near" location, independent of upcoming events? Decision: not now, and
not as a self-declared field — `vendor` has no location column.

**Why it matters / the actual design, if built:** a vendor's stated home
base can drift stale relative to where they actually operate (e.g.
Tacoma-based but mostly works Seattle). The honest version is a *derived*
location — a centroid of the vendor's own recent event locations,
maintained by trigger the same way `like_count`/`avg_rating` will be
(Phase 4 pattern) — not a manually-typed field. That requires real event
history to derive from, which now exists as of this phase.

**Pick up:** this isn't scoped into any current PRD phase (P0 or P1) —
before building it, it needs to actually be added as a named feature
(PRD update), not built as a side effect of some other phase's work.

---

## No mechanism transitions event.status to 'completed' — RESOLVED

Resolved in Phase 4 via the second option this entry itself named:
"is this event over" is computed from `end_time < now()` directly at
query time (in `rating`'s gated RLS policy, and in `/me/plans`'s
upcoming/past split) — no scheduled job or stored status transition was
built, and none is needed.

---

## Self-hosted basemap via Protomaps/PMTiles

**What's deferred:** the whole idea. `/discover`'s map currently renders
OpenFreeMap's free public tile instance (see DECISIONS.md — replaced
Mapbox's hosted styles after real MapLibre/Mapbox compatibility failures).
OpenFreeMap has no SLA and runs without a CDN in front.

**Why it matters:** if the public instance ever becomes a real reliability
concern, Protomaps/PMTiles lets you host an entire basemap extract (e.g.
just Washington state) as a single static file on Cloudflare R2 or S3 for
pennies, rendered by MapLibre — eliminates the third-party tile-uptime
dependency entirely. Also a genuinely good infra story for the portfolio
angle of this project.

**Pick up:** only if OpenFreeMap's reliability actually becomes a problem
in practice — not worth the setup cost speculatively. Swapping OpenFreeMap
for a different MapLibre-native provider (MapTiler, Stadia Maps — both
commercial, free tiers, SLAs) is the cheaper first fallback if needed
sooner, since it's a one-line style-URL change.

---

## No page lists vendors a user owns

**What's deferred:** there's no page showing "all vendors I own/manage."
A vendor owner today has no way to discover their own vendors' edit pages
except already knowing each vendor's slug — `/vendor/new` creates one and
redirects straight to its edit page, but nothing links back to it later.
Raised explicitly during Phase 4 planning: `/me/vendors` (PRD §5/§8) is
"followed vendors," a different, unrelated concept — not vendor-owner
navigation.

**Why it matters:** genuinely missing UX, will bite a vendor owner with
more than one vendor (allowed — no unique constraint on
`vendor.owner_user_id`, per Phase 2's decision) or one who simply forgets
their own slug.

**Pick up:** not scoped into any current PRD phase — a small, standalone
addition whenever it's prioritized (e.g. `/me/managed-vendors` or folded
into a future vendor dashboard, PRD P1 F8).
