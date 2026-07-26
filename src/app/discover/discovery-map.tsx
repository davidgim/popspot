"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type SearchResult =
  Database["public"]["Functions"]["search_events"]["Returns"][number];

const RADIUS_OPTIONS = [
  { label: "5 mi", meters: 8047 },
  { label: "10 mi", meters: 16090 },
  { label: "25 mi", meters: 40234 },
  { label: "50 mi", meters: 80467 },
];

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DiscoveryMap({
  initialResults,
  initialCenter,
}: {
  initialResults: SearchResult[];
  initialCenter: { lat: number; lng: number };
}) {
  const supabase = createClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [center, setCenter] = useState(initialCenter);
  const [results, setResults] = useState(initialResults);
  const [radiusM, setRadiusM] = useState(RADIUS_OPTIONS[1].meters);
  const [dateFrom, setDateFrom] = useState(() => toDateInputValue(new Date()));
  const [dateTo, setDateTo] = useState(() =>
    toDateInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  );
  const [cuisineOptions, setCuisineOptions] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [locationQuery, setLocationQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (overrideCenter?: { lat: number; lng: number }) => {
      setSearching(true);
      setError(null);
      const c = overrideCenter ?? center;
      const { data, error: rpcError } = await supabase.rpc("search_events", {
        lat: c.lat,
        lng: c.lng,
        radius_m: radiusM,
        date_from: new Date(dateFrom).toISOString(),
        date_to: new Date(`${dateTo}T23:59:59`).toISOString(),
        cuisines: selectedCuisines.length > 0 ? selectedCuisines : undefined,
      });
      setSearching(false);
      if (rpcError) {
        setError("Search failed. Try again.");
        return;
      }
      setResults(data ?? []);
    },
    [center, radiusM, dateFrom, dateTo, selectedCuisines, supabase],
  );

  // Cuisine filter options — populated once, independent of search state.
  useEffect(() => {
    supabase.rpc("list_cuisine_tags").then(({ data }) => {
      if (data) setCuisineOptions(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geolocation on mount. Denied/unavailable falls back to whatever's
  // already showing (the Seattle-seeded initialResults) — not an error
  // state, just the absence of this effect ever replacing local state.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const real = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCenter(real);
        runSearch(real);
      },
      () => {
        // denied/unavailable — intentionally no-op, no error shown
      },
      { timeout: 8000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map init — once, on mount.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      // OpenFreeMap, not Mapbox's hosted styles — see DECISIONS.md.
      // MapLibre and Mapbox's style specs have been actively diverging
      // since MapLibre's 2020 fork (e.g. projection.type vs
      // projection.name), and Mapbox v12+ styles increasingly lean on
      // Mapbox-only constructs (fog, 3D lights, model layers). OpenFreeMap
      // publishes standard MapLibre-native style JSON — no Mapbox account/
      // token needed for map rendering at all; geocoding stays on Mapbox,
      // unaffected.
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [center.lng, center.lat],
      zoom: 11,
    });
    mapRef.current.addControl(new maplibregl.NavigationControl());
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center the map whenever the search center changes (geolocation
  // success or a typed-location search).
  useEffect(() => {
    mapRef.current?.flyTo({ center: [center.lng, center.lat] });
  }, [center]);

  // Keep markers in sync with results.
  useEffect(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!mapRef.current) return;

    for (const r of results) {
      if (r.latitude == null || r.longitude == null) continue;
      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
        `<a href="/events/${r.event_id}" style="font-weight:600">${
          r.title ?? r.vendor_name
        }</a><br/>${r.venue_name}`,
      );
      const marker = new maplibregl.Marker()
        .setLngLat([r.longitude, r.latitude])
        .setPopup(popup)
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    }
  }, [results]);

  async function handleLocationSearch() {
    if (!locationQuery.trim()) return;
    setError(null);
    const res = await fetch("/api/geocode/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: locationQuery }),
    });
    if (!res.ok) {
      setError("Could not find that location — try a different search.");
      return;
    }
    const { latitude, longitude } = await res.json();
    const real = { lat: latitude, lng: longitude };
    setCenter(real);
    runSearch(real);
  }

  function toggleCuisine(tag: string) {
    setSelectedCuisines((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Location
          <div className="flex gap-1">
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="City or address"
              className="rounded border border-twine bg-paper px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
            />
            <button
              type="button"
              onClick={handleLocationSearch}
              className="rounded border border-twine px-2 py-1 text-sm hover:border-stamp hover:text-stamp focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
            >
              Search
            </button>
          </div>
        </label>

        <label className="flex flex-col text-sm">
          Radius
          <select
            value={radiusM}
            onChange={(e) => setRadiusM(Number(e.target.value))}
            className="rounded border border-twine bg-paper px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
          >
            {RADIUS_OPTIONS.map((opt) => (
              <option key={opt.meters} value={opt.meters}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-twine bg-paper px-2 py-1 font-mono text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
          />
        </label>

        <label className="flex flex-col text-sm">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-twine bg-paper px-2 py-1 font-mono text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
          />
        </label>

        <button
          type="button"
          onClick={() => runSearch()}
          disabled={searching}
          className="rounded bg-stamp px-3 py-1.5 text-sm font-medium text-paper hover:bg-stamp/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {searching ? "Searching…" : "Update results"}
        </button>
      </div>

      {cuisineOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {cuisineOptions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleCuisine(tag)}
              className={`rounded-full border px-2 py-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp ${
                selectedCuisines.includes(tag)
                  ? "border-stamp bg-stamp text-paper"
                  : "border-twine text-ink hover:border-stamp hover:text-stamp"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-stamp">{error}</p>}

      <div className="flex flex-1 flex-col gap-4 md:flex-row">
        <div
          ref={mapContainerRef}
          className="h-64 w-full rounded border border-twine md:h-[500px] md:flex-1"
        />

        <div className="w-full shrink-0 overflow-y-auto md:w-72">
          {results.length === 0 ? (
            <p className="text-sm text-twine">
              No pop-ups found. Try widening your radius or date range.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((r) => (
                <li key={r.event_id} className="rounded border border-twine p-2 text-sm">
                  <a href={`/events/${r.event_id}`} className="font-medium hover:text-stamp">
                    {r.title ?? r.vendor_name}
                  </a>
                  <div className="font-mono text-xs text-twine">
                    {r.venue_name} · {new Date(r.start_time).toLocaleString()}
                  </div>
                  <div className="font-mono text-xs text-twine">
                    {(r.distance_m / 1609).toFixed(1)} mi
                    {r.vendor_avg_rating != null &&
                      ` · ${r.vendor_avg_rating.toFixed(1)}★`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
