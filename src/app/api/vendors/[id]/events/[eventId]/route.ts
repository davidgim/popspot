import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateEventSchema } from "@/lib/validation/event";
import { geocodeAddress } from "@/lib/mapbox/geocode";
import { updateEventLimiter, rateLimitResponse } from "@/lib/rate-limit";
import type { Database } from "@/lib/supabase/database.types";

type EventUpdate = Database["public"]["Tables"]["event"]["Update"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const { id: vendorId, eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { success } = await updateEventLimiter.limit(vendorId);
  if (!success) {
    return rateLimitResponse();
  }

  const body = await request.json();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: EventUpdate = { ...parsed.data };

  // Only re-geocode if address_text is actually part of this update —
  // otherwise `location` is simply absent from `updates`, leaving the
  // existing geocoded point untouched.
  if (parsed.data.address_text !== undefined) {
    const geocoded = await geocodeAddress(parsed.data.address_text);
    if (!geocoded) {
      return NextResponse.json(
        { error: "Could not find that address — please check it and try again" },
        { status: 400 },
      );
    }
    updates.location = `SRID=4326;POINT(${geocoded.longitude} ${geocoded.latitude})`;
  }

  // No app-level ownership check needed — event_update_own (RLS) already
  // scopes this to events belonging to a vendor the caller owns.
  const { data, error } = await supabase
    .from("event")
    .update(updates)
    .eq("id", eventId)
    .eq("vendor_id", vendorId)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
