# TODO

Deferred issues and "noticed but didn't fix" items. Not a backlog of
features — see PRD.md §5/§10 for those.

---

## Rate-limit middleware — implementation deferred past Phase 1

**What's deferred:** the actual `@upstash/ratelimit`-backed limiting logic
(PRD §11: event creation 20/day/vendor, like/follow toggles 60/min/user,
stricter caps for accounts <48h old).

**What exists now:** the extension point only — `src/proxy.ts` runs on
every request and has a comment marking where this plugs in.

**Why deferred:** there are no mutation routes yet in Phase 1 (auth is the
only "write" path, and Supabase's own auth rate limits cover that — see
PRD §11's "Auth" bullet). Nothing to protect yet.

**Pick up:** alongside Phase 2 (event creation is the first mutation
route). Don't defer further than that — PRD treats this as required
non-functional coverage, not optional polish.

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
