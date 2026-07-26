import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
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
      <SiteHeader user={user} />

      <DiscoveryMap
        initialResults={initialResults ?? []}
        initialCenter={{ lat: SEATTLE_LAT, lng: SEATTLE_LNG }}
      />
    </main>
  );
}
