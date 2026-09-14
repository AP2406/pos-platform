import type { Metadata } from "next";
import Link from "next/link";
import { Public_Sans } from "next/font/google";
import { SiteNav } from "./site-nav";
import { SurgeLogo } from "@/components/brand/surge-logo";
import { OG_BASE } from "./shared-metadata";
import { JsonLd, ORGANIZATION } from "./jsonld";

const publicSans = Public_Sans({ subsets: ["latin"], display: "swap", variable: "--font-marketing" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.surgetechpos.com"),
  title: { default: "Surge — Point of sale for local business", template: "%s — Surge" },
  description: "Surge is a point-of-sale system for restaurants, cafes and shops — register, floor plan, kitchen display, online and QR ordering, inventory, staff and reports. Card processing coming soon.",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/icon-192.png" },
  openGraph: { ...OG_BASE, url: "/" },
  // No title/description — Twitter tags inherit each page's own title/description.
  twitter: { card: "summary_large_image" },
};

// Kept for pages that still reference the surge-* entrance animations.
const keyframes = "@keyframes surge-rise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}@keyframes surge-fade{from{opacity:0}to{opacity:1}}";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={publicSans.variable + " relative min-h-screen bg-white font-[family-name:var(--font-marketing),'Public_Sans',Arial,sans-serif] text-[#1A2B3C] antialiased selection:bg-[#CFE3F7]"}>
      <JsonLd data={ORGANIZATION} />
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      <SiteNav />
      <main className="relative">{children}</main>
      <footer className="bg-[#0B1E33] text-white">
        {/* SIX COLUMNS -> FIVE. The column that came out was "Across the GTA"
            (Toronto / Mississauga / Durham Region). Dropping it and leaving the
            grid at six would have left a hole in the last cell at lg; the brand
            column still spans two, so 2+1+1+1 fills five exactly. */}
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {/* The footer takes the full lockup where the nav takes the icon:
                this column is ~370px wide with nothing beside the mark, which
                clears the kit's 220px floor, and a footer is where a brand is
                allowed to sign its name properly. `tone="dark"` is pinned —
                the footer is #0B1E33 navy irrespective of theme, and the
                marketing site never renders in dark mode anyway. */}
            <SurgeLogo tone="dark" className="h-[65px] w-[220px]" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#8FA3B8]">A point-of-sale system that runs the floor, the kitchen and the counter &mdash; plus a real person on the other end of the phone.</p>
          </div>
          {/* FOOTER GROUPS ARE THE SITE'S OWN RANKING OF ITSELF.
              Product used to be Pricing-then-POS; the POS is now first and the
              two industry pages joined it, because those are the pages we want
              crawled and clicked. The five competitor pages sit below them —
              that is the demoted set.
              The "Across the GTA" group is GONE, not demoted: its three links
              pointed at /payment-processing-toronto, -mississauga and
              /merchant-services-durham, which are now permanent redirects to
              /pos. Linking a 308 from every page in the site is a crawl budget
              spent on a hop, and the anchor text was three city names. */}
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#6C8199]">Point of sale</div>
            <ul className="mt-4 space-y-2.5 text-sm text-[#C2D0DE]">
              <li><Link href="/pos" className="hover:text-white">The POS</Link></li>
              <li><Link href="/pos-for-restaurants" className="hover:text-white">POS for restaurants</Link></li>
              <li><Link href="/pos-for-retail" className="hover:text-white">POS for retail</Link></li>
              {/* Same URL, longer label. A footer has the room to keep the
                  word "pricing" as anchor text — which is what /pricing ranks
                  on — while still saying what the page now offers. */}
              <li><Link href="/pricing" className="hover:text-white">Pricing &mdash; free pilot</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#6C8199]">Switching from</div>
            <ul className="mt-4 space-y-2.5 text-sm text-[#C2D0DE]">
              <li><Link href="/square-alternative" className="hover:text-white">Square</Link></li>
              <li><Link href="/clover-alternative" className="hover:text-white">Clover</Link></li>
              <li><Link href="/moneris-alternative" className="hover:text-white">Moneris</Link></li>
              <li><Link href="/stripe-alternative" className="hover:text-white">Stripe</Link></li>
              <li><Link href="/td-merchant-solutions-alternative" className="hover:text-white">TD Merchant Solutions</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#6C8199]">Get started</div>
            <ul className="mt-4 space-y-2.5 text-sm text-[#C2D0DE]">
              {/* The pilot leads this group because it is the action we want;
                  the demo sits directly under it as the softer one. */}
              <li><Link href="/pricing#apply" className="hover:text-white">Join the pilot</Link></li>
              <li><Link href="/book" className="hover:text-white">Book a demo</Link></li>
              <li><Link href="/guides" className="hover:text-white">Guides</Link></li>
              <li><Link href="/login" className="hover:text-white">Sign in</Link></li>
              <li><span className="text-[#6C8199]">Card processing &mdash; coming soon</span></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-[#1C3550] px-6 py-6 text-xs text-[#6C8199] sm:flex-row sm:justify-between">
          <span>&copy; 2026 Surge. Point of sale for local business.</span>
          {/* Was "Toronto · Mississauga · Durham Region" — a three-city
              signature on every page. What replaces it is the one thing about
              geography that is still true and still worth saying: the software
              runs anywhere and we set it up over a call. No country list. */}
          <span>Software that runs anywhere &middot; onboarding is remote</span>
        </div>
      </footer>
    </div>
  );
}
