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
