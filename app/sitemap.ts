import type { MetadataRoute } from "next";
import { GUIDES } from "./(marketing)/guides/guides";
import { SOLUTIONS } from "./(marketing)/solution-content";
const SITE = "https://www.surgetechpos.com";
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    ...SOLUTIONS.map((page) => page.path),
    "/pricing",
    // The Sri Lanka pilot page. Indexable and listed on purpose: it is a
    // recruitment page for a named audience and the whole point is that someone
    // searching for a POS in Sri Lanka can find it and read the gaps before
    // they talk to us. It is NOT a location landing page — it carries no
    // service area, no address and no offer (see the notes in its own file);
    // the three city pages that were location landing pages are 308s now.
    "/pilot/sri-lanka",
    "/contact",
    "/book",
    "/guides",
  ];
  return [
    ...paths.map((path) => ({
      url: SITE + path,
      changeFrequency: "monthly" as const,
      priority: path === "/" ? 1 : 0.8,
    })),
    ...GUIDES.map((guide) => ({
      url: `${SITE}/guides/${guide.slug}`,
      lastModified: new Date(guide.dateModified),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
