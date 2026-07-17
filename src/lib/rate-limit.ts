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
