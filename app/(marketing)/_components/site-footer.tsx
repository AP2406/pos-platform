import Link from "next/link";
import { SurgeLogo } from "@/components/brand/surge-logo";
import { Container } from "./primitives";
import { TERMINAL_COPY } from "@/lib/services/terminal-availability";

// THE SITE FOOTER.
//
// Structure, colour and column order are 01-home.jpg's. What is NOT here, and
// why — because a footer is where a site quietly accumulates lies:
//
//   * PRIVACY AND TERMS. The mockup puts both in the bottom bar. Neither route
//     exists in this repository. CONTENT-AND-LAUNCH-RULES.md says to retain the
//     real privacy/terms routes and not to create nonworking footer links, so
//     the pair is omitted rather than pointed at a 404. They are the first
//     thing to restore once the pages exist. Flagged in the handoff report.
//   * SOCIAL ICONS. LinkedIn, Instagram and YouTube glyphs sit at the right of
//     the mockup footer. app/(marketing)/jsonld.tsx records that no verified
//     profile URLs exist ("do not ship guessed links"), and a social icon whose
//     href is a guess is worse than no icon.
//   * "Payments", "Features", "Help center", "Blog", "Setup & support",
//     "Support". Six labels in the mockup's four columns with no route behind
//     them in this repo. Each returns in Phase 2 with its page.
//
// Every link below resolves today.

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/pos", label: "Point of sale" },
      // Anchors the home page's planned-terminal band rather than promising a
      // /payments page that does not exist yet.
      { href: "/#payment-terminal", label: "Payment terminal" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    heading: "Solutions",
    links: [
      { href: "/pos-for-restaurants", label: "Restaurants & cafés" },
      { href: "/pos-for-retail", label: "Retail & service" },
    ],
  },
  {
    heading: "Resources",
    links: [{ href: "/guides", label: "Guides" }],
  },
  {
    heading: "Contact",
    links: [
      { href: "/contact", label: "Get in touch" },
      { href: "/book", label: "Book a demo" },
      { href: "/login", label: "Sign in" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="surge-on-dark bg-[var(--surge-ink)] text-[var(--surge-on-dark-muted)]">
      {/* COLUMN START POSITION IS THE MOCKUP'S. 01-home.jpg opens the link
          columns at ~21% of the content rail, not at the halfway point a
          six-equal-column grid produced. A fixed brand cell followed by four
          equal columns puts "Product" at ~24% and keeps the four evenly
          spaced, which is what the mockup draws. */}
      <Container className="grid gap-x-8 gap-y-8 py-[var(--surge-space-4)] sm:grid-cols-2 lg:grid-cols-[minmax(0,240px)_repeat(4,minmax(0,1fr))]">
        <div>
          {/* The footer is the one place with room for the real horizontal
              lockup at the kit's 220px floor; the header uses the icon. */}
          <SurgeLogo tone="dark" title="Surge" className="h-[65px] w-[220px]" />
          {/* Two lines, as the mockup sets it — the measure is capped so the
              break lands after "business" rather than wherever the column ends. */}
          <p className="mt-3 max-w-[22ch] text-[length:var(--surge-small)] leading-snug">
            Powering local business every day.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            {/* TITLE CASE, NOT UPPERCASE LETTERSPACED. The mockup sets these as
                ordinary sentence-weight headings at body size; the uppercase
                micro treatment belongs to the page eyebrows, and borrowing it
                here made the footer read as four more eyebrows. */}
            <h2 className="text-[length:var(--surge-small)] font-bold text-white">{col.heading}</h2>
            <ul className="mt-3 space-y-1.5 text-[length:var(--surge-small)]">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="underline-offset-4 transition-colors duration-[var(--surge-motion)] hover:text-white hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <Container className="flex flex-col gap-3 border-t border-[var(--surge-on-dark-line)] py-[var(--surge-space-2)] text-[length:var(--surge-micro)] sm:flex-row sm:items-center sm:justify-between">
        <span>&copy; 2026 Surge. All rights reserved.</span>
        {/* The mockup's bottom-right slot carries Privacy and Terms. Until those
            routes exist it carries the two statements that are true on every
            page instead: the hardware state and the market caveat. Both come
            from the centralised terminal module. */}
        <span className="max-w-[62ch]">
          {TERMINAL_COPY.note} {TERMINAL_COPY.marketNote}
        </span>
      </Container>
    </footer>
  );
}
