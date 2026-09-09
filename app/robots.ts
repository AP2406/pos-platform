import type { MetadataRoute } from "next";

const SITE_URL = "https://www.surgetechpos.com";

// TEMPORARY, paired with OPEN_PREVIEW in lib/supabase/middleware.ts — set this
// back to `false` at the same time.
//
// Well-behaved fetchers honour robots.txt, so `Disallow: /app/` makes the
// dashboard unfetchable for them on ANY host. That looks like "the link is
// broken" when it's really "the crawler is doing as it's told" — it's why an
// outside reviewer couldn't load the tunnel. Permissive while the review runs;
// production is unaffected by the NODE_ENV term.
const OPEN_PREVIEW = true;
const openPreview = OPEN_PREVIEW && process.env.NODE_ENV !== "production";

export default function robots(): MetadataRoute.Robots {
  if (openPreview) {
    return { rules: { userAgent: "*", allow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep the app + API out of the index; noindex on /login is also set in its metadata.
      disallow: ["/app/", "/api/", "/login"],
    },
    sitemap: SITE_URL + "/sitemap.xml",
    host: SITE_URL,
  };
}
