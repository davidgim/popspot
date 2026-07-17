import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { vendorImageLimiter, rateLimitResponse } from "@/lib/rate-limit";

// DB row deleted first, then the Storage object. If the Storage step
// fails after the DB row is gone, the result is an invisible orphaned
// file (same risk tier as the avatar/cover-replace gap logged in
// TODO.md) — better than the reverse order, which could leave a
// broken-image icon on a live page if the DB delete failed after Storage
// had already succeeded.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const { id: vendorId, imageId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { success } = await vendorImageLimiter.limit(vendorId);
  if (!success) {
    return rateLimitResponse();
  }

  // vendor_image_delete_own (RLS) scopes this to images belonging to a
  // vendor the caller owns — no app-level ownership check needed.
  const { data: deletedImage, error: deleteError } = await supabase
    .from("vendor_image")
    .delete()
    .eq("id", imageId)
    .eq("vendor_id", vendorId)
    .select()
    .single();

  if (deleteError) {
    const status = deleteError.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: deleteError.message }, { status });
  }

  const { error: storageError } = await supabase.storage
    .from("vendor-images")
    .remove([deletedImage.storage_path]);

  if (storageError) {
    // DB row is already gone (the user-visible part) — log and move on
    // rather than fail the request over an orphaned Storage object.
    console.error(
      `Failed to remove Storage object ${deletedImage.storage_path}:`,
      storageError.message,
    );
  }

  return NextResponse.json({ success: true });
}
