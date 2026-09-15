import type { MetadataRoute } from "next";
import { GUIDES } from "./(marketing)/guides/guides";
import { SOLUTIONS } from "./(marketing)/solution-content";
const SITE = "https://www.surgetechpos.com";
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    ...SOLUTIONS.map((page) => page.path),
    "/pricing",
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
