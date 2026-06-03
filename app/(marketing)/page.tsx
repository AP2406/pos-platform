import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Surge — Transparent payments for local business in the GTA" },
  description: "Card processing powered by Finix with no hidden fees, real human support across the GTA, and built-in software that shows you exactly what you keep. Book a call with Surge.",
  alternates: { canonical: "/" },
};

const org = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Surge",
  description: "Transparent payment processing and point-of-sale software for local businesses, powered by Finix.",
  url: "https://surgetechpos.com",
  areaServed: "Greater Toronto Area, Ontario, Canada",
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />

      <section className="relative mx-auto max-w-6xl px-6 pb-28 pt-40 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 [animation:surge-fade_1s_ease-out_both]">Payments powered by Finix</div>
        <h1 className="mx-auto mt-7 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl [animation:surge-rise_0.8s_ease-out_both]">Payments that show you <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">exactly what you keep</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/65 [animation:surge-rise_0.8s_ease-out_0.12s_both]">Surge is transparent card processing for local businesses &mdash; no buried fees, a real person on the phone, and software that shows your true margin on every sale.</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row [animation:surge-rise_0.8s_ease-out_0.24s_both]">
          <Link href="/book" className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 px-7 py-3.5 text-sm font-semibold text-[#06070d] shadow-[0_0_40px_-8px_rgba(99,102,241,0.7)] transition-shadow hover:shadow-[0_0_60px_-6px_rgba(34,211,238,0.7)]">Book a call</Link>
          <Link href="/pricing" className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-white/10">See transparent pricing</Link>
        </div>

        <div className="relative mt-20 [animation:surge-rise_1s_ease-out_0.36s_both]">
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_120px_-30px_rgba(99,102,241,0.5)] backdrop-blur-xl">
            <div className="flex items-center justify-between text-left">
              <div>
                <div className="text-xs text-white/40">Today</div>
                <div className="text-3xl font-semibold tabular-nums">$4,820.00</div>
                <div className="mt-1 text-xs text-emerald-400">You keep $4,694.68 after fees</div>
              </div>
              <div className="text-right text-xs text-white/40">
                <div>Processing</div>
                <div className="text-white/70">$125.32</div>
              </div>
            </div>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[97.4%] rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" />
            </div>
            <div className="mt-2 text-left text-[11px] text-white/40">Illustrative. Your real numbers appear here.</div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06]">
            <div className="h-10 w-10 rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/30 to-cyan-400/20" />
            <h3 className="mt-5 text-lg font-semibold">Transparent pricing</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">One clear rate. No statement-fee maze, no surprise line items. You always know what a sale actually earned.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06]">
            <div className="h-10 w-10 rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400/30 to-fuchsia-500/20" />
            <h3 className="mt-5 text-lg font-semibold">Real local support</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">Based in the GTA. We set up your terminal in person and pick up the phone &mdash; you talk to a human, not a ticket queue.</p>
          </div>
          <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06]">
            <div className="h-10 w-10 rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/30 to-indigo-500/20" />
            <h3 className="mt-5 text-lg font-semibold">Software included</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">Point of sale, sales reports, and insights on what to reorder and when &mdash; built in, not a costly monthly add-on.</p>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-10 lg:p-14">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-widest text-cyan-300/80">Point of sale</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">A full register, included with your payments</h2>
            <p className="mt-4 leading-relaxed text-white/65">Ring up sales, split tender, run refunds, track inventory, and email receipts &mdash; all in one place, on the device you already have. No separate POS bill.</p>
            <Link href="/pos" className="mt-7 inline-flex rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium transition-colors hover:bg-white/10">Explore the POS</Link>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-28 text-center">
        <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">See what you&apos;d actually keep</h2>
        <p className="mx-auto mt-5 max-w-xl text-white/65">A 15-minute call, a clear quote, and an honest look at your current processor&apos;s fees. No pressure.</p>
        <div className="mt-9 flex items-center justify-center">
          <Link href="/book" className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 px-8 py-4 text-sm font-semibold text-[#06070d] shadow-[0_0_50px_-10px_rgba(99,102,241,0.8)] transition-shadow hover:shadow-[0_0_70px_-8px_rgba(34,211,238,0.8)]">Book a call</Link>
        </div>
      </section>
    </>
  );
}