import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this folder. Without this, Turbopack walks up
    // and finds the unrelated package-lock.json in the parent directory, which
    // makes module resolution ambiguous.
    root: path.resolve(import.meta.dirname),
  },

  images: {
    // Only these hosts may be optimised and served. Everything else is blocked.
    // picsum.photos serves the seed placeholders and goes away once real
    // product photos are uploaded through Cloudinary in Phase 8.
    remotePatterns: [new URL("https://picsum.photos/**")],
  },
};

export default nextConfig;
