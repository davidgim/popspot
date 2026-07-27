import { NextResponse } from "next/server";
import { searchAddressCandidates } from "@/lib/mapbox/geocode";
import { locationSearchSchema } from "@/lib/validation/location-search";
import {
  locationSearchLimiter,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

// Public, unauthenticated, IP-rate-limited entry point to
// searchAddressCandidates() — deliberately separate from
// geocodeAddress()'s internal-only usage (Phase 2 decision) since this
// endpoint faces anonymous /discover traffic, a different risk profile
// than an authenticated vendor entering their own event's address.
// Returns multiple candidates (address-autocomplete's suggestion
// dropdown); create-event's own server-side geocoding at submit time is
// unaffected — it still calls geocodeAddress() directly, not this route.
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

  const results = await searchAddressCandidates(parsed.data.query);
  return NextResponse.json({ results });
}
