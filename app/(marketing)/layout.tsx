import type { Metadata } from "next";
import Link from "next/link";
import { Public_Sans } from "next/font/google";
import { SiteNav } from "./site-nav";
import { SurgeMark } from "./surge-mark";
import { OG_BASE } from "./shared-metadata";
import { JsonLd, LOCAL_BUSINESS } from "./jsonld";

const publicSans = Public_Sans({ subsets: ["latin"], display: "swap", variable: "--font-marketing" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.surgetechpos.com"),
  title: { default: "Surge — Transparent payments for local business", template: "%s — Surge" },
  description: "Surge gives local businesses lower card processing rates, real human support, and built-in software that shows exactly how much you save on every sale.",
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
      <JsonLd data={LOCAL_BUSINESS} />
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      <SiteNav />
      <main className="relative">{children}</main>
      <footer className="bg-[#0B1E33] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <SurgeMark className="h-[28px] w-[47px]" />
              <span className="text-xl font-bold tracking-tight text-white">Surge</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#8FA3B8]">Lower card processing rates and software that shows your savings on every sale &mdash; plus a real person on the other end of the phone.</p>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#6C8199]">Product</div>
            <ul className="mt-4 space-y-2.5 text-sm text-[#C2D0DE]">
              <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="/pos" className="hover:text-white">Point of sale</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#6C8199]">Solutions</div>
            <ul className="mt-4 space-y-2.5 text-sm text-[#C2D0DE]">
              <li><Link href="/payment-processing-toronto" className="hover:text-white">Payment processing Toronto</Link></li>
              <li><Link href="/payment-processing-mississauga" className="hover:text-white">Payment processing Mississauga</Link></li>
              <li><Link href="/merchant-services-durham" className="hover:text-white">Merchant services Durham</Link></li>
              <li><Link href="/pos-for-restaurants" className="hover:text-white">POS for restaurants</Link></li>
              <li><Link href="/pos-for-retail" className="hover:text-white">POS for retail</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#6C8199]">Compare</div>
            <ul className="mt-4 space-y-2.5 text-sm text-[#C2D0DE]">
              <li><Link href="/moneris-alternative" className="hover:text-white">Moneris alternative</Link></li>
              <li><Link href="/square-alternative" className="hover:text-white">Square alternative</Link></li>
              <li><Link href="/clover-alternative" className="hover:text-white">Clover alternative</Link></li>
              <li><Link href="/stripe-alternative" className="hover:text-white">Stripe alternative</Link></li>
              <li><Link href="/td-merchant-solutions-alternative" className="hover:text-white">TD Merchant Solutions alternative</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#6C8199]">Get started</div>
            <ul className="mt-4 space-y-2.5 text-sm text-[#C2D0DE]">
              <li><Link href="/book" className="hover:text-white">Book a call</Link></li>
              <li><Link href="/guides" className="hover:text-white">Guides</Link></li>
              <li><Link href="/login" className="hover:text-white">Sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-[#1C3550] px-6 py-6 text-xs text-[#6C8199] sm:flex-row sm:justify-between">
          <span>&copy; 2026 Surge. Smarter payments for local business.</span>
          <span>Toronto &middot; Mississauga &middot; Durham Region</span>
        </div>
      </footer>
    </div>
  );
}
