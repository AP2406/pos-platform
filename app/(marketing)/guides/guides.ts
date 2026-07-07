// Single source of truth for the /guides index, each guide page's metadata, and
// the sitemap. Add a guide here and everywhere that lists guides stays in sync.

export type Guide = {
  slug: string;
  title: string; // <title> / H1
  excerpt: string; // shown on the index card
  description: string; // meta description
  datePublished: string; // ISO date, stable
};

export const GUIDES: Guide[] = [
  {
    slug: "lower-credit-card-processing-fees-ontario",
    title: "How to lower your credit card processing fees in Ontario",
    excerpt: "Where the money actually goes on every card sale, and seven concrete ways an Ontario small business can pay less without switching banks.",
    description: "A plain-English guide to cutting credit card processing fees for Ontario small businesses — interchange, junk fees, Interac, and what to negotiate.",
    datePublished: "2026-07-07",
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
