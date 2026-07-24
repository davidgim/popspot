# PRD: Pop-Up Food Discovery Platform (name candidates: "PopSpot" / "PropUp" — pending domain + IG handle check)

**Author:** David
**Status:** Draft v2 — core decisions locked
**Last updated:** July 2026
**Build target:** Responsive web app, built with Claude Code

---

## 1. Problem Statement

Food pop-ups are ephemeral by nature — a vendor might be at a brewery Friday, a farmers market Sunday, and dark for two weeks. Today, discovery happens almost entirely through Instagram, which is terrible for it: no location search, no date filtering, no way to answer "what pop-ups are near me this weekend?" Diners miss vendors they'd love; vendors struggle to reach anyone beyond their existing followers.

**Core insight:** Unlike restaurants (Yelp/Google Maps), the unit of discovery is not a *place* — it's a *vendor* who materializes at *events*. Users follow vendors; vendors post events (location + time window). Discovery is a spatio-temporal query: "events near X between date A and B."

## 2. Goals & Non-Goals

### Goals
- Diners can discover pop-up events near them, filtered by date and cuisine
- Vendors can create a profile and post upcoming events in under 5 minutes
- Diners can follow/favorite vendors and mark "I'm going" to events
- Lightweight social proof: likes on vendors, ratings from attendees
- SEO-indexable vendor and event pages (this is the real growth channel)

