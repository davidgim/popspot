import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateVendorSchema } from "@/lib/validation/vendor";
import { slugify } from "@/lib/slug";
import { updateVendorLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { success } = await updateVendorLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse();
  }

  const body = await request.json();
  const parsed = updateVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.slug !== undefined) {
    const sanitized = slugify(parsed.data.slug);
    if (!sanitized) {
      return NextResponse.json(
        { error: "Slug must contain at least one letter or number" },
        { status: 400 },
      );
    }
    updates.slug = sanitized;
  }

  // No app-level ownership check needed — vendor_update_own (RLS) already
  // scopes this UPDATE to rows owned by auth.uid(). If `id` isn't theirs,
  // zero rows match and .single() below errors with PGRST116, which we
  // turn into a 404 rather than leaking whether the id exists at all.
  const { data, error } = await supabase
    .from("vendor")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That slug is already taken" },
        { status: 409 },
      );
    }
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
