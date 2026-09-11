// Section 5: structured data (JSON-LD) helpers, rendered server-side.

const SITE = "https://www.surgetechpos.com";

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

// Site-wide LocalBusiness. Real contact details supplied by the operator.
export const LOCAL_BUSINESS = {
  "@context": "https://schema.org",
  // WAS FinancialService, which is the schema.org type for a bank, a broker or
  // a PAYMENT PROCESSOR. That was a structured-data claim that we process
  // cards, made site-wide on every page, and it had to move with the copy.
  // ProfessionalService is the other LocalBusiness subtype that keeps the
  // LocalBusiness rich-result treatment (address, geo, hours, areaServed all
  // still apply) without asserting we are a financial institution. If and when
  // processing goes live, FinancialService is the honest type to come back to.
  "@type": "ProfessionalService",
  "@id": SITE + "/#business",
  name: "Surge Payment Solutions",
  alternateName: "Surge",
  url: SITE,
  logo: SITE + "/icon-512.png",
  image: SITE + "/jpg18.png",
  description: "Point-of-sale software for restaurants, cafes and retail across the Greater Toronto Area — register, floor plan, kitchen display, online and QR ordering, inventory, staff and reporting.",
  telephone: "+1-888-648-8097",
  email: "info@surgetechpos.com",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Toronto",
    addressRegion: "ON",
    addressCountry: "CA",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 43.6532,
    longitude: -79.3832,
  },
  areaServed: [
    "Greater Toronto Area",
    "Toronto",
    "Mississauga",
    "Brampton",
    "Markham",
    "Vaughan",
    "Richmond Hill",
    "Scarborough",
    "North York",
    "Etobicoke",
    "Pickering",
    "Ajax",
    "Whitby",
    "Oshawa",
    "Durham Region",
  ],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "09:00",
      closes: "20:00",
    },
  ],
  // sameAs: pending real profile URLs (LinkedIn/Facebook/Instagram) — do not ship guessed links.
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
    // Was /brand/surge-appicon.svg. Google's structured-data docs want a
    // raster for a publisher logo (and the old SVG no longer exists), so this
    // points at the same 512px tile the Organization `logo` above uses.
    publisher: { "@type": "Organization", name: "Surge", logo: { "@type": "ImageObject", url: SITE + "/icon-512.png" } },
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
