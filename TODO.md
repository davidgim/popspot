# TODO

Deferred issues and "noticed but didn't fix" items. Not a backlog of
features — see PRD.md §5/§10 for those.

---

## Rate-limit middleware — Phase 2 mutations done, Phase 4 still pending

**Resolved this phase:** `src/lib/rate-limit.ts` — real `@upstash/ratelimit`
limiters wired into every Phase 2 mutation route (become-a-vendor,
update-vendor, create/update/cancel-event, upload/delete-vendor-image),
including the stricter <48h-old-account cap for event creation (PRD §11).

**Still deferred:** like/follow toggles (60/min/user per PRD §11) and
rating limiters — those mutations don't exist yet, they're Phase 4 scope.

**Pick up:** alongside Phase 4, when follow/like/rating mutation routes
are built. Follow the same pattern established in `rate-limit.ts` — a
named `Ratelimit` instance per mutation, called at the top of its route
handler.

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