### Non-Goals (v1)
- Payments, preorders, or ticketing
- Text reviews (ratings only — moderation burden isn't worth it yet)
- Native mobile apps (responsive web / installable PWA only)
- Vendor identity verification (self-serve signup, report/flag mechanism instead)
- In-app messaging between diners and vendors

## 3. Users

### Persona A: The Diner
Urban food enthusiast, 20s–40s, currently finds pop-ups via Instagram word-of-mouth. Wants: "show me what's happening near me this weekend," reminders about vendors they love, confidence a pop-up is good before trekking across town.

### Persona B: The Vendor
Solo operator or 2–3 person team. Marketing = posting an Instagram story 2 days before each event. Wants: reach beyond existing followers, a single link-in-bio that always shows their upcoming schedule, low-effort posting.

**Cold-start note:** Vendors won't join without diners; diners won't come without vendors. v1 growth strategy: vendor pages double as a free "schedule link-in-bio" tool that's useful to vendors *even with zero diner users*. That's the wedge.

## 4. Data Model

```
User
  id, email, display_name, avatar_url, role (diner | vendor), created_at
  -- one account type; any user can "become a vendor" which creates a Vendor

Vendor
  id, owner_user_id (FK User), slug (unique, for URLs), name, bio,
  cuisine_tags (text[]), avatar_url, cover_image_url,
  instagram_url, tiktok_url, website_url,
  like_count (denormalized), avg_rating (denormalized), rating_count,
  created_at, is_active

Event
  id, vendor_id (FK), title (optional, defaults to vendor name),
  venue_name, address_text, location (geography(Point, 4326)),  -- PostGIS
  start_time, end_time (timestamptz),
  status (scheduled | cancelled | completed),
  description, created_at
  -- INDEX: GIST on location; btree on (start_time)

VendorImage
  id, vendor_id, storage_path, caption, sort_order, created_at

Follow            -- "favorite/save a vendor"
  user_id, vendor_id, created_at   (PK: user_id + vendor_id)

Rsvp              -- "I'm going" (single state; no "Interested" in v1)
  user_id, event_id, created_at
  (PK: user_id + event_id)

VendorLike        -- cheap engagement, no attendance implied
  user_id, vendor_id, created_at   (PK: user_id + vendor_id)

Rating            -- 1–5 stars, gated on having RSVP'd to a past event
  user_id, vendor_id, event_id, stars (1–5), created_at
  (PK: user_id + vendor_id — one rating per vendor, updatable)
```

**Design notes:**
- `Follow` vs `VendorLike`: Follow = "notify me / it's in my list." Like = public 👍 counter. Keeping them separate keeps semantics clean; UI may merge later.
- Ratings are gated: you can only rate a vendor if you RSVP'd "going" to one of their past events. Weak attendance proxy, but it prevents drive-by review bombing with zero friction.
- Denormalized `like_count` / `avg_rating` on Vendor, maintained by Postgres triggers or Supabase functions — discovery queries must not aggregate on the fly.

## 5. Features by Priority

### P0 — MVP (must ship)

**F1. Auth & accounts**
- Email + Google OAuth via Supabase Auth
- Any user can create a vendor profile ("Become a vendor" flow)
- *Acceptance:* Sign up, log in, log out; vendor creation gated behind auth.

**F2. Vendor profiles**
- Public page at `/v/{slug}`: name, bio, cuisine tags, images, social links, upcoming events, like count, avg rating
- Owner can edit all fields, upload up to 10 images (Supabase Storage)
- *Acceptance:* Vendor page renders server-side (SEO), shows upcoming events sorted by date, edit restricted to owner.

**F3. Event posting**
- Vendor creates event: venue name, address (geocoded to lat/lng on save via **Mapbox Geocoding API** — decided), date, start/end time, optional description
- **Recurring events (decided):** modeled as duplicate rows, not a series/RRULE model. Form offers a "repeat weekly for N weeks" convenience that inserts N independent rows. Include a "cancel all future events at this venue" bulk action so residencies can be cancelled in one step.
- Edit and cancel events; cancelled events show struck-through, not deleted
- *Acceptance:* Address geocodes correctly; event appears in discovery within seconds; repeat-weekly creates N editable independent events; bulk cancel affects only future events at the selected venue.

**F4. Discovery (the core loop)**
- `/discover`: map + list hybrid. Inputs: location (browser geolocation or typed), radius, date range (default: today → +7 days), cuisine tags
- **Default location when geolocation is denied: Seattle** (seed metro — see §10 Phase 5)
- Query: events where `ST_DWithin(location, user_point, radius)` AND `start_time` within range AND status = scheduled, sorted by distance then time
- Each result card: vendor avatar, name, rating, venue, date/time, distance
- *Acceptance:* Query p95 < 300ms with 10k events; empty state prompts widening radius/dates; works without login (auth only needed to save/RSVP).

**F5. Follow / Favorite + RSVP**
- Heart a vendor from any surface → appears in "My Vendors"
- "I'm going" on events → appears in "My Plans" (chronological). No "Interested" state in v1 — following the vendor covers soft-save; revisit only if users ask.
- *Acceptance:* Toggle is optimistic-UI, idempotent; My Plans splits upcoming vs past.

**F6. Likes & ratings**
- Like button on vendor page (toggle, public count)
- Rate 1–5 stars, only if user has a past "going" RSVP for that vendor; one rating per vendor, editable
- *Acceptance:* Rating gate enforced server-side (RLS/policy), not just UI; averages update immediately.

### P1 — Fast follow

- **F7. Notifications:** email (later push) when a followed vendor posts an event within X miles of user's saved home area
- **F8. Vendor dashboard:** views, follows, RSVPs per event — the retention hook for vendors
- **F9. Search:** vendor name / cuisine text search
- **F10. iCal export / "Add to calendar"** on events

### P1.5 — Committed post-MVP (see §10 Phase 6)

- **Instagram ingestion agent** — promoted from "later" to a committed build phase. Python service + LLM pipeline that reads a vendor's IG posts and drafts events (venue/date/time extraction from captions and flyer images) for one-click confirmation. This is the killer feature — most vendors already post schedules only to IG — and the resume-relevant agentic component. Built after the core loop works, since it needs real vendor data to demo well.

### P2 — Later

- Text reviews with moderation
- Vendor verification badges
- Trending/popularity ranking (time-decayed engagement score)

## 6. Key Flows

**Diner discovery:** Land on `/discover` → allow location (or type city) → see this week's events on map+list → tap card → vendor page → follow + RSVP.

**Vendor onboarding:** Sign up → "Become a vendor" → name, cuisine, bio, images, socials → post first event (address autocomplete → geocode → confirm pin) → get shareable `/v/{slug}` link for IG bio.

**Rating:** Event end_time passes → user with "going" RSVP sees "How was it?" prompt on My Plans → 1–5 stars.

## 7. Architecture

```
Next.js 14+ (App Router, TypeScript)  — Vercel
  ├─ Server components for vendor/event pages (SEO)
  ├─ /discover: client component (map) + server-fetched results
  └─ Route handlers for mutations (or Supabase client + RLS)

Supabase
  ├─ Postgres + PostGIS (events geo queries)
  ├─ Auth (email + Google OAuth)
  ├─ Storage (vendor images; enforce resize via transform params)
  └─ Row Level Security: vendors edit only their rows; rating gate policy

Map: MapLibre GL / Mapbox tiles
Geocoding: Mapbox Geocoding API — DECIDED. One vendor + one API key for both
           maps and geocoding; address autocomplete drops into React cleanly;
           free tier (100k req/mo) vastly exceeds needs since geocoding happens
           only at event creation.

Phase 6 addition:
  Python ingestion service (separate deploy — Fly.io/Railway/Modal)
  ├─ Pulls vendor's recent Instagram posts
  ├─ LLM extraction: venue, date, time from caption text + flyer images
  └─ Writes draft events to Postgres → vendor confirms in dashboard
  Rationale: TypeScript for product, Python for the ML/data workload —
  a realistic industry split, and the strongest resume artifact in the project.
```

**Key technical decisions:**
1. **PostGIS from day one.** `geography(Point)` + GIST index + `ST_DWithin`. Bounding-box math is not simpler once you handle radius correctly, and Supabase ships PostGIS.
2. **RLS as the security layer.** Vendor row edits, rating gates, RSVP ownership — all enforced in Postgres policies so client bugs can't corrupt data.
3. **Denormalized counters via triggers**, not query-time aggregation.
4. **Server-render public pages** — vendor SEO is the growth strategy.

## 8. API / Route Sketch

```
Pages
  /                    landing → redirect to /discover
  /discover            map+list search
  /v/{slug}            vendor public page
  /v/{slug}/edit       vendor owner editing
  /events/{id}         event detail (shareable)
  /me/vendors          followed vendors
  /me/plans            RSVPs (upcoming / past, rating prompts)
  /vendor/dashboard    (P1)

Core queries (Supabase RPC or route handlers)
  search_events(lat, lng, radius_m, date_from, date_to, cuisines[])
  create_event / update_event / cancel_event
  toggle_follow / toggle_like / set_rsvp / set_rating
```

## 9. Success Metrics

- **Activation (vendor):** % of new vendors who post ≥1 event in first session
- **Activation (diner):** % of visitors who follow ≥1 vendor or RSVP
- **Core loop:** weekly searches on /discover; RSVPs per event
- **Retention:** vendors posting a 2nd event within 30 days
- North star: **RSVPs per week** (proof both sides showed up)

## 10. Build Phases (Claude Code plan)

**Phase 1 — Skeleton (1–2 sessions):** Next.js + Supabase setup, schema migration incl. PostGIS, auth, deployed hello-world on Vercel. *Deploy first — everything after ships continuously.*

**Phase 2 — Vendor side:** Become-a-vendor flow, profile CRUD, image upload, event CRUD with geocoding, public vendor page.

**Phase 3 — Discovery:** search_events RPC with PostGIS, /discover map+list UI, filters, event detail page.

**Phase 4 — Engagement:** follow, RSVP, like, gated ratings, My Vendors / My Plans, counter triggers.

**Phase 5 — Polish & seed:** empty states, mobile responsiveness pass, OG images for sharing, seed 10–15 real Seattle vendors manually (walk up / IG DM — being local is the moat).

**Phase 5.5 — Visual design (added post-Phase-5-planning, not in the original roadmap):** a dedicated aesthetic pass — color palette, typography, spacing/layout rhythm, a cohesive look-and-feel — distinct from Phase 5's functional polish (mobile responsiveness, empty states, image performance, OG metadata). Every page through Phase 4 was deliberately built with minimal, functional-only Tailwind styling; nothing in the original 6-phase roadmap covered actual visual design. Sequenced before Phase 6 rather than folded into Phase 5 or deferred past Phase 6 — see DECISIONS.md.

**Phase 6 — Instagram ingestion agent (Python):** separate Python service: fetch a vendor's recent IG posts → LLM extracts venue/date/time from captions and flyer images → draft events written to Postgres → vendor reviews and confirms in dashboard. Start with a semi-manual pipeline (paste IG post URLs) before automating fetch, since IG scraping/API access is the risky part — the extraction agent is the valuable part either way.

Each phase = a working, deployed increment. Suggested Claude Code workflow: keep this PRD in the repo as `PRD.md`, reference it in `CLAUDE.md`, and scope each session to one phase.

## 11. Non-Functional Requirements

### Security
- **RLS on every table** — vendors edit only their rows, ratings gated server-side, RSVPs owned by user. The Supabase service-role key never ships to the client.
- **Server-side validation** — Zod schemas on all mutations (route handlers/RPCs). RLS protects row ownership, not data quality.
- **Geocoding server-side only** — Mapbox geocoding calls proxied through a route handler; only URL-restricted public tokens (map tiles) go to the client.
- **Auth** — Supabase Auth defaults (bcrypt, JWT, OAuth); enable its built-in auth rate limits (signup, magic link, password attempts).

### Rate limiting & abuse
- **Mutation rate limits** via Upstash Redis (`@upstash/ratelimit`) middleware: event creation (e.g., 20/day per vendor), like/follow toggles (e.g., 60/min per user), ratings, image uploads. Prevents fake-event spam, like inflation, and quota burn.
- **New-account caps** — stricter event limits for accounts < 48h old.
- **Report/flag** — button on vendors and events; flags land in a simple admin view. This is the v1 answer to fake vendors (inevitable with self-serve signup) and inappropriate images.

### Uploads
- Storage policies enforce type (jpeg/png/webp) and size (≤ 5MB) server-side; UI limits are cosmetic. Serve via Supabase image transforms (resized/compressed), never originals.

### Data protection
- Account deletion (cascade or anonymize ratings/RSVPs) — legally expected, table stakes.
- Never persist precise user location; geolocation is used per-request for search only. Optional saved "home area" (P1 notifications) stored as a coarse point with explicit consent.
- Minimal PII: email + display name only.

### Reliability & observability
- Sentry (or Vercel's equivalent) for error monitoring from Phase 1.
- Confirm Supabase automated backups + point-in-time recovery on the chosen plan.
- Performance covered by design: GIST/btree indexes, denormalized counters, p95 < 300ms target on discovery (F4).

### Deliberately deferred (avoid over-engineering at v1 scale)
WAF/advanced DDoS beyond Vercel defaults · automated image content moderation (report button suffices) · caching layer for discovery (indexed PostGIS is fine for a long time) · penetration testing · CAPTCHA (add only if abuse materializes).

## 12. Decisions Log

| Decision | Resolution |
|---|---|
| Geocoding provider | **Mapbox** — single vendor for tiles + geocoding, best React DX, free tier is ample |
| RSVP states | **"Going" only** — no "Interested"; following covers soft-save; keeps north-star metric clean |
| Recurring events | **Duplicate rows** + "repeat weekly" form convenience + "cancel all future at venue" bulk action; no RRULE/series model |
| Seed metro | **Seattle** — local presence enables manual vendor seeding; /discover defaults here when geolocation denied |
| IG ingestion agent | **Committed as Phase 6** (Python service), not aspirational P2 |
| Java for resume | **Rejected** — resume-driven engineering with no product justification; Python fits naturally via Phase 6 |

## 13. Open Questions

1. **Name + domain** — candidates: PopSpot, PropUp. Check .com and Instagram handle availability for both; pick whichever is free. Neither signals "food," but renaming pre-launch is cheap — don't block Phase 1 on this. Needed before Phase 2 (slugs) at the latest.
