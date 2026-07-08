// Section 5: structured data (JSON-LD) helpers, rendered server-side.

const SITE = "https://www.surgetechpos.com";

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

// Site-wide LocalBusiness. Real contact details supplied by the operator.
export const LOCAL_BUSINESS = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Surge",
  legalName: "Surge Payment Solutions",
  url: SITE,
  logo: SITE + "/brand/surge-appicon.svg",
  image: SITE + "/brand/surge-appicon.svg",
  email: "info@surgetechpos.com",
  telephone: "+1-888-648-8097",
  priceRange: "$$",
  areaServed: [
    "Greater Toronto Area",
    "Durham Region",
    "Toronto",
    "Mississauga",
    "Scarborough",
    "Markham",
    "Vaughan",
    "Pickering",
    "Ajax",
    "Whitby",
    "Oshawa",
    "Ontario",
  ],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
  ],
  description: "Transparent payment processing and point-of-sale software for local businesses across the GTA.",
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

// Service offered in a specific area — used by the local landing pages.
export function localService({ name, description, areaServed, path }: { name: string; description: string; areaServed: string[]; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    serviceType: name,
    description,
    provider: { "@type": "LocalBusiness", name: "Surge", url: SITE },
    areaServed,
    url: SITE + path,
  };
}

// Article schema for /guides posts.
export function article({ headline, description, path, datePublished }: { headline: string; description: string; path: string; datePublished: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    datePublished,
    author: { "@type": "Organization", name: "Surge", url: SITE },
    publisher: { "@type": "Organization", name: "Surge", logo: { "@type": "ImageObject", url: SITE + "/brand/surge-appicon.svg" } },
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
