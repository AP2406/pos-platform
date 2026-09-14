import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a temporary public tunnel (reviewer link) load dev assets.
  allowedDevOrigins: ["*.trycloudflare.com", "*.loca.lt", "*.lhr.life"],
  async redirects() {
    return [
      // THE THREE CITY LANDING PAGES, RETIRED AS 308s.
      //
      // /payment-processing-toronto, /payment-processing-mississauga and
      // /merchant-services-durham were doubly wrong: each was named for one
      // metropolitan area AND for payment processing, which we do not do. They
      // ranked, so they are not deleted in the sense that matters — the URLs
      // still resolve, permanently, to the closest surviving page.
      //
      // WHY A REDIRECT AND NOT A REWRITE. The keyword intent itself is one we
      // can no longer serve: "payment processing toronto" is a merchant looking
      // for an acquirer in a city. There is no honest version of that page for
      // us to keep, so repurposing it would have meant keeping a ranking URL
      // whose title promises something the body then withdraws.
      //
      // WHY /pos IS THE TARGET. It is the closest surviving CONTENT match —
      // the full product page, for a visitor who arrived wanting a system for
      // their counter — rather than /pricing, which is the conversion page and
      // would make the redirect read as a funnel. /pos links to /pricing twice.
      //
      // 308, not 307 or 302: `permanent: true` is Next's 308, which preserves
      // the method and tells a crawler to move whatever equity these URLs hold
      // onto /pos. They are also removed from app/sitemap.ts — a sitemap should
      // never list a URL that redirects — and the footer group that linked
      // them is gone from app/(marketing)/layout.tsx.
      { source: "/payment-processing-toronto", destination: "/pos", permanent: true },
      { source: "/payment-processing-mississauga", destination: "/pos", permanent: true },
      { source: "/merchant-services-durham", destination: "/pos", permanent: true },
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
