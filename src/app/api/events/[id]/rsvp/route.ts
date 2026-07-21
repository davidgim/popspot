import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rsvpLimiter, rateLimitResponse } from "@/lib/rate-limit";

// First route under /api/events/ — deliberately not nested under
// /api/vendors/[id]/events/, which is for vendor-owner management
// actions. RSVP is diner-initiated on any event, a different kind of
// actor entirely (see DECISIONS.md-equivalent reasoning in the Phase 4
// plan). Same idempotent upsert / no-op-delete pattern as follow/like.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { success } = await rsvpLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse();
  }

  const { error } = await supabase
    .from("rsvp")
    .upsert(
      { user_id: user.id, event_id: eventId },
      { onConflict: "user_id,event_id", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ going: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { success } = await rsvpLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse();
  }

  const { error } = await supabase
    .from("rsvp")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ going: false });
}
