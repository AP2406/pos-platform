import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "./site-nav";

export const metadata: Metadata = {
  metadataBase: new URL("https://surgetechpos.com"),
  title: { default: "Surge — Transparent payments for local business", template: "%s — Surge" },
  description: "Surge gives local businesses transparent card processing powered by Finix, real human support, and software that shows you exactly what you keep.",
  openGraph: { title: "Surge — Transparent payments for local business", description: "Card processing powered by Finix, real human support, and software that shows you exactly what you keep.", url: "https://surgetechpos.com", siteName: "Surge", type: "website" },
  twitter: { card: "summary_large_image", title: "Surge — Transparent payments for local business", description: "Card processing powered by Finix, with software that shows you exactly what you keep." },
};

const keyframes = "@keyframes surge-drift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(4%,-3%) scale(1.06)}66%{transform:translate(-3%,4%) scale(0.96)}}@keyframes surge-rise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}@keyframes surge-fade{from{opacity:0}to{opacity:1}}";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070d] text-white antialiased selection:bg-indigo-500/40">
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full bg-indigo-600/25 blur-[120px] [animation:surge-drift_22s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -right-40 h-[40rem] w-[40rem] rounded-full bg-cyan-500/15 blur-[130px] [animation:surge-drift_28s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-0 left-1/3 h-[36rem] w-[36rem] rounded-full bg-fuchsia-600/15 blur-[140px] [animation:surge-drift_26s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,#06070d_100%)]" />
      </div>
      <SiteNav />
      <main className="relative">{children}</main>
      <footer className="relative mt-24 border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="text-xl font-semibold tracking-tight">Surge</div>
            <p className="mt-3 max-w-sm text-sm text-white/60">Transparent payments powered by Finix, with software that shows you exactly what you keep &mdash; and a real person on the other end of the phone.</p>
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
        <div className="mx-auto max-w-6xl px-6 pb-10 text-xs text-white/40">© 2026 Surge. Payments powered by Finix.</div>
      </footer>
    </div>
  );
}