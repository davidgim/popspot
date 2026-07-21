import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { followLimiter, rateLimitResponse } from "@/lib/rate-limit";

// upsert + ignoreDuplicates -> INSERT ... ON CONFLICT DO NOTHING under
// the hood. Calling this twice is a no-op, not a 23505 error — required
// for PRD F5's literal "idempotent" acceptance criterion. No app-level
// ownership check needed — follow_insert_own (RLS) already scopes this
// to auth.uid() = user_id.
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

  const { success } = await followLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse();
  }

  const { error } = await supabase
    .from("follow")
    .upsert(
      { user_id: user.id, vendor_id: vendorId },
      { onConflict: "user_id,vendor_id", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ following: true });
}

export async function DELETE(
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

  const { success } = await followLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse();
  }

  // Deleting a row that doesn't exist is already a no-op in SQL —
  // idempotent by construction, no extra handling needed.
  const { error } = await supabase
    .from("follow")
    .delete()
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ following: false });
}
