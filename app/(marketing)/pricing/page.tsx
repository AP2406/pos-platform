import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb, decodeEntities } from "../jsonld";
import { Crumb, Tick, btnPrimary, btnOutline, PageHero, CtaBand } from "../ui";

export const metadata: Metadata = {
  title: { absolute: "Payment Processing Rates & Pricing (GTA) | Surge" },
  description: "One honest rate: 2.5% + $0.15 in person, plus a one-time $10 setup. Free Basic POS, optional Advanced features, and custom software, CRM and SaaS builds. No monthly fees on payments, no lock-in. Book a free call.",
  alternates: { canonical: "/pricing" },
  openGraph: { ...OG_BASE, url: "/pricing" },
};

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

      <PageHero crumb="Pricing" title="One rate. No surprises." sub="The number you see is the number you pay. A lower rate, free Basic POS, and a one-time setup of just $10 — no contract holding you hostage." />

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <div className="overflow-hidden rounded-md border border-[#D9E1EA] shadow-[0_10px_30px_-18px_rgba(10,37,64,0.35)]">
            <div className="bg-[#0A2540] px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.05em] text-white">The Surge rate</div>
            <div className="p-7 sm:p-9">
              <div className="text-center">
                <div className="flex items-end justify-center gap-2">
                  <span className="text-6xl font-bold tracking-tight text-[#0A2540] sm:text-7xl">2.5%</span>
                  <span className="mb-2 text-2xl font-semibold text-[#42566B]">+ $0.15</span>
                </div>
                <div className="mt-2 text-sm text-[#7A8CA0]">per in-person transaction &mdash; tap, chip, swipe, or mobile wallet</div>
              </div>

              <div className="mt-7 overflow-hidden rounded-[4px] border border-[#D9E1EA]">
                {rates.map((r, i) => (
                  <div key={r.label} className={"flex items-center justify-between px-4 py-3 text-sm" + (i > 0 ? " border-t border-[#D9E1EA]" : "")}>
                    <span className="text-[#42566B]">{r.label}</span>
                    <span className="font-bold tabular-nums text-[#0A2540]">{r.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 px-1 text-[11px] leading-relaxed text-[#7A8CA0]">In person = tapped, inserted or swiped at your counter. Online &amp; keyed-in = paid on a website or payment link, or typed in by hand (like a phone order).</p>

              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {noFees.map((f) => (<div key={f} className="flex items-center gap-2.5 text-sm font-semibold text-[#1A2B3C]"><Tick />{f}</div>))}
              </div>

              <div className="mt-6 rounded-[4px] border border-[#D9E1EA] bg-[#F4F7FA] p-4">
                <div className="text-xs font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Other fees, no surprises</div>
                <div className="mt-3 space-y-2">
                  {otherFees.map((o) => (
                    <div key={o.label} className="flex items-center justify-between text-sm">
                      <span className="text-[#42566B]">{o.label}</span>
                      <span className="font-bold tabular-nums text-[#0A2540]">{o.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link href="/book" className={"mt-7 flex w-full items-center justify-center " + btnPrimary}>See your exact savings on a free call</Link>
              <p className="mt-3 text-center text-xs text-[#7A8CA0]">Your final rate is confirmed on a quick call. Most local businesses qualify for the rate above.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>Software</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Pick the plan that fits</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">Start free with Basic, upgrade to Advanced as you grow, or have us build something completely custom for your business.</p>
          </div>

          <div className="grid items-stretch gap-6 md:grid-cols-3">
            <div className="flex h-full flex-col rounded-md border border-[#D9E1EA] bg-white p-7">
              <div className="text-sm font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Basic</div>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-4xl font-bold tracking-tight text-[#0A2540]">Free</span>
                <span className="mb-1 text-sm text-[#7A8CA0]">with payments</span>
              </div>
              <p className="mt-2 text-sm text-[#42566B]">Everything you need to ring up sales and get paid.</p>
              <div className="mt-6 space-y-3">
                {basicFeatures.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-[#D9E1EA] bg-[#F4F7FA] text-[#42566B]"><Check className="h-3 w-3" /></span>
                    <span className="text-sm text-[#42566B]">{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-7"><Link href="/book" className={"flex w-full items-center justify-center " + btnOutline}>Start with Basic</Link></div>
            </div>

            <div className="relative flex h-full flex-col rounded-md border border-[#D9E1EA] border-t-[3px] border-t-[#0A2540] bg-white p-7 shadow-[0_10px_30px_-18px_rgba(10,37,64,0.35)]">
              <span className="absolute -top-3.5 left-7 rounded-[3px] bg-[#1E7B4D] px-2.5 py-1 text-xs font-bold text-white">30-day free trial</span>
              <div className="text-sm font-bold uppercase tracking-[0.05em] text-[#1B6DC1]">Advanced</div>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-4xl font-bold tracking-tight text-[#0A2540]">$29</span>
                <span className="mb-1 text-sm text-[#7A8CA0]">/ month, after trial</span>
              </div>
              <p className="mt-2 text-sm text-[#42566B]">For shops that want to run the whole operation.</p>
              <div className="mt-6 space-y-3">
                {advancedFeatures.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[#0A2540] text-white"><Check className="h-3 w-3" /></span>
                    <span className="text-sm text-[#42566B]">{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-7"><Link href="/book" className={"flex w-full items-center justify-center " + btnPrimary}>Start my free trial</Link></div>
            </div>

            <div className="flex h-full flex-col rounded-md border border-[#D9E1EA] bg-white p-7">
              <div className="text-sm font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Custom</div>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-4xl font-bold tracking-tight text-[#0A2540]">Custom</span>
                <span className="mb-1 text-sm text-[#7A8CA0]">priced per project</span>
              </div>
              <p className="mt-2 text-sm text-[#42566B]">Bespoke software built around how your business runs.</p>
              <div className="mt-6 space-y-3">
                {customFeatures.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-[#D9E1EA] bg-[#F4F7FA] text-[#42566B]"><Check className="h-3 w-3" /></span>
                    <span className="text-sm text-[#42566B]">{f}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-7"><Link href="/book" className={"flex w-full items-center justify-center " + btnOutline}>Book a call to scope it</Link></div>
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-[#7A8CA0]">Basic and Advanced run on the same 2.5% + $0.15 payment rate. Custom builds are quoted per project.</p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <Crumb>Compare</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Surge vs the big processors</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">Same payments. Less taken off the top, and nothing buried in the fine print.</p>
          </div>
          <div className="overflow-hidden rounded-md border border-[#D9E1EA]">
            <div className="grid grid-cols-3 bg-[#0A2540] text-xs font-bold uppercase tracking-[0.05em] text-white">
              <div className="px-4 py-3.5"> </div>
              <div className="px-4 py-3.5 text-center">Surge</div>
              <div className="px-4 py-3.5 text-center text-[#B9C8D8]">Typical processor</div>
            </div>
            {compare.map((row, i) => (
              <div key={row.label} className={"grid grid-cols-3 text-sm" + (i > 0 ? " border-t border-[#D9E1EA]" : "")}>
                <div className="px-4 py-3.5 font-semibold text-[#42566B]">{row.label}</div>
                <div className="px-4 py-3.5 text-center font-bold text-[#0A2540]">{row.surge}</div>
                <div className="px-4 py-3.5 text-center text-[#7A8CA0]">{row.typical}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-[#7A8CA0]">Typical figures shown for comparison and may vary by provider.</p>
        </div>
      </section>

      <section className="border-t border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-10 text-center">
            <Crumb>Questions</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">The honest answers</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-md border border-[#D9E1EA] bg-white p-6">
                <h3 className="text-base font-bold text-[#0A2540]">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#42566B]" dangerouslySetInnerHTML={{ __html: f.a }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="Ready to stop overpaying?" sub="Book a free 15-minute call and we will show you the exact amount you would save by switching to Surge." cta="Book my free savings call" />
    </>
  );
}
