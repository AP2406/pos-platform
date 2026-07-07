import type { MetadataRoute } from "next";
import { GUIDES } from "./(marketing)/guides/guides";

const SITE_URL = "https://www.surgetechpos.com";

// Public marketing pages on the canonical www host. /login is excluded (noindex +
// robots disallow); app/API routes are not public pages. Guides are pulled from
// the shared GUIDES list so this stays in sync automatically.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const core: MetadataRoute.Sitemap = [
    { url: SITE_URL + "/", lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: SITE_URL + "/pricing", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: SITE_URL + "/pos", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: SITE_URL + "/payment-processing-toronto", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: SITE_URL + "/payment-processing-mississauga", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: SITE_URL + "/merchant-services-durham", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: SITE_URL + "/pos-for-restaurants", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: SITE_URL + "/pos-for-retail", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: SITE_URL + "/contact", lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: SITE_URL + "/book", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: SITE_URL + "/guides", lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
  const guides: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: SITE_URL + "/guides/" + g.slug,
    lastModified: new Date(g.datePublished),
    changeFrequency: "yearly",
    priority: 0.5,
  }));
  return [...core, ...guides];
}
