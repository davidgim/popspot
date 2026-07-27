// Server-only — never import from a Client Component. MAPBOX_SECRET_TOKEN
// has no NEXT_PUBLIC_ prefix and must never reach the browser bundle.

type GeocodeResult = {
  longitude: number;
  latitude: number;
  formattedAddress: string;
};

// Reads properties.coordinates.{longitude,latitude} rather than the raw
// GeoJSON geometry.coordinates array — a named object is harder to get
// backwards than an unlabeled [lng, lat] tuple, and swapped lat/lng is one
// of the most common real-world geocoding bugs.
export async function geocodeAddress(
  addressText: string,
): Promise<GeocodeResult | null> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", addressText);
  url.searchParams.set("access_token", process.env.MAPBOX_SECRET_TOKEN!);
  url.searchParams.set("limit", "1");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox geocoding request failed: ${res.status}`);
  }

  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) {
    return null;
  }

  return {
    longitude: feature.properties.coordinates.longitude,
    latitude: feature.properties.coordinates.latitude,
    formattedAddress: feature.properties.full_address as string,
  };
}

// Multi-candidate variant for autocomplete UIs — same endpoint/token as
// geocodeAddress, just a higher limit. geocodeAddress itself stays
// unchanged and is still what create-event's submit-time server-side
// geocoding calls; this is only for populating a live suggestion
// dropdown while the user types.
export async function searchAddressCandidates(
  addressText: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", addressText);
  url.searchParams.set("access_token", process.env.MAPBOX_SECRET_TOKEN!);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox geocoding request failed: ${res.status}`);
  }

  const data = await res.json();
  const features = (data.features ?? []) as unknown[];

  return features.map((feature) => {
    const f = feature as {
      properties: { coordinates: { longitude: number; latitude: number }; full_address: string };
    };
    return {
      longitude: f.properties.coordinates.longitude,
      latitude: f.properties.coordinates.latitude,
      formattedAddress: f.properties.full_address,
    };
  });
}
