import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// PRD §11: 20/day per vendor. Prevents fake-event spam.
export const createEventLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 d"),
  prefix: "ratelimit:create-event",
});

// PRD §11: "stricter event limits for accounts < 48h old" — no exact
// number given; 3/day is a deliberate proposal, not a PRD figure.
export const createEventLimiterNewAccount = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 d"),
  prefix: "ratelimit:create-event:new-account",
});

// Not PRD-numbered. Creating a vendor is a rare, deliberate action — no
// legitimate reason to do it often.
export const becomeVendorLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 d"),
  prefix: "ratelimit:become-vendor",
});

// Not PRD-numbered. Profile edits aren't the primary abuse vector, kept
// generous.
export const updateVendorLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  prefix: "ratelimit:update-vendor",
});

// Not PRD-numbered. Covers update/cancel/bulk-cancel-event.
export const updateEventLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 h"),
  prefix: "ratelimit:update-event",
});

// Not PRD-numbered. Covers building a 10-image gallery plus reasonable
// replacement churn (delete-then-reinsert, per vendor_image's design).
export const vendorImageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 h"),
  prefix: "ratelimit:vendor-image",
});

// Not PRD-numbered. The first limiter in this project keyed by caller IP
// rather than user.id/vendor_id — this endpoint is public and anonymous
// by design (typed location search on /discover), unlike every limiter
// above which assumes an authenticated caller. 20/min per IP is generous
// for real typing/search use while still bounding cost against Mapbox's
// quota from a single abusive IP.
export const locationSearchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  prefix: "ratelimit:location-search",
});

const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isNewAccount(profileCreatedAt: string): boolean {
  return Date.now() - new Date(profileCreatedAt).getTime() < NEW_ACCOUNT_WINDOW_MS;
}

export function rateLimitResponse() {
  return NextResponse.json(
    { error: "Too many requests. Try again later." },
    { status: 429 },
  );
}

// Vercel sets x-forwarded-for on every request; serverless functions have
// no direct socket access to read a "real" client IP any other way. The
// header can carry a comma-separated chain (client, then any proxies) —
// the first entry is the original client. Falls back to a shared bucket
// key when the header is absent (e.g. local dev with no proxy in front),
// which means all anonymous local requests share one limit — acceptable
// for dev, never hit in production.
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}
