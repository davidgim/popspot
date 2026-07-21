import { createClient } from "@/lib/supabase/server";
import { DiscoveryMap } from "./discovery-map";

// PRD's explicit default when geolocation is denied/unavailable —
// Seattle (the seed metro). This is a one-time snapshot, seeding the
// client's initial state via a prop — the client makes its own
// independent search_events call on mount if geolocation succeeds; this
// server call is never reused or referenced again after the page loads.
const SEATTLE_LAT = 47.6062;
const SEATTLE_LNG = -122.3321;

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: initialResults } = await supabase.rpc("search_events", {
    lat: SEATTLE_LAT,
    lng: SEATTLE_LNG,
  });

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-semibold">PopSpot</h1>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span>Signed in as {user.email}</span>
            <a href="/me/vendors" className="underline">
              My Vendors
            </a>
            <a href="/me/plans" className="underline">
              My Plans
            </a>
            <a href="/vendor/new" className="underline">
              Become a vendor
            </a>
            <form action="/auth/signout" method="post">
              <button type="submit" className="underline">
                Log out
              </button>
            </form>
          </div>
        ) : (
          <a href="/login" className="text-sm underline">
            Log in
          </a>
        )}
      </header>

      <DiscoveryMap
        initialResults={initialResults ?? []}
        initialCenter={{ lat: SEATTLE_LAT, lng: SEATTLE_LNG }}
      />
    </main>
  );
}
