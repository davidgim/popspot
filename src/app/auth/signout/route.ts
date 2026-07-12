import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST-only (triggered by a <form method="post">, not a link) so sign-out
// can't be triggered by a bare cross-site GET — e.g. <img src="/auth/
// signout">, link prefetching, or a crawler following a link. GET must
// stay side-effect-free; this is the same invariant every future mutation
// route (RSVP, follow, like, event create) will follow.
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
