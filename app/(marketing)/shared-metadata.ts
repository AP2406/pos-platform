import type { Metadata } from "next";

// Shared Open Graph fields. Next merges metadata SHALLOWLY — a page that sets
// `openGraph` replaces the layout's entirely — so every marketing page spreads this
// and sets its own `url` (and, per section 6, its own title/description). Section 2
// adds the shared `images` here so every page inherits the social card.
export const OG_BASE: NonNullable<Metadata["openGraph"]> = {
  siteName: "Surge",
  type: "website",
  // No title/description here — each page's openGraph inherits its own `title` and
  // `description` (section 6), so social cards are per-page.
};
