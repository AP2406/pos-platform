import type { MetadataRoute } from "next";

const SITE_URL = "https://surgetechpos.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL + "/", lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: SITE_URL + "/pricing", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: SITE_URL + "/pos", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
  ];
}