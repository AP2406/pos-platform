import type { MetadataRoute } from "next";

const SITE_URL = "https://www.surgetechpos.com";

// The five public marketing pages, on the canonical www host. /login is excluded
// (noindex + robots disallow). App/API routes are not public pages.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL + "/", lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: SITE_URL + "/pricing", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: SITE_URL + "/pos", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: SITE_URL + "/contact", lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: SITE_URL + "/book", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];
}
