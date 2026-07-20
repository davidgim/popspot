import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/mapbox/geocode";
import { locationSearchSchema } from "@/lib/validation/location-search";
import {
  locationSearchLimiter,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

// Public, unauthenticated, IP-rate-limited entry point to the same
// geocodeAddress() helper create-event uses — deliberately separate from
// that internal-only usage (Phase 2 decision) since this endpoint faces
// anonymous /discover traffic, a different risk profile than an
// authenticated vendor entering their own event's address.
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { success } = await locationSearchLimiter.limit(ip);
  if (!success) {
    return rateLimitResponse();
  }

  const body = await request.json();
  const parsed = locationSearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await geocodeAddress(parsed.data.query);
  if (!result) {
    return NextResponse.json(
      { error: "Could not find that location — try a different search" },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}
