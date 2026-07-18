import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEventSchema } from "@/lib/validation/event";
import { geocodeAddress } from "@/lib/mapbox/geocode";
import {
  createEventLimiter,
  createEventLimiterNewAccount,
  isNewAccount,
  rateLimitResponse,
} from "@/lib/rate-limit";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: vendorId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", user.id)
    .single();

  const limiter =
    profile && isNewAccount(profile.created_at)
      ? createEventLimiterNewAccount
      : createEventLimiter;

  // Rate-limited once per API call, not once per row created — a single
  // repeatWeeks:12 request costs 1 unit of the daily budget, not 12. A
  // deliberate simplification (TODO.md), not an oversight.
  const { success } = await limiter.limit(vendorId);
  if (!success) {
    return rateLimitResponse();
  }

  const body = await request.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { venue_name, address_text, title, description, start_time, end_time, repeatWeeks } =
    parsed.data;

  const geocoded = await geocodeAddress(address_text);
  if (!geocoded) {
    return NextResponse.json(
      { error: "Could not find that address — please check it and try again" },
      { status: 400 },
    );
  }

  const location = `SRID=4326;POINT(${geocoded.longitude} ${geocoded.latitude})`;

  const weeks = repeatWeeks ?? 1;
  const rows = Array.from({ length: weeks }, (_, i) => {
    const offset = i * ONE_WEEK_MS;
    return {
      vendor_id: vendorId,
      venue_name,
      address_text,
      location,
      title,
      description,
      start_time: new Date(new Date(start_time).getTime() + offset).toISOString(),
      end_time: new Date(new Date(end_time).getTime() + offset).toISOString(),
    };
  });

  const { data, error } = await supabase.from("event").insert(rows).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
