import type { MetadataRoute } from "next";

const SITE_URL = "https://www.surgetechpos.com";

export default function robots(): MetadataRoute.Robots {
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
