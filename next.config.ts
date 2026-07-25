import type { NextConfig } from "next";
import path from "node:path";

// Derived from the existing env var, not hardcoded a second time — same
// NEXT_PUBLIC_SUPABASE_URL already inlined into the browser bundle since
// Phase 1 (lib/supabase/client.ts), so nothing here is newly exposed by
// being read at config-eval time. Avoids two copies of this value ever
// drifting out of sync if the Supabase project ever changes.
const supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;

const nextConfig: NextConfig = {
  // Pins the workspace root to this repo — without it, Turbopack walks up
  // and finds an unrelated stray package-lock.json in the home directory
  // and infers the wrong root (see build warning this silences).
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Exact hostname, not *.supabase.co — least-privilege: this app only
    // ever talks to one Supabase project, no reason to let next/image
    // optimize images from any other one. Pathname scoped to Supabase's
    // actual public-URL shape (getPublicUrl() always generates this
    // exact prefix), not a bare "allow everything on this host" pattern.
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
