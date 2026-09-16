import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this folder. Without this, Turbopack walks up
    // and finds the unrelated package-lock.json in the parent directory, which
    // makes module resolution ambiguous.
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
