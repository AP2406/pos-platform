// Section 5: structured data (JSON-LD) helpers, rendered server-side.

const SITE = "https://www.surgetechpos.com";

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

// Site-wide LocalBusiness. Real contact details supplied by the operator.
export const LOCAL_BUSINESS = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Surge Payment Solutions",
  url: SITE,
  logo: SITE + "/brand/surge-appicon.svg",
  image: SITE + "/brand/surge-appicon.svg",
  email: "info@surgetechpos.com",
  telephone: "+1-647-371-5982",
  priceRange: "$$",
  areaServed: ["Greater Toronto Area", "Durham Region", "Toronto", "Ontario"],
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

// Convert the HTML entities used in the on-page FAQ copy to plain text for JSON-LD.
export function decodeEntities(s: string): string {
  return s
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;|&#39;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}
