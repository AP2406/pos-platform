// Section 5: structured data (JSON-LD) helpers, rendered server-side.

const SITE = "https://www.surgetechpos.com";

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

// Site-wide Organization.
//
// WAS a LocalBusiness subtype (`ProfessionalService`) carrying a Toronto
// postal address, GeoCoordinates for downtown Toronto, an `areaServed` list of
// fifteen GTA municipalities and opening hours — emitted on every one of the
// site's pages. Every one of those properties is a claim that this is a
// business you can walk into in one metropolitan area, and LocalBusiness is
// the schema type for exactly that: a place with a door. Surge is software
// that runs anywhere, so the type itself was wrong, not just the values in it.
//
// `Organization` is the honest type for a software company with no storefront.
// It keeps the parts that are still true — name, URL, logo, contact — and has
// no slot for a service area, which is the point: there is nothing left here
// for a city list to come back into. The product, separately, is described as
// a `SoftwareApplication` on /pos (see `softwareApplication` below).
//
// Dropped deliberately and not replaced: `address`, `geo`, `areaServed`,
// `openingHoursSpecification`. An Organization MAY carry an address, but we
// are not asserting a head office on 21 pages to satisfy a validator.
export const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": SITE + "/#organization",
  name: "Surge",
  legalName: "Surge Payment Solutions",
  url: SITE,
  logo: SITE + "/icon-512.png",
  image: SITE + "/jpg18.png",
  description: "Point-of-sale software for restaurants, cafes, shops and salons — register, floor plan, kitchen display, online and QR ordering, inventory, staff and reporting. Onboarding is remote.",
  email: "info@surgetechpos.com",
  // contactPoint rather than a bare `telephone`, because a contactPoint can say
  // what the line is FOR without implying it is a local branch number. No
  // `areaServed` on it either — see above.
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: "+1-888-648-8097",
      email: "info@surgetechpos.com",
      availableLanguage: ["en"],
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

// No SoftwareApplication helper lives here: /pos declares its own inline (it
// is the only page that describes the product AS a product, and it already
// carried a geography-free SoftwareApplication before this pass). It points at
// the Organization above by @id.

// A service Surge offers, described WITHOUT a service area.
//
// WAS `localService`, which took an `areaServed: string[]` and named a
// `LocalBusiness` as the provider — so every landing page that used it emitted
// a list of GTA municipalities into structured data alongside the page copy.
// The parameter is gone rather than defaulted to empty, because an optional
// `areaServed` is an invitation to put the cities back one page at a time.
// `provider` now points at the site-wide Organization by @id, so the graph has
// one company node instead of a LocalBusiness re-declared on nine pages.
export function softwareService({ name, description, path }: { name: string; description: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    serviceType: name,
    description,
    provider: { "@id": SITE + "/#organization" },
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
