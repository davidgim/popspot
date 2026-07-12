import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Both Google OAuth and magic-link email land here with a one-time `code`
// param (PKCE). exchangeCodeForSession pairs it with the code_verifier
// cookie set on this browser when the flow started — that pairing is what
// stops a leaked/logged code from being redeemable elsewhere.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/discover";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
