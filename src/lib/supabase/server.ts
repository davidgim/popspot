import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Components can't set cookies (Next.js restriction) — setAll below
// no-ops there. That's fine: middleware.ts calls supabase.auth.getUser() on
// every request, which refreshes the session cookie regardless.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component render — see comment above
          }
        },
      },
    },
  );
}
