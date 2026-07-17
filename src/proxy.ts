import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Rate limiting (PRD §11) lives per-route in src/lib/rate-limit.ts, not
// here — different mutations need different limits/keys (per-vendor for
// events, per-user for vendor creation), and this proxy has no route-
// specific context to make that call. It only ever handles session
// refresh.
export async function proxy(request: NextRequest) {
  const { supabaseResponse } = await updateSession(request);
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
