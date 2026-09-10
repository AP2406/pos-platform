import type { MetadataRoute } from "next";

const SITE_URL = "https://www.surgetechpos.com";

// Twin of OPEN_PREVIEW in lib/supabase/middleware.ts — OFF, and the two should
// always be flipped together.
//
// Worth knowing why this exists: well-behaved fetchers honour robots.txt, so
// `Disallow: /app/` makes the dashboard unfetchable for them on ANY host. When
// an outside reviewer couldn't load a preview tunnel, this was the reason — not
// the tunnel. It reads as "the link is broken" when it's really "the crawler is
// doing as it's told". Serving a permissive file for the duration is the fix.
const OPEN_PREVIEW = false;
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
