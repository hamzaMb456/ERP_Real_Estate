import type { NextConfig } from "next";
import { legacyRedirects } from "./src/lib/erp-paths";

const nextConfig: NextConfig = {
  /* config options here */
  // Docker bind mounts on Windows/macOS emit no file events: poll when asked to.
  watchOptions: process.env.NEXT_WATCH_POLL_MS
    ? { pollIntervalMs: Number(process.env.NEXT_WATCH_POLL_MS) }
    : undefined,
  cacheComponents: true,
  // The ERP moved under /erp: old bookmarks and stored notification links keep working.
  redirects: async () => legacyRedirects(),
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
