import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import { SiteMotion } from "./site-motion";
import { OG_BASE } from "./shared-metadata";
import { JsonLd, ORGANIZATION } from "./jsonld";
// tokens.css FIRST, marketing.css SECOND, and the order is load-bearing.
// Both sheets are unlayered, so where they tie on specificity the later one
// wins. They tie on exactly one thing — the focus ring — and marketing.css
// should keep winning inside the twenty-one pages it still styles, which is
// what this order gives. Everything else the two sheets say is about disjoint
// elements: tokens.css owns .surge-scope and the redesigned components,
// marketing.css owns .surge-site and the .s-* classes.
import "./tokens.css";
import "./marketing.css";

// INTER, NOT PUBLIC SANS, AND THE HANDOFF IS WHAT DECIDES IT.
// design-tokens.css names the family outright (`--surge-font: Inter, …`) and
// DESIGN-SYSTEM.md asks for "an Inter-style sans-serif stack" built from real
// font assets. next/font self-hosts it, so there is no third-party request and
// no layout shift. The variable it publishes is --font-marketing, which is the
// name both design systems already read: tokens.css puts it at the head of
// --surge-font for the redesigned components, and marketing.css reads it
// directly for the pages that have not been rebuilt yet. One font, site-wide,
// named in one place — swapping Public Sans out here moves all twenty-two
// routes towards the mockup at once instead of leaving the home page in a
// different face from its own navigation.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-marketing",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.surgetechpos.com"),
  title: {
    default: "Surge — Point of sale for restaurants, cafes and retail",
    template: "%s — Surge",
  },
  description:
    "Run your menu, floor, kitchen, inventory and team with Surge POS. Explore the free pilot. Card processing and payment terminals are coming soon.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon-192.png",
  },
  openGraph: { ...OG_BASE, url: "/" },
  twitter: { card: "summary_large_image" },
};

// ONE HEADER AND ONE FOOTER FOR ALL TWENTY-TWO ROUTES.
//
// The chrome is the part of the handoff that is explicitly reusable, and the
// mockups draw the same rail on every page: the lockup, then Product,
// Solutions, Pricing, Guides, then Sign in and Book a demo. Codex's SiteNav
// said "Resources" instead of "Guides" and carried an announcement strip the
// mockups do not have, and its footer had three columns where the mockups have
// four. Mixing the two — new chrome on the home page, old chrome elsewhere —
// would have meant two headers to keep in step and a visible seam on every
// navigation, so the swap is site-wide and site-nav.tsx is gone.
//
// WHAT STAYS FROM THE OLD LAYOUT, AND WHY. The skip link keeps its .s-skip
// class and its #main-content target, <main> keeps its id and tabIndex (the
// skip link focuses it), SiteMotion keeps running because the twenty-one pages
// that have not been rebuilt still reveal their sections through it, and the
// metadata and viewport blocks are untouched — they carry the title template
// every one of those pages composes its own title against.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `surge-scope` is where --surge-font resolves: next/font's variable and
    // the token that reads it have to be declared on the same element, or the
    // token is substituted against a :root that has no --font-marketing and
    // inherits down as nothing. `relative` is the overlay header's containing
    // block. The colour and family here are the redesign's; each page body
    // that has not been rebuilt restates its own inside .surge-site.
    <div
      className={
        `${inter.variable} surge-scope relative min-h-screen bg-[var(--surge-surface)] ` +
        "font-[family-name:var(--surge-font)] text-[var(--surge-ink)] antialiased " +
        "selection:bg-[var(--surge-accent-soft)]"
      }
    >
      <JsonLd data={ORGANIZATION} />
      <a className="s-skip" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <SiteMotion />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
