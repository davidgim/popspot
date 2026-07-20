import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  uploadVendorImageSchema,
  MAX_GALLERY_IMAGES,
} from "@/lib/validation/vendor-image";
import { vendorImageLimiter, rateLimitResponse } from "@/lib/rate-limit";

// Registers an upload the client already made directly to Storage
// (RLS-gated by vendor_images_insert_own — a client can't write outside
// a vendor it owns regardless of what this handler does). This endpoint
// never receives file bytes.
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

  const { success } = await vendorImageLimiter.limit(vendorId);
  if (!success) {
    return rateLimitResponse();
  }

  const body = await request.json();
  const parsed = uploadVendorImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storagePath, slot, caption } = parsed.data;

  // Defense in depth: Storage RLS already prevented uploading outside a
  // vendor the caller owns, but a user who owns multiple vendors could
  // otherwise register vendor A's uploaded path against vendor B (both
  // owned by them, so vendor_image's RLS alone wouldn't catch it) —
  // check the path prefix matches the vendor in the URL.
  if (!storagePath.startsWith(`${vendorId}/`)) {
    return NextResponse.json(
      { error: "storagePath does not belong to this vendor" },
      { status: 400 },
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("vendor-images")
    .getPublicUrl(storagePath);

  if (slot === "avatar" || slot === "cover") {
    // Branched rather than a computed { [column]: ... } key — a dynamic
    // key loses the literal type Supabase's generated Update type needs
    // to check the column actually exists.
    const update =
      slot === "avatar"
        ? { avatar_url: publicUrlData.publicUrl }
        : { cover_image_url: publicUrlData.publicUrl };
    const { data, error } = await supabase
      .from("vendor")
      .update(update)
      .eq("id", vendorId)
      .select()
      .single();

    if (error) {
      const status = error.code === "PGRST116" ? 404 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json(data, { status: 201 });
  }

  const { count, error: countError } = await supabase
    .from("vendor_image")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_GALLERY_IMAGES) {
    return NextResponse.json(
      { error: `Vendors may have at most ${MAX_GALLERY_IMAGES} gallery images` },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("vendor_image")
    .insert({
      vendor_id: vendorId,
      storage_path: storagePath,
      caption,
      sort_order: count ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
