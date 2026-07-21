import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setRatingSchema } from "@/lib/validation/rating";
import { ratingLimiter, rateLimitResponse } from "@/lib/rate-limit";

// Explicit check-then-branch, not .upsert() — deliberately avoids relying
// on unverified assumptions about how Postgres applies RLS policies to
// an INSERT ... ON CONFLICT DO UPDATE statement (it's plausible both the
// INSERT policy's gate and the UPDATE policy get evaluated together on
// the conflict path, which would mean editing an existing rating could
// re-run the expensive RSVP-gate check, and could even fail it if an
// RSVP was later removed). Explicit branching guarantees exactly the
// intended policy applies to each path: INSERT triggers the gate, UPDATE
// only checks ownership — no gate re-check on edits.
export async function PUT(
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

  const { success } = await ratingLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse();
  }

  const body = await request.json();
  const parsed = setRatingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("rating")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("rating")
      .update({ stars: parsed.data.stars })
      .eq("user_id", user.id)
      .eq("vendor_id", vendorId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // event_id must point at a real, qualifying event — rating_insert_gated
  // (RLS) requires a past, non-cancelled RSVP to THIS event for THIS
  // vendor, so we need the caller's actual eligible event, not just any
  // event_id. If they've attended this vendor more than once, record the
  // most recent qualifying visit — sorted here, not just "whichever
  // comes first" from an unspecified query order.
  const { data: eligibleRsvps } = await supabase
    .from("rsvp")
    .select("event_id, event:event_id(vendor_id, end_time, status)")
    .eq("user_id", user.id);

  const qualifying = eligibleRsvps
    ?.filter(
      (r) =>
        r.event?.vendor_id === vendorId &&
        r.event.status !== "cancelled" &&
        new Date(r.event.end_time) < new Date(),
    )
    .sort(
      (a, b) => new Date(b.event.end_time).getTime() - new Date(a.event.end_time).getTime(),
    )[0];

  if (!qualifying) {
    return NextResponse.json(
      {
        error:
          "You can only rate a vendor after attending one of their past events.",
      },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("rating")
    .insert({
      user_id: user.id,
      vendor_id: vendorId,
      event_id: qualifying.event_id,
      stars: parsed.data.stars,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
