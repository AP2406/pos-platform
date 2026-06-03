import type { Metadata } from "next";
import Link from "next/link";
import { SavingsEstimator } from "./savings-estimator";
import { Reveal } from "./reveal";

export const metadata: Metadata = {
  title: { absolute: "Surge — Transparent payments for local business in the GTA" },
  description: "Stop overpaying to get paid. Surge is transparent card processing powered by Finix, with software included and real local support across the GTA. See what you're overpaying and book a free call.",
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

      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-36">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-700 [animation:surge-fade_1s_ease-out_both]">Payments powered by Finix</div>
            <h1 className="mt-6 text-5xl font-bold leading-[1.03] tracking-tight text-slate-900 sm:text-6xl [animation:surge-rise_0.8s_ease-out_both]">Stop <span className="bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-cyan-500 bg-clip-text text-transparent">overpaying</span> to get paid.</h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600 [animation:surge-rise_0.8s_ease-out_0.12s_both]">Hidden rates. Junk monthly fees. Statements built to confuse you. Surge is transparent payments for local business &mdash; a fair rate, software included, and a real person who answers the phone.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start [animation:surge-rise_0.8s_ease-out_0.24s_both]">
              <Link href="/book" className="rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(79,70,229,0.6)] transition-shadow hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)]">Book a free call</Link>
              <Link href="/pricing" className="rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50">See pricing</Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-semibold lg:justify-start [animation:surge-fade_1.4s_ease-out_both]">
              <span className="text-emerald-600">No junk fees</span>
              <span className="text-indigo-600">No lock-in contracts</span>
              <span className="text-fuchsia-600">No call-center maze</span>
            </div>
          </div>

          <div className="relative mx-auto max-w-md [animation:surge-rise_1s_ease-out_0.2s_both]">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-indigo-500/20 via-fuchsia-500/15 to-cyan-500/20 blur-2xl" />
            <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-400">Today&apos;s sales</div>
                <div className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Live</div>
              </div>
              <div className="mt-2 text-4xl font-bold tabular-nums text-slate-900">$4,820.00</div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Processing fees</span><span className="tabular-nums text-rose-500">- $125.32</span></div>
                <div className="flex justify-between text-sm font-semibold"><span className="text-slate-700">You keep</span><span className="tabular-nums text-emerald-600">$4,694.68</span></div>
              </div>
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[97.4%] rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-500" /></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-medium">
                <div className="rounded-lg bg-indigo-50 py-2 text-indigo-700">Tap</div>
                <div className="rounded-lg bg-cyan-50 py-2 text-cyan-700">Chip</div>
                <div className="rounded-lg bg-fuchsia-50 py-2 text-fuchsia-700">Apple Pay</div>
              </div>
            </div>
            <div className="mt-3 text-center text-[11px] text-slate-400">Sample dashboard</div>
          </div>
        </div>
      </section>

      <section className="relative py-16">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-8 sm:p-12">
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600">The fee reality check</div>
                <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">How much are card fees really costing you?</h2>
                <p className="mt-3 text-slate-600">Drag the slider. Most owners are not ready for the number.</p>
              </div>
              <div className="mt-8"><SavingsEstimator /></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-16">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Why owners switch to Surge</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">Three things the big processors structurally can&apos;t give you.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-400 text-lg font-bold text-white">$</div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">Transparent pricing</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">One clear rate. No statement-fee maze, no surprise line items. You always know what a sale actually earned.</p>
            </div>
            <div className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 text-lg font-bold text-white">@</div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">Real local support</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Based in the GTA. We set up your terminal in person and pick up the phone &mdash; you talk to a human, not a ticket queue.</p>
            </div>
            <div className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-200 hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-400 text-lg font-bold text-white">+</div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">Software included</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Point of sale, sales reports, and insights on what to reorder and when &mdash; built in, not a costly monthly add-on.</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-16">
        <Reveal>
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 lg:p-14">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Point of sale</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">A full register, included with your payments</h2>
              <p className="mt-4 leading-relaxed text-slate-600">Ring up sales, split tender, run refunds, track inventory, and email receipts &mdash; all in one place, on the device you already have. No separate POS bill.</p>
              <Link href="/pos" className="mt-7 inline-flex rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50">Explore the POS</Link>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="relative px-6 py-24">
        <Reveal>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-cyan-500 p-12 text-center text-white shadow-2xl sm:p-16">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">See what you&apos;d actually keep</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85">A 15-minute call, a clear quote, and an honest look at your current processor&apos;s fees. No pressure, no jargon.</p>
            <div className="mt-8 flex justify-center">
              <Link href="/book" className="rounded-full bg-white px-8 py-4 text-sm font-semibold text-indigo-700 shadow-lg transition-transform hover:scale-105">Book my free call</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}