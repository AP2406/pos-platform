import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb } from "../jsonld";

export const metadata: Metadata = {
  title: { absolute: "Free POS System for Small Business (GTA) | Surge" },
  description: "A full point-of-sale built into your payments. Fast checkout, every payment type, inventory, receipts, reports and refunds. Free Basic POS, runs on the device you already have.",
  alternates: { canonical: "/pos" },
  openGraph: { ...OG_BASE, url: "/pos" },
};

function Eyebrow({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "cyan" | "sky" }) {
  const map = { blue: "border-blue-200 bg-blue-50 text-blue-700", cyan: "border-cyan-200 bg-cyan-50 text-cyan-700", sky: "border-sky-200 bg-sky-50 text-sky-700" } as const;
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider " + map[color]}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function Icon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    cart: (<><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>),
    card: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>),
    box: (<><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>),
    receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6" /><path d="M9 12h6" /></>),
    chart: (<><path d="M5 20V11" /><path d="M12 20V5" /><path d="M19 20v-6" /></>),
    refund: (<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
  );
}

const features = [
  { icon: "cart", title: "Lightning-fast checkout", body: "Ring up a sale in seconds, split the tender, add a tip, and keep the line moving." },
  { icon: "card", title: "Every way they pay", body: "Tap, chip, swipe, Apple Pay, Google Pay, Interac, Visa and Mastercard &mdash; all built in." },
  { icon: "box", title: "Inventory that keeps up", body: "Track stock, set low-stock alerts, and scan barcodes so counts stay honest." },
  { icon: "receipt", title: "Receipts your way", body: "Print on an 80mm thermal printer or email a receipt the moment a sale closes." },
  { icon: "chart", title: "Reports that help", body: "See your best sellers, busiest hours and daily totals without doing the math." },
  { icon: "refund", title: "Returns without the headache", body: "Item-level refunds and voids in a couple of taps, with reasons logged for you." },
];

const gallery = [
  { src: "/jpg16.png", alt: "A cafe owner taking an order on the phone beside a Surge POS tablet", caption: "Cafes & quick-serve" },
  { src: "/jpg17.png", alt: "A shop owner checking stock at a Surge POS terminal", caption: "Retail & service counters" },
];

const advanced = [
  { title: "Appointments & bookings", body: "Take bookings for chairs, rooms and services, then check clients out at the same screen." },
  { title: "Staff roles & permissions", body: "Owner, manager and custom roles, with reason codes on refunds, voids and discounts." },
  { title: "Built to scale", body: "Add registers and locations as you grow, all reporting back to one clean dashboard." },
];

export default function PosPage() {
  return (
    <>
      <JsonLd data={breadcrumb("Point of Sale", "/pos")} />
      <section className="relative overflow-hidden pb-20 pt-36">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[80%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
        <div className="pointer-events-none absolute -left-28 top-12 h-[32rem] w-[32rem] rounded-full bg-blue-300/25 blur-[120px]" />
        <div className="pointer-events-none absolute -right-24 top-32 h-[28rem] w-[28rem] rounded-full bg-cyan-300/25 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <Eyebrow>Point of sale</Eyebrow>
              <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">A full register, built into your payments.</h1>
              <p className="mt-6 max-w-xl text-lg text-slate-600">No separate POS bill, no clunky add-on. Surge runs your whole counter on the device you already have &mdash; and it is free to start.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link href="/book" className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(37,99,235,0.6)] transition-shadow hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)]">Book a free demo</Link>
                <Link href="/pricing" className="rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50">See pricing</Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-blue-500/15 via-sky-500/10 to-cyan-500/15 blur-2xl" />
              <div className="pointer-events-none absolute -right-3 -top-3 z-10 hidden rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur lg:block [animation:surge-float_5s_ease-in-out_infinite]"><div className="flex items-center gap-1.5"><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span><span className="text-[11px] font-medium text-slate-500">Sale complete</span></div></div>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/60 shadow-2xl">
                <Image src="/jpg18.png" alt="A bar owner taking a card payment on a Surge POS tablet" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/40 to-white py-20">
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mb-10 flex flex-col items-center text-center">
            <Eyebrow color="cyan">What it does</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Everything the counter needs, in one place</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">The basics done right, so you can run the shop instead of fighting the till.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-1 hover:ring-blue-200">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white"><Icon name={f.icon} className="h-5 w-5" /></div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600" dangerouslySetInnerHTML={{ __html: f.body }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-white via-sky-50/60 to-white py-20">
        <div className="pointer-events-none absolute right-1/4 top-8 h-72 w-72 rounded-full bg-sky-300/20 blur-[110px]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <div className="mb-10 flex flex-col items-center text-center">
            <Eyebrow color="sky">Real counters</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Built for every kind of counter</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">From the morning rush to last call, Surge runs the real-world spots across the GTA.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {gallery.map((g) => (
              <figure key={g.src} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 shadow-sm ring-1 ring-transparent transition-shadow duration-300 hover:shadow-lg hover:ring-blue-200">
                <Image src={g.src} alt={g.alt} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <figcaption className="absolute bottom-4 left-4 text-sm font-semibold text-white">{g.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-slate-50 py-16">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        <div className="relative mx-auto max-w-5xl px-6">
          <div className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:grid-cols-3 md:p-10">
            <div className="md:col-span-2">
              <Eyebrow>No new hardware</Eyebrow>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Runs on the tablet or phone you already own</h2>
              <p className="mt-3 text-slate-600">Want a dedicated terminal or a thermal receipt printer? We can supply those too &mdash; and we set everything up with you in person across the GTA.</p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {["Tablet", "Phone", "Card terminal", "Thermal printer"].map((h) => (<span key={h} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">{h}</span>))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0E1A2B] py-20 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="pointer-events-none absolute -right-40 top-0 h-[30rem] w-[30rem] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -left-40 bottom-0 h-[28rem] w-[28rem] rounded-full bg-cyan-500/15 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mb-10 flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-current" />Advanced</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Ready when you outgrow the basics</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/70">On the Advanced plan &mdash; free to try for 30 days &mdash; the POS grows with the business.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {advanced.map((a) => (
              <div key={a.title} className="rounded-2xl border border-white/10 bg-white/5 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]">
                <h3 className="text-lg font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{a.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/pricing" className="inline-flex rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20">Compare Basic and Advanced</Link>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 py-24 text-white">
        <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/15 blur-[100px]" />
        <div className="pointer-events-none absolute -right-20 -bottom-24 h-80 w-80 rounded-full bg-cyan-200/30 blur-[110px]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">See the POS in action</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">Book a free 15-minute demo and we will set it up around how your shop actually runs.</p>
          <div className="mt-8 flex justify-center">
            <Link href="/book" className="rounded-full bg-white px-8 py-4 text-sm font-semibold text-blue-700 shadow-lg transition-transform hover:scale-105">Book my free demo</Link>
          </div>
        </div>
      </section>
    </>
  );
}