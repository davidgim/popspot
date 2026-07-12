import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Rate-limit skeleton (Phase 1 tracker item): mutation limits from PRD §11
// (event creation, follow/like toggles, ratings, uploads) are not wired up
// yet — no mutation routes exist until Phase 2+. This is the extension
// point; see TODO.md for what's deferred and why.
export async function proxy(request: NextRequest) {
  const { supabaseResponse } = await updateSession(request);
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
