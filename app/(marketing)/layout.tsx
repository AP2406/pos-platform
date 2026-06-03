import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "./site-nav";
import { SurgeMark } from "./surge-mark";

export const metadata: Metadata = {
  metadataBase: new URL("https://surgetechpos.com"),
  title: { default: "Surge \u2014 Transparent payments for local business", template: "%s \u2014 Surge" },
  description: "Surge gives local businesses lower card processing rates, real human support, and built-in software that shows exactly how much you save on every sale.",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/icon-192.png" },
  openGraph: { title: "Surge \u2014 Transparent payments for local business", description: "Lower card processing rates, real local support, and software that shows your savings on every sale.", url: "https://surgetechpos.com", siteName: "Surge", type: "website" },
  twitter: { card: "summary_large_image", title: "Surge \u2014 Transparent payments for local business", description: "Lower card processing rates and software that shows your savings on every sale." },
};

const keyframes = "@keyframes surge-drift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(4%,-3%) scale(1.06)}66%{transform:translate(-3%,4%) scale(0.96)}}@keyframes surge-rise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}@keyframes surge-fade{from{opacity:0}to{opacity:1}}@keyframes surge-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}@keyframes surge-shimmer{0%{background-position:0% center}100%{background-position:200% center}}@keyframes surge-spin{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}";

const grid = { backgroundImage: "linear-gradient(to right, rgba(37,99,235,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.06) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 78%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 78%)" };
const footerDots = { backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 80%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 80%)" };

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900 antialiased selection:bg-blue-200">
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0" style={grid} />
        <div className="absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full bg-blue-300/30 blur-[120px] [animation:surge-drift_22s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -right-40 h-[40rem] w-[40rem] rounded-full bg-cyan-300/25 blur-[130px] [animation:surge-drift_28s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-0 left-1/3 h-[36rem] w-[36rem] rounded-full bg-sky-300/25 blur-[140px] [animation:surge-drift_26s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,white_100%)]" />
      </div>
      <SiteNav />
      <main className="relative">{children}</main>
      <footer className="relative overflow-hidden bg-[#0E1A2B] text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={footerDots} />
        <div className="pointer-events-none absolute -right-32 -top-24 h-[24rem] w-[24rem] rounded-full bg-blue-500/15 blur-[120px]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <SurgeMark className="h-[28px] w-[47px]" />
              <span className="text-xl font-semibold tracking-tight text-white">Surge</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-white/60">Lower card processing rates and software that shows your savings on every sale &mdash; plus a real person on the other end of the phone.</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40">Product</div>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="/pos" className="hover:text-white">Point of sale</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40">Get started</div>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><Link href="/book" className="hover:text-white">Book a call</Link></li>
              <li><Link href="/login" className="hover:text-white">Sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl border-t border-white/10 px-6 py-6 text-xs text-white/40">&copy; 2026 Surge. Smarter payments for local business.</div>
      </footer>
    </div>
  );
}