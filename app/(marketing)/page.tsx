import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SavingsEstimator } from "./savings-estimator";
import { Reveal } from "./reveal";

export const metadata: Metadata = {
  title: { absolute: "Payment Processing & Point of Sale for the GTA | Surge" },
  description: "Surge delivers transparent payment processing and point-of-sale software for local businesses across the GTA — lower card rates, no junk fees. Book a free call.",
  keywords: ["payment processing", "point of sale", "POS system", "payment solutions", "merchant services", "card processing", "credit card processing", "GTA", "Toronto", "Durham", "Ontario"],
  alternates: { canonical: "/" },
  openGraph: { title: "Payment Processing & Point of Sale for the GTA | Surge", description: "Transparent payment processing and point-of-sale software for local business. Lower card rates, no junk fees, no lock-in.", url: "https://surgetechpos.com", type: "website" },
};

const org = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Surge",
  description: "Transparent payment processing and point-of-sale (POS) software for local businesses in the Greater Toronto Area.",
  url: "https://surgetechpos.com",
  areaServed: "Greater Toronto Area, Ontario, Canada",
};

const darkDots = { backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse at 50% 50%, black, transparent 80%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, black, transparent 80%)" };

function Eyebrow({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "cyan" | "sky" }) {
  const map = { blue: "border-blue-200 bg-blue-50 text-blue-700", cyan: "border-cyan-200 bg-cyan-50 text-cyan-700", sky: "border-sky-200 bg-sky-50 text-sky-700" } as const;
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider " + map[color]}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[85%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
        <div className="pointer-events-none absolute -left-32 top-10 h-[34rem] w-[34rem] rounded-full bg-blue-300/30 blur-[120px] [animation:surge-drift_24s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute right-0 top-28 h-[30rem] w-[30rem] rounded-full bg-cyan-300/25 blur-[120px] [animation:surge-drift_28s_ease-in-out_infinite_reverse]" />
        <div className="pointer-events-none absolute left-[12%] top-44 hidden h-3 w-3 rotate-45 rounded-[3px] bg-gradient-to-br from-blue-500 to-cyan-500 opacity-60 lg:block [animation:surge-float_7s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute right-[16%] bottom-28 hidden h-2.5 w-2.5 rotate-45 rounded-[3px] bg-gradient-to-br from-cyan-500 to-sky-500 opacity-50 lg:block [animation:surge-float_6s_ease-in-out_infinite_0.5s]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-36">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-1.5 text-xs font-medium text-blue-700 shadow-sm backdrop-blur [animation:surge-fade_1s_ease-out_both]"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" /></span>Payment processing &amp; point of sale</span>
              <h1 className="mt-6 text-5xl font-bold leading-[1.03] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl [animation:surge-rise_0.8s_ease-out_both]">Stop <span className="bg-[linear-gradient(90deg,#2563eb,#06b6d4,#38bdf8,#06b6d4,#2563eb)] bg-[length:200%_auto] bg-clip-text text-transparent [animation:surge-shimmer_5s_linear_infinite]">overpaying</span> to get paid.</h1>
              <p className="mt-6 max-w-xl text-lg text-slate-600 [animation:surge-rise_0.8s_ease-out_0.12s_both]">Hidden rates and junk monthly fees, gone. Surge is the all-in-one payment solution for local business &mdash; transparent card payment processing and built-in point-of-sale software, at a lower rate, with a real person who answers the phone.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start [animation:surge-rise_0.8s_ease-out_0.24s_both]">
                <Link href="/book" className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(37,99,235,0.6)] transition-shadow hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)]">Book a free call</Link>
                <Link href="/pricing" className="rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50">See pricing</Link>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-semibold lg:justify-start [animation:surge-fade_1.4s_ease-out_both]">
                <span className="text-emerald-600">No junk fees</span>
                <span className="text-blue-600">No lock-in contracts</span>
                <span className="text-cyan-600">No call-center maze</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl [animation:surge-rise_1s_ease-out_0.2s_both]">
              <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-tr from-blue-500/20 via-sky-500/15 to-cyan-500/20 blur-2xl" />
              <div className="absolute -inset-[2px] overflow-hidden rounded-[calc(1.5rem+2px)]">
                <div className="absolute left-1/2 top-1/2 h-[230%] w-[230%] bg-[conic-gradient(from_0deg,#2563eb,#06b6d4,#38bdf8,#a5f3fc,#06b6d4,#2563eb)] [animation:surge-spin_9s_linear_infinite]" />
              </div>
              <div className="pointer-events-none absolute -right-3 -top-3 z-10 hidden rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur lg:block [animation:surge-float_5s_ease-in-out_infinite]"><div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><span className="h-2 w-2 rounded-full bg-cyan-500" />Apple Pay</div></div>
              <div className="pointer-events-none absolute -left-4 top-1/3 z-10 hidden rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 shadow-lg backdrop-blur lg:block [animation:surge-float_5.6s_ease-in-out_infinite_0.3s]"><span className="text-xs font-semibold text-blue-700">Interac</span></div>
              <div className="pointer-events-none absolute -bottom-4 -right-2 z-10 hidden rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur lg:block [animation:surge-float_6s_ease-in-out_infinite_0.6s]"><div className="flex items-center gap-1.5"><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span><span className="text-[11px] font-medium text-slate-500">Approved</span></div><div className="text-sm font-bold tabular-nums text-emerald-600">+ $128.40</div></div>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/60 shadow-2xl">
                <Image src="/jpg6.jpg" alt="A local business owner taking a tap card payment at a salon counter" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                <div className="absolute bottom-4 left-4 rounded-2xl border border-white/60 bg-white/85 px-4 py-3 shadow-lg backdrop-blur">
                  <div className="text-[11px] font-medium text-slate-500">You save</div>
<div className="text-xl font-bold tabular-nums text-emerald-600">0.4% + 15&cent;</div>                  <div className="text-[11px] text-slate-500">on every sale</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </section>

      <section className="relative border-y border-slate-200 bg-slate-50/80 py-6 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-sm font-medium text-slate-500">Accepts every way they want to pay</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["Tap", "Chip & swipe", "Apple Pay", "Google Pay", "Interac", "Visa", "Mastercard"].map((m) => (<span key={m} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{m}</span>))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
        <div className="pointer-events-none absolute -left-24 top-8 h-80 w-80 rounded-full bg-blue-300/25 blur-[110px]" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-cyan-300/25 blur-[110px]" />
        <div className="relative mx-auto max-w-5xl px-6">
          <Reveal>
            <div className="text-center">
              <Eyebrow color="cyan">The fee reality check</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">How much are card fees really costing you?</h2>
              <p className="mt-3 text-slate-600">Drag the sliders. Most owners are not ready for the number.</p>
            </div>
            <div className="mt-8 grid items-center gap-8 lg:grid-cols-5">
              <div className="relative hidden aspect-[4/5] overflow-hidden rounded-2xl border border-white shadow-md lg:col-span-2 lg:block">
                <Image src="/jpg11.jpg" alt="A small plant growing out of a cup full of coins" fill sizes="40vw" className="object-cover" />
              </div>
              <div className="lg:col-span-3"><SavingsEstimator /></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0E1A2B] py-20 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={darkDots} />
        <div className="pointer-events-none absolute -right-40 top-0 h-[30rem] w-[30rem] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -left-40 bottom-0 h-[28rem] w-[28rem] rounded-full bg-cyan-500/15 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="mb-10 flex flex-col items-center text-center">
              <Eyebrow color="cyan">Why Surge</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Why owners switch to Surge</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/70">Three things the big processors structurally can&apos;t give you.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="group rounded-2xl border border-white/10 bg-white/5 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-lg font-bold text-white">$</div>
                <h3 className="mt-5 text-lg font-semibold">A lower, honest rate</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">One clear rate, less than the big guys. No statement-fee maze, no surprise line items &mdash; you keep more of every sale you fight for.</p>
              </div>
              <div className="group rounded-2xl border border-white/10 bg-white/5 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-400 text-lg font-bold text-white">@</div>
                <h3 className="mt-5 text-lg font-semibold">Real local support</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">Based in the GTA. We set up your terminal in person and pick up the phone &mdash; you talk to a human, not a ticket queue.</p>
              </div>
              <div className="group rounded-2xl border border-white/10 bg-white/5 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 text-lg font-bold text-white">+</div>
                <h3 className="mt-5 text-lg font-semibold">Software included</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">Point of sale, sales reports, and insights on what to reorder and when &mdash; built in, not a costly monthly add-on.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/50 to-white py-20">
        <div className="pointer-events-none absolute right-1/4 top-8 h-72 w-72 rounded-full bg-sky-300/20 blur-[110px]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="mb-10 flex flex-col items-center text-center">
              <Eyebrow color="sky">Who it&apos;s for</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Built for businesses like yours</h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">From the counter to the chair, Surge runs the real-world spots across the GTA.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <figure className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 shadow-sm ring-1 ring-transparent transition-shadow duration-300 hover:shadow-lg hover:ring-blue-200">
                <Image src="/jpg9.jpg" alt="A customer paying at the counter of a local coffee shop" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <figcaption className="absolute bottom-4 left-4 text-sm font-semibold text-white">Cafes &amp; coffee shops</figcaption>
              </figure>
              <figure className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 shadow-sm ring-1 ring-transparent transition-shadow duration-300 hover:shadow-lg hover:ring-cyan-200">
                <Image src="/jpg3.jpg" alt="A stylist taking a mobile payment at a salon front desk" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <figcaption className="absolute bottom-4 left-4 text-sm font-semibold text-white">Salons &amp; spas</figcaption>
              </figure>
              <figure className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 shadow-sm ring-1 ring-transparent transition-shadow duration-300 hover:shadow-lg hover:ring-sky-200">
                <Image src="/jpg1.jpg" alt="A customer tapping a phone to pay at a checkout terminal" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <figcaption className="absolute bottom-4 left-4 text-sm font-semibold text-white">Retail &amp; service counters</figcaption>
              </figure>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-slate-50 py-20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-blue-300/20 blur-[110px]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <Eyebrow color="blue">Point of sale</Eyebrow>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">A point-of-sale system included with your payments</h2>
                <p className="mt-4 leading-relaxed text-slate-600">Ring up sales, split tender, run refunds, track inventory, and print or email receipts &mdash; all in one place, on the device you already have. No separate POS bill.</p>
                <Link href="/pos" className="mt-7 inline-flex rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-white">Explore the POS</Link>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 shadow-md">
                <Image src="/jpg4.jpg" alt="A card terminal printing a paper receipt" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 py-24 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={darkDots} />
        <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/15 blur-[100px]" />
        <div className="pointer-events-none absolute -right-20 -bottom-24 h-80 w-80 rounded-full bg-cyan-200/30 blur-[110px]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">See how much you&apos;re overpaying</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">A free 15-minute call, a clear quote, and the exact dollar amount you&apos;d save by switching to Surge. No pressure, no jargon.</p>
          <div className="mt-8 flex justify-center">
            <Link href="/book" className="rounded-full bg-white px-8 py-4 text-sm font-semibold text-blue-700 shadow-lg transition-transform hover:scale-105">Book my free savings call</Link>
          </div>
        </div>
      </section>
    </>
  );
}