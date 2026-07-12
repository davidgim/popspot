import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pins the workspace root to this repo — without it, Turbopack walks up
  // and finds an unrelated stray package-lock.json in the home directory
  // and infers the wrong root (see build warning this silences).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
