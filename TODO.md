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
