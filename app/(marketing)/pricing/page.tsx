import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb, decodeEntities } from "../jsonld";
import { Crumb, btnPrimary, btnOutline, PageHero, CtaBand, ComingSoonBadge, PaymentsComingSoon } from "../ui";

// THIS PAGE PRICED CARD PROCESSING. NOW IT PRICES THE SOFTWARE.
//
// What came off: the 2.5% + $0.15 rate card (headline, three-row rate table,
// $10 setup, $35 dispute fee), the "Surge vs the big processors" per-transaction
// comparison, the payments FAQ, and the Service/Offer JSON-LD that put the rate
// into structured data. None of it can stand while we are not a live processor.
//
// WHAT DID NOT CHANGE, DELIBERATELY: the Basic / Advanced / Custom tiers and
// their numbers. Those are prices the business has already published for the
// software, and this task is repositioning, not repricing — inventing a new
// number would be worse, and quietly deleting a published one would be worse
// still. The one edit is the qualifier on Basic: it read "Free — with
// payments", a bundle whose payments leg does not exist yet. It now reads
// "Free", which is the more generous reading and so cannot mislead a customer,
// but whether Basic stays free standing alone is the owner's call, not this
// change's. Flagged, not decided here.
export const metadata: Metadata = {
  title: { absolute: "POS Pricing — Free Basic Point of Sale (GTA) | Surge" },
  description: "Surge POS pricing: a free Basic tier, an Advanced tier at $29/month, and custom software quoted per project. No lock-in contract. Card processing is coming soon and is not priced yet.",
  alternates: { canonical: "/pricing" },
  openGraph: { ...OG_BASE, url: "/pricing" },
};

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

// Feature lists trimmed to what could be verified in the code. Removed from
// Basic: "tap, chip, swipe and mobile payments" — a payments claim. Removed
// from Advanced: "appointments and bookings", because lib/modules/modes.ts
// declares the `appointments` mode with `status: "soon"`, so the product itself
// already calls it unbuilt. Barcode and low-stock inventory STAYED: both are
// real (app/app/pos/barcode-scanner.tsx and the low-stock path in
// app/app/inventory), and "reservations and waitlist" replaces the
// appointments line because that is the booking feature that does exist.
const basicFeatures = ["Unlimited sales and checkout", "Printed and emailed receipts", "Menu and catalog builder", "Daily sales reports", "Simple inventory tracking", "One register"];
const advancedFeatures = ["Everything in Basic", "Floor plan and table service", "Kitchen display and stations", "Barcode and low-stock inventory", "Reservations and waitlist", "Staff roles, scheduling and time clock", "Online, QR and kiosk ordering", "Deeper reporting and exports", "Priority support"];
const customFeatures = ["Custom CRM systems", "Business dashboards and reporting", "Workflow automation and integrations", "Booking and customer portals", "Internal tools and admin panels", "Full custom web apps and SaaS"];

const noFees = ["No lock-in contract", "No setup fee on the software", "Free tier that stays free", "Cancel any time"];

const faqs = [
  { q: "What does Basic actually include?", a: "A working register: unlimited sales, the menu and catalog builder, receipts, simple stock tracking and your daily reports, on one till. It is the free tier and there is no card to enter to use it." },
  { q: "What is the difference between Basic and Advanced?", a: "Advanced is the multi-screen version: floor plan and table service, the kitchen display, reservations and the waitlist, staff scheduling and the time clock, the online / QR / kiosk ordering channels, and deeper reporting. If you run a dining room rather than a counter, Advanced is the one you want." },
  { q: "When will Surge process my cards?", a: "We are building it and we are not quoting a date, because a date we miss is worse than no date. Until it is live we do not process cards, we do not sell terminals, and we do not publish a rate. Your current processor keeps working beside the POS." },
  { q: "Do I have to switch processors to use the POS?", a: "No. The point-of-sale does not care who takes the card &mdash; you can run Surge on the counter today and keep the merchant account you already have." },
  { q: "Can you build custom software for my business?", a: "Yes. Beyond the POS we build bespoke software &mdash; CRMs, dashboards, automations and full custom apps. Pricing is scoped to your project, so book a call and we will work it out together." },
  { q: "Am I locked into a contract?", a: "No. There is no term contract and no early-termination fee on the software." },
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

// Was `Service` / "Payment processing" with an Offer carrying "2.5% + $0.15 per
// in-person transaction". Structured data is a claim like any other, and that
// one told Google we sell processing at a rate. It is now the software, and the
// Offer carries no price at all — a free tier and a paid tier is an offer
// catalogue, not a single number, and inventing an aggregate here would be the
// same mistake in a different syntax.
const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Point of sale software",
  serviceType: "Point of sale software",
  description: "Point-of-sale software for restaurants, cafes and retail across the Greater Toronto Area — free Basic tier, paid Advanced tier, and custom software builds quoted per project.",
  provider: { "@type": "LocalBusiness", name: "Surge", url: "https://www.surgetechpos.com" },
  areaServed: ["Greater Toronto Area", "Ontario"],
  url: "https://www.surgetechpos.com/pricing",
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <JsonLd data={serviceSchema} />
      <JsonLd data={breadcrumb("Pricing", "/pricing")} />

      <PageHero crumb="Pricing" title="Start free. Pay when the shop needs more." sub="Surge POS has a free tier that is a real register, not a trial. Card processing is a separate thing, it is not live yet, and it is not priced here." />

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>Software</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Pick the plan that fits</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">Start free with Basic, move to Advanced when the floor and the kitchen need their own screens, or have us build something completely custom.</p>
          </div>

          <div className="grid items-stretch gap-6 md:grid-cols-3">
            <div className="flex h-full flex-col rounded-md border border-[#D9E1EA] bg-white p-7">
              <div className="text-sm font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Basic</div>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-4xl font-bold tracking-tight text-[#0A2540]">Free</span>
                <span className="mb-1 text-sm text-[#7A8CA0]">one register</span>
              </div>
              <p className="mt-2 text-sm text-[#42566B]">Everything you need to ring up sales and see your day.</p>
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
              <p className="mt-2 text-sm text-[#42566B]">For rooms that run a floor, a kitchen and a schedule.</p>
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

          <div className="mx-auto mt-10 grid max-w-3xl gap-2.5 sm:grid-cols-2">
            {noFees.map((f) => (
              <div key={f} className="flex items-center gap-2.5 rounded-[4px] border border-[#D9E1EA] bg-[#F4F7FA] px-4 py-3 text-sm font-semibold text-[#1A2B3C]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[#1E7B4D] text-white"><Check className="h-3 w-3" /></span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The rate card used to sit at the top of this page. What sits in its
          place is the absence of one, said out loud. */}
      <section id="payments" className="border-y border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Crumb>Card processing</Crumb>
                <ComingSoonBadge />
              </div>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">There is no rate on this page</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">Because we do not process cards yet, and quoting a number for something we cannot yet sell you is how every processor you have already dealt with got started.</p>
              <p className="mt-3 leading-relaxed text-[#42566B]">When it launches we will publish the rate here, in full, with whatever it really costs beside it. Until then the software prices above are the whole commercial story.</p>
            </div>
            <PaymentsComingSoon heading="What happens to your current processor" body="Nothing. Surge POS records the sale and your existing merchant account takes the card, exactly as it does now. There is nothing to cancel, nothing to port, and no contract to get out of before you can try the till." />
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
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

      <CtaBand title="Want to see it before you pick a plan?" sub="Book a free 15-minute demo. We will load your menu, draw your floor, and you can decide afterwards." cta="Book my free demo" />
    </>
  );
}
