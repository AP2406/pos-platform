import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb, decodeEntities } from "../jsonld";

export const metadata: Metadata = {
  title: { absolute: "Pricing — 2.5% + 15¢ Payment Processing | Surge" },
  description: "One honest rate: 2.5% + $0.15 in person, plus a one-time $10 setup. Free Basic POS, optional Advanced features, and custom software, CRM and SaaS builds. No monthly fees on payments, no lock-in. Book a free call.",
  alternates: { canonical: "/pricing" },
  openGraph: { ...OG_BASE, url: "/pricing" },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

const rates = [
  { label: "In-person credit & wallets", value: "2.5% + $0.15" },
  { label: "Interac debit", value: "$0.30 flat" },
  { label: "Online & keyed-in", value: "2.9% + $0.30" },
];

const otherFees = [
  { label: "One-time account setup", value: "$10" },
  { label: "Dispute fee (only if a chargeback happens)", value: "$35" },
];

const noFees = ["No monthly fee", "No statement fee", "No lock-in contract", "No hidden junk fees"];

const basicFeatures = ["Unlimited sales and checkout", "Tap, chip, swipe and mobile payments", "Printed and emailed receipts", "Daily sales reports", "Simple inventory tracking", "One register"];
const advancedFeatures = ["Everything in Basic", "Barcode and low-stock inventory", "Appointments and bookings", "Staff roles and permissions", "Advanced analytics and insights", "Priority support"];
const customFeatures = ["Custom CRM systems", "Business dashboards and reporting", "Workflow automation and integrations", "Booking and customer portals", "Internal tools and admin panels", "Full custom web apps and SaaS"];

const compare = [
  { label: "Per-transaction rate (in person)", surge: "2.5% + $0.15", typical: "2.9% + $0.30" },
  { label: "Setup fee", surge: "$10 one-time", typical: "Up to $99" },
  { label: "Monthly fee on payments", surge: "$0", typical: "$10 to $30" },
  { label: "Chargeback / dispute fee", surge: "$35", typical: "$25 to $100" },
  { label: "Lock-in contract", surge: "None, cancel anytime", typical: "1 to 3 years" },
  { label: "Basic POS software", surge: "Included free", typical: "Paid add-on" },
  { label: "Support", surge: "GTA-based, real human", typical: "Call center" },
];

const faqs = [
  { q: "Are there any other fees?", a: "We keep it simple and transparent: a one-time $10 setup, and a $35 fee only if a customer files a chargeback. No monthly fees on payments, no statement fees, and no hidden line items." },
  { q: "What does online or keyed-in mean?", a: "In person means the card is tapped, inserted, or swiped at your counter &mdash; that is the lowest rate. Online means a customer pays on a website or payment link. Keyed-in means you type the card number in by hand, like a phone order. Those cost a little more (2.9% + $0.30) because the card is not physically present, which the card networks treat as higher risk." },
  { q: "What is the difference between Basic and Advanced?", a: "Basic POS is free and included with your payments. Advanced adds barcode inventory, appointments, staff roles, and deeper analytics. You can try every Advanced feature free before you pay a cent." },
  { q: "Can you build custom software for my business?", a: "Yes. Beyond the POS we build bespoke software &mdash; CRMs, dashboards, automations and full custom apps. Pricing is scoped to your project, so book a call and we will work it out together." },
  { q: "Am I locked into a contract?", a: "No. There is no term contract and no early-termination fee. If Surge is not saving you money, you walk away." },
];

// FAQPage generated from the SAME `faqs` array that renders on the page, so the
// markup and structured data can't drift.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: decodeEntities(f.q),
    acceptedAnswer: { "@type": "Answer", text: decodeEntities(f.a) },
  })),
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Payment processing",
  serviceType: "Payment processing",
  provider: { "@type": "LocalBusiness", name: "Surge Payment Solutions", url: "https://www.surgetechpos.com" },
  areaServed: ["Greater Toronto Area", "Ontario"],
  offers: {
    "@type": "Offer",
    priceCurrency: "CAD",
    description: "2.5% + $0.15 per in-person transaction, $10 one-time setup, no monthly fee.",
    url: "https://www.surgetechpos.com/pricing",
  },
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <JsonLd data={serviceSchema} />
      <JsonLd data={breadcrumb("Pricing", "/pricing")} />
      <section className="relative overflow-hidden pb-12 pt-36">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[80%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
        <div className="pointer-events-none absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-cyan-300/25 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="mt-5 text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">One rate. No surprises.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">The number you see is the number you pay. A lower rate, free Basic POS, and a one-time setup of just $10 &mdash; no contract holding you hostage.</p>
        </div>
      </section>

      <section className="relative pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <div className="relative">
            <div className="absolute -inset-[2px] overflow-hidden rounded-[calc(1.5rem+2px)]">
              <div className="absolute left-1/2 top-1/2 h-[260%] w-[260%] bg-[conic-gradient(from_0deg,#2563eb,#06b6d4,#38bdf8,#a5f3fc,#06b6d4,#2563eb)] [animation:surge-spin_10s_linear_infinite]" />
            </div>
            <div className="relative rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
              <div className="text-center">
                <div className="text-sm font-semibold uppercase tracking-wider text-blue-700">The Surge rate</div>
                <div className="mt-3 flex items-end justify-center gap-2">
                  <span className="text-6xl font-bold tracking-tight text-slate-900 sm:text-7xl">2.5%</span>
                  <span className="mb-2 text-2xl font-semibold text-slate-500">+ $0.15</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">per in-person transaction &mdash; tap, chip, swipe, or mobile wallet</div>
              </div>

              <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200">
                {rates.map((r, i) => (
                  <div key={r.label} className={"flex items-center justify-between px-4 py-3 text-sm" + (i > 0 ? " border-t border-slate-200" : "")}>
                    <span className="text-slate-600">{r.label}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{r.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 px-1 text-[11px] leading-relaxed text-slate-400">In person = tapped, inserted or swiped at your counter. Online &amp; keyed-in = paid on a website or payment link, or typed in by hand (like a phone order).</p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {noFees.map((f) => (<span key={f} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{f}</span>))}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Other fees, no surprises</div>
                <div className="mt-3 space-y-2">
                  {otherFees.map((o) => (
                    <div key={o.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{o.label}</span>
                      <span className="font-semibold tabular-nums text-slate-900">{o.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link href="/book" className="mt-7 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(37,99,235,0.6)] transition-shadow hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)]">See your exact savings on a free call</Link>
              <p className="mt-3 text-center text-xs text-slate-400">Your final rate is confirmed on a quick call. Most local businesses qualify for the rate above.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/50 to-white py-20">
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mb-10 flex flex-col items-center text-center">
            <Eyebrow>Software</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Pick the plan that fits</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">Start free with Basic, upgrade to Advanced as you grow, or have us build something completely custom for your business.</p>
          </div>

          <div className="grid items-stretch gap-6 md:grid-cols-3">
            <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-wider text-slate-500">Basic</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900">Free</span>
                <span className="mb-1 text-sm text-slate-500">with payments</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Everything you need to ring up sales and get paid.</p>
              <div className="mt-6 space-y-3">
                {basicFeatures.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Check className="h-3 w-3" /></span>
                    <span className="text-sm text-slate-700">{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-7"><Link href="/book" className="flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50">Start with Basic</Link></div>
            </div>

            <div className="relative flex h-full flex-col rounded-3xl border-2 border-blue-300 bg-white p-7 shadow-lg">
              <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-1 text-xs font-semibold text-white shadow">30-day free trial</span>
              <div className="text-sm font-semibold uppercase tracking-wider text-blue-700">Advanced</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900">$29</span>
                <span className="mb-1 text-sm text-slate-500">/ month, after trial</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">For shops that want to run the whole operation.</p>
              <div className="mt-6 space-y-3">
                {advancedFeatures.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Check className="h-3 w-3" /></span>
                    <span className="text-sm text-slate-700">{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-7"><Link href="/book" className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(37,99,235,0.6)] transition-shadow hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)]">Start my free trial</Link></div>
            </div>

            <div className="flex h-full flex-col rounded-3xl border border-cyan-200 bg-gradient-to-b from-cyan-50/60 to-white p-7 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-wider text-cyan-700">Custom</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900">Custom</span>
                <span className="mb-1 text-sm text-slate-500">priced per project</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Bespoke software built around how your business runs.</p>
              <div className="mt-6 space-y-3">
                {customFeatures.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-700"><Check className="h-3 w-3" /></span>
                    <span className="text-sm text-slate-700">{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-7"><Link href="/book" className="flex w-full items-center justify-center rounded-full border border-cyan-300 bg-white px-6 py-3 text-sm font-semibold text-cyan-700 transition-colors hover:bg-cyan-50">Book a call to scope it</Link></div>
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">Basic and Advanced run on the same 2.5% + $0.15 payment rate. Custom builds are quoted per project.</p>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0E1A2B] py-20 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Surge vs the big processors</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/70">Same payments. Less taken off the top, and nothing buried in the fine print.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-3 bg-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white/60">
              <div className="px-4 py-3"> </div>
              <div className="px-4 py-3 text-center text-cyan-300">Surge</div>
              <div className="px-4 py-3 text-center">Typical processor</div>
            </div>
            {compare.map((row) => (
              <div key={row.label} className="grid grid-cols-3 border-t border-white/10 text-sm">
                <div className="px-4 py-3 text-white/70">{row.label}</div>
                <div className="px-4 py-3 text-center font-semibold text-white">{row.surge}</div>
                <div className="px-4 py-3 text-center text-white/50">{row.typical}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-white/40">Typical figures shown for comparison and may vary by provider.</p>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/50 to-white py-20">
        <div className="relative mx-auto max-w-3xl px-6">
          <div className="mb-8 text-center">
            <Eyebrow>Questions</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">The honest answers</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600" dangerouslySetInnerHTML={{ __html: f.a }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 py-24 text-white">
        <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/15 blur-[100px]" />
        <div className="pointer-events-none absolute -right-20 -bottom-24 h-80 w-80 rounded-full bg-cyan-200/30 blur-[110px]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Ready to stop overpaying?</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">Book a free 15-minute call and we will show you the exact amount you would save by switching to Surge.</p>
          <div className="mt-8 flex justify-center">
            <Link href="/book" className="rounded-full bg-white px-8 py-4 text-sm font-semibold text-blue-700 shadow-lg transition-transform hover:scale-105">Book my free savings call</Link>
          </div>
        </div>
      </section>
    </>
  );
}