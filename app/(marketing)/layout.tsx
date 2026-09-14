import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./tokens.css";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import { OG_BASE } from "./shared-metadata";
import { JsonLd, ORGANIZATION } from "./jsonld";

// INTER, NOT PUBLIC SANS. design-tokens.css names the family outright
// (`--surge-font: Inter, …`) and DESIGN-SYSTEM.md asks for "an Inter-style
// sans-serif stack" using real font assets. next/font self-hosts it, so there
// is no third-party request and no layout shift; the CSS variable it publishes
// is the first entry in --surge-font, which means the token is the single place
// the family is decided and the handoff's stack is the fallback chain.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-marketing" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.surgetechpos.com"),
  title: { default: "Surge — Point of sale for local business", template: "%s — Surge" },
  description: "Surge is a point-of-sale system for restaurants, cafés and shops — register, floor plan, kitchen display, online and QR ordering, inventory, staff and reports. Payment terminal coming soon.",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/icon-192.png" },
  openGraph: { ...OG_BASE, url: "/" },
  // No title/description — Twitter tags inherit each page's own title/description.
  twitter: { card: "summary_large_image" },
};

// Kept for the pages that still reference the surge-* entrance animations.
// Phase 2 removes these along with the last <Reveal>.
const keyframes = "@keyframes surge-rise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}@keyframes surge-fade{from{opacity:0}to{opacity:1}}";

// THE HEADER AND FOOTER MOVE SITE-WIDE IN THIS PASS, AND THE BODIES DO NOT.
// Phase 1 rebuilds the design system and the home page. The other twenty-one
// routes keep their current navy body palette until their own pass, so those
// pages render new chrome over old sections for the moment. That is a visible
// seam and it is the deliberate choice: header and footer are the two
// components the handoff asks to be reusable, and shipping a second copy of
// each for one page would have meant two headers to keep in step.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    // `surge-scope` is what carries the focus-ring rule for the whole marketing
    // tree (see tokens.css). Declared once here rather than per component,
    // because a ring added component-by-component is a ring that the next
    // component forgets.
    <div
      className={
        inter.variable +
        " surge-scope relative min-h-screen bg-[var(--surge-surface)] font-[family-name:var(--surge-font)] text-[var(--surge-ink)] antialiased selection:bg-[var(--surge-accent-soft)]"
      }
    >
      <JsonLd data={ORGANIZATION} />
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      {/* First focusable element in the document. The home page's hero is a
          full-bleed photograph with the nav sitting on it, so a keyboard user
          otherwise tabs the entire header before reaching any content. */}
      <a href="#main" className="surge-skip">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="relative">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
