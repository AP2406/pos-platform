// Section 5: structured data (JSON-LD) helpers, rendered server-side.

const SITE = "https://www.surgetechpos.com";

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

// Software business identity without invented addresses or regional restrictions.
export const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": SITE + "/#business",
  name: "Surge",
  url: SITE,
  logo: SITE + "/icon-512.png",
  image: SITE + "/images/surge/01-home-owner.webp",
  description:
    "Point-of-sale software for restaurants, cafes and retail. Menus, orders, kitchen, inventory, staff and reporting.",
  telephone: "+1-888-648-8097",
  email: "info@surgetechpos.com",
};

// Home → Page breadcrumb for subpages.
export function breadcrumb(name: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name, item: SITE + path },
    ],
  };
}

// Multi-level breadcrumb (e.g. Home → Guides → Post). Pass "" as the Home path
// so it resolves to the bare canonical host (no trailing slash).
export function breadcrumbTrail(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: SITE + it.path,
    })),
  };
}

// REMOVED: `localService({ name, description, areaServed, path })`.
//
// It built a Service node whose provider was a `LocalBusiness` and which
// carried an `areaServed` list of municipalities. The local landing pages that
// called it are gone — they are 308s now (see legacy-redirects.ts) — so the
// helper had no callers left and emitted nothing. It is deleted rather than
// left dormant because the site no longer claims a service area anywhere, and
// a geography-shaped helper sitting in the file is an invitation to put one
// back a page at a time. The site-wide identity is `ORGANIZATION` above, which
// has no slot for an address or a service area; that is the point.

// Article schema for /guides posts.
export function article({
  headline,
  description,
  path,
  datePublished,
}: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    datePublished,
    author: { "@type": "Organization", name: "Surge", url: SITE },
    // Was /brand/surge-appicon.svg. Google's structured-data docs want a
    // raster for a publisher logo (and the old SVG no longer exists), so this
    // points at the same 512px tile the Organization `logo` above uses.
    publisher: {
      "@type": "Organization",
      name: "Surge",
      logo: { "@type": "ImageObject", url: SITE + "/icon-512.png" },
    },
    mainEntityOfPage: SITE + path,
  };
}

// Convert the HTML entities used in the on-page FAQ copy to plain text for JSON-LD.
export function decodeEntities(s: string): string {
  return s
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;|&#39;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}
