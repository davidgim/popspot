import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { becomeVendorSchema } from "@/lib/validation/vendor";
import { slugify } from "@/lib/slug";
import { becomeVendorLimiter, rateLimitResponse } from "@/lib/rate-limit";

const MAX_SLUG_ATTEMPTS = 20;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { success } = await becomeVendorLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse();
  }

  const body = await request.json();
  const parsed = becomeVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const baseSlug = slugify(parsed.data.name);
  if (!baseSlug) {
    return NextResponse.json(
      { error: "Vendor name must contain at least one letter or number" },
      { status: 400 },
    );
  }

  // Attempt insert with the base slug, retrying with a numeric suffix on
  // collision (Postgres 23505 = unique_violation).
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

    const { data, error } = await supabase
      .from("vendor")
      .insert({ ...parsed.data, owner_user_id: user.id, slug })
      .select()
      .single();

    if (!error) {
      return NextResponse.json(data, { status: 201 });
    }

    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Could not generate a unique slug — try a different name" },
    { status: 409 },
  );
}
