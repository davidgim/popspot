import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bulkCancelSchema } from "@/lib/validation/event";
import { updateEventLimiter, rateLimitResponse } from "@/lib/rate-limit";

// "Same venue" = exact match on venue_name + address_text (locked
// decision, see plan). Only future, still-scheduled events are touched —
// past events and already-cancelled/completed ones are left alone.
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

  const { success } = await updateEventLimiter.limit(vendorId);
  if (!success) {
    return rateLimitResponse();
  }

  const body = await request.json();
  const parsed = bulkCancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { venue_name, address_text } = parsed.data;

  const { data, error } = await supabase
    .from("event")
    .update({ status: "cancelled" })
    .eq("vendor_id", vendorId)
    .eq("venue_name", venue_name)
    .eq("address_text", address_text)
    .eq("status", "scheduled")
    .gt("start_time", new Date().toISOString())
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cancelled: data });
}
