# CLAUDE.md

Project: Pop-up food discovery platform (see PRD.md for full spec).
Solo-maintained. Prioritize architectural clarity and reviewability over
raw velocity.

## Workflow

- For any non-trivial task, **propose a plan before writing code** and wait
  for approval. A plan = approach, files touched, any schema/API changes,
  and tradeoffs considered. Keep it under ~15 lines.
- Explain the reasoning behind significant design choices with concrete
  traces and invariants, not generalities.
- When introducing anything new to the codebase (a library, a Postgres
  feature, an auth pattern), explain the concept before generating code.

## Scope control

- **One PRD phase per session.** If work drifts into a later phase's
  territory, stop and say so.
- **No new dependencies without asking.** State what it's for and the
  no-dependency alternative.
- **No "while I was in there" refactors.** Fix what the task requires; note
  other issues in TODO.md instead of fixing them silently.
- **No new abstraction layers** (wrappers, factories, generic helpers) unless
  the duplication already exists three times.
- All schema changes go through migration files in `supabase/migrations/` —
  never ad-hoc SQL, never editing old migrations.

## High-review zones

These are load-bearing and get line-by-line human review; flag changes to
them loudly and never batch them with unrelated work:

1. **Database schema / migrations**
2. **RLS policies** — each policy gets a comment stating its invariant, e.g.
   `-- invariant: a rating row can exist only if the user has a past 'going' RSVP for this vendor`
3. **API surface** (route handlers / RPCs) — inputs, outputs, auth assumptions
4. **The discovery query** (PostGIS) and its indexes
5. **Rate-limit middleware** and what each limit protects against

UI internals and styling may move faster with lighter review.

## Conventions

- TypeScript strict mode; Next.js App Router; server components by default,
  client components only where interactivity requires.
- Zod validation on every mutation input, server-side.
- Postgres: snake_case columns; TypeScript: camelCase; map at the boundary.
- Follow existing patterns in the codebase before inventing new ones. If a
  pattern seems wrong, say so — don't silently diverge.
- Secrets only in env vars; the Supabase service-role key never appears in
  client-reachable code.

## Documentation

- **DECISIONS.md** — append an entry for every significant choice:
  `decision / alternatives considered / why rejected / date`. If a session
  makes an architectural choice and no entry was written, that's a bug.
- **TODO.md** — deferred issues and "noticed but didn't fix" items.

## Definition of done (per task)

- Deployed or deployable (main branch stays deployable at all times)
- RLS/validation enforced server-side, not just in UI
- DECISIONS.md updated if a choice was made

## Phase tracker

- [ ] Phase 1 — Skeleton: Next.js + Supabase, PostGIS migration, auth,
      Sentry, rate-limit middleware skeleton, deployed hello world
- [ ] Phase 2 — Vendor side: profiles, images, event CRUD + Mapbox geocoding
- [ ] Phase 3 — Discovery: search_events RPC, /discover map+list, filters
- [ ] Phase 4 — Engagement: follow, RSVP, likes, gated ratings, flags,
      counter triggers
- [ ] Phase 5 — Polish & seed: empty states, responsive pass, OG images,
      seed Seattle vendors
- [ ] Phase 6 — IG ingestion agent (Python service; semi-manual first)
