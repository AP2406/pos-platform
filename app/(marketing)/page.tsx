import type { Metadata } from "next";
import Link from "next/link";
import { SavingsEstimator } from "./savings-estimator";

export const metadata: Metadata = {
  title: { absolute: "Surge — Transparent payments for local business in the GTA" },
  description: "Card processing powered by Finix with no hidden fees, real human support across the GTA, and built-in software that shows you exactly what you keep. See what you're overpaying and book a call with Surge.",
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

      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-36 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-600 [animation:surge-fade_1s_ease-out_both]">Payments powered by Finix</div>
        <h1 className="mx-auto mt-7 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl [animation:surge-rise_0.8s_ease-out_both]">Keep <span className="bg-gradient-to-r from-indigo-600 via-cyan-500 to-fuchsia-600 bg-clip-text text-transparent">more</span> of every sale</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 [animation:surge-rise_0.8s_ease-out_0.12s_both]">Most processors bury their fees in a statement you can&apos;t read. Surge shows you exactly what you keep &mdash; transparent pricing, real local support, and software included. See what you&apos;re overpaying:</p>

        <div className="mt-10 [animation:surge-rise_0.9s_ease-out_0.24s_both]"><SavingsEstimator /></div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-slate-400 [animation:surge-fade_1.4s_ease-out_both]">
          <span>Powered by Finix</span>
          <span className="text-slate-300">&bull;</span>
          <span>Tap, chip &amp; swipe</span>
          <span className="text-slate-300">&bull;</span>
          <span>Apple Pay &amp; Google Pay</span>
          <span className="text-slate-300">&bull;</span>
          <span>Interac</span>
        </div>
        <div className="mt-4 text-sm text-slate-500">Prefer to browse first? <Link href="/pricing" className="font-medium text-indigo-600 hover:text-indigo-700">See transparent pricing</Link></div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="h-10 w-10 rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-500/20 to-cyan-400/15" />
            <h3 className="mt-5 text-lg font-semibold text-slate-900">Transparent pricing</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">One clear rate. No statement-fee maze, no surprise line items. You always know what a sale actually earned.</p>
          </div>
          <div className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="h-10 w-10 rounded-xl border border-slate-200 bg-gradient-to-br from-cyan-400/20 to-fuchsia-500/15" />
            <h3 className="mt-5 text-lg font-semibold text-slate-900">Real local support</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Based in the GTA. We set up your terminal in person and pick up the phone &mdash; you talk to a human, not a ticket queue.</p>
          </div>
          <div className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className="h-10 w-10 rounded-xl border border-slate-200 bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/15" />
            <h3 className="mt-5 text-lg font-semibold text-slate-900">Software included</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Point of sale, sales reports, and insights on what to reorder and when &mdash; built in, not a costly monthly add-on.</p>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 lg:p-14">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-widest text-indigo-600">Point of sale</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">A full register, included with your payments</h2>
            <p className="mt-4 leading-relaxed text-slate-600">Ring up sales, split tender, run refunds, track inventory, and email receipts &mdash; all in one place, on the device you already have. No separate POS bill.</p>
            <Link href="/pos" className="mt-7 inline-flex rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50">Explore the POS</Link>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-28 text-center">
        <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">See what you&apos;d actually keep</h2>
        <p className="mx-auto mt-5 max-w-xl text-slate-600">A 15-minute call, a clear quote, and an honest look at your current processor&apos;s fees. No pressure.</p>
        <div className="mt-9 flex items-center justify-center">
          <Link href="/book" className="rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 px-8 py-4 text-sm font-semibold text-white shadow-[0_14px_50px_-12px_rgba(79,70,229,0.6)] transition-shadow hover:shadow-[0_18px_60px_-10px_rgba(6,182,212,0.6)]">Book a call</Link>
        </div>
      </section>
    </>
  );
}