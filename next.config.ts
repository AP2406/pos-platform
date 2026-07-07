import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Canonical host: force non-www (apex) → www with a 301, preserving the path.
      // The host value is anchored so it matches ONLY the bare apex and never
      // www.surgetechpos.com — the destination is www, so no redirect loop.
      // (Belt-and-suspenders: Vercel's domain settings may already do this at the edge.)
      {
        source: "/:path*",
        has: [{ type: "host", value: "^surgetechpos\\.com$" }],
        destination: "https://www.surgetechpos.com/:path*",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
