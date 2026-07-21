import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { likeLimiter, rateLimitResponse } from "@/lib/rate-limit";

// Same idempotent-upsert / no-op-delete pattern as follow/route.ts. The
// public-facing count (vendor.like_count) is maintained by the
// vendor_like_count_trigger — this handler never touches it directly.
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

  const { success } = await likeLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse();
  }

  const { error } = await supabase
    .from("vendor_like")
    .upsert(
      { user_id: user.id, vendor_id: vendorId },
      { onConflict: "user_id,vendor_id", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ liked: true });
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

  const { success } = await likeLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse();
  }

  const { error } = await supabase
    .from("vendor_like")
    .delete()
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ liked: false });
}
