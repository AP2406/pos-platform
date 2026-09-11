import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb, decodeEntities } from "../jsonld";
import { Crumb, Tick, btnPrimary, btnOutline, PageHero, ComingSoonBadge, PaymentsComingSoon } from "../ui";
import { PilotForm } from "./pilot-form";

// THIS PAGE NO LONGER PRICES ANYTHING. IT OFFERS THE PILOT.
//
// WHY THE URL STAYED. /pricing is in the sitemap, it is linked from six other
// routes and from both the nav and the footer, and "surge pos pricing" is a
// thing people type. Deleting it or 301-ing it throws that away to save a file.
// So the route, the canonical, the breadcrumb and the title all still say
// pricing — because the visitor's question is still "what does this cost" and
// the page still answers it. The answer today is "nothing, while the pilot
// runs", which is both true and the strongest thing we can say.
//
// WHAT CAME OFF: the Basic (free) / Advanced ($29 per month, 30-day trial) /
// Custom (per project) tier cards, the four-item "no fees" strip that included
// "free tier that stays free", and the two FAQ answers that explained the
// difference between the tiers. A previous pass established there is no
// billing, plan or entitlement code anywhere in this repo, so none of those
// numbers were enforced or enforceable — they were a price list for a thing
// nobody could be charged for. They are not replaced with other numbers.
//
// WHAT IS DELIBERATELY NOT PROMISED, and must stay that way unless the owner
// says otherwise: a price after the pilot, a discount for joining early,
// grandfathered access, a number of spots, a duration in months, an end date,
// or any scarcity at all. The only commitment made on this page is that we tell
// people before anything changes and they can leave. That is the one we can keep.
//
// NO PLACEHOLDER CONSTANTS. The copy below was written so that it needs none —
// there is no SPOTS_REMAINING or PILOT_ENDS waiting to be filled in, because a
// blank constant tends to ship as a zero.
export const metadata: Metadata = {
  title: { absolute: "Surge POS Pricing — Free During the Pilot (GTA) | Surge" },
  description: "What Surge POS costs right now: nothing. We are running a pilot — the full point of sale, free for a limited time, for independent shops across the GTA and Durham Region, set up in person. Card processing is not part of it yet.",
  alternates: { canonical: "/pricing" },
  // OG copy is set explicitly here rather than inherited, because the share card
  // is the one place the offer has to land in a single line.
  openGraph: {
    ...OG_BASE,
    title: "Free during the Surge pilot — the full point of sale, no charge",
    description: "We are looking for GTA and Durham independents to run Surge for real. Full POS, free for a limited time, set up in person. In exchange we want blunt feedback.",
    url: "/pricing",
  },
};

// The pilot in four honest parts. Each card answers one of the questions an
// owner actually asks, in the order they ask them.
const pillars = [
  {
    title: "What you get",
    body: "The whole point of sale, not a cut-down trial version: the register, the floor plan, the kitchen display, the menu builder, online / QR / kiosk ordering, inventory, staff and reports. Free while the pilot runs, and we come out and set it up with you.",
  },
  {
    title: "Who it is for",
    body: "Independent restaurants, cafes, shops and salons across the GTA and Durham Region. In-person setup is part of the offer, not an extra — so you need to be somewhere we can drive to and a day we can turn up on.",
  },
  {
    title: "What we want back",
    body: "Real use and blunt feedback. Run it through actual service, then tell us what was slow, what was missing and what made a shift harder. That is the trade, and the second half of it is the part we cannot buy anywhere else.",
  },
  {
    title: "What happens at the end",
    body: "We tell you before anything changes, and you can walk away. We are not promising you a price, a discount or grandfathered access for joining early, because we do not know yet what it will cost and a promise we cannot keep is worth less than saying so.",
  },
];

// One list, because the pilot is one thing. This is the old Basic and Advanced
// feature lists merged — every item was already verified against a screen that
// exists in the product (app/app/pos, /floor, /kitchen, /catalog, /inventory,
// /staff, /reports, /reservations and app/order/[businessId]) and nothing
// aspirational has been added to it here.
const included = [
  "Unlimited sales and checkout, on as many registers as you need",
  "Menu and catalog builder, with modifiers and availability",
  "Floor plan and table service",
  "Kitchen display, routed by station",
  "Online, QR and kiosk ordering",
  "Reservations and waitlist",
  "Inventory, purchasing and low-stock alerts",
  "Staff roles, scheduling and the time clock",
  "Daily reports and exports for your bookkeeper",
  "Printed and emailed receipts",
];

// Modest, checkable, and none of them a price. "Free tier that stays free" was
// dropped from this strip along with the tiers: it was a forward-looking promise
// about a plan that no longer exists.
const reassurances = ["No card asked for", "No contract to sign", "No setup fee", "Stop whenever you like"];

const faqs = [
  { q: "So what does Surge cost?", a: "During the pilot, nothing. You get the full point of sale free for a limited time, and we set it up with you in person. We have not set the price for afterwards, and we are not going to invent one on this page." },
  { q: "How long does the pilot run?", a: "A limited time &mdash; and that is as precise as we can honestly be today. There is no date on this page because we would rather not publish one and then have to move it. What we will commit to is telling you before anything changes." },
  { q: "What happens when the pilot ends?", a: "We contact you first and tell you where things stand. If you want to carry on, we will talk about it then. If you do not, you stop &mdash; there is no contract and nothing to cancel. We are not promising early joiners a set price or a locked-in rate, because we do not have one to promise." },
  { q: "Is there a catch?", a: "The catch is that it is early software and you are being asked to say so out loud. Things will be rough in places, and we want to hear about it in detail rather than have you quietly go back to what you had." },
  { q: "Does the pilot include card processing?", a: "No. We are not your processor yet &mdash; we do not take the card, we do not sell terminals and we do not publish a rate. You keep the merchant account you already have, and the point of sale records the sale either way." },
  { q: "Do I have to switch anything to try it?", a: "No. Nothing to port, nothing to cancel, and your current processor keeps working exactly as it does now. The pilot is the software." },
  { q: "Can you build custom software for my business?", a: "Yes &mdash; beyond the POS we build bespoke software, from CRMs and dashboards to full custom apps. That is scoped and quoted per project and sits outside the pilot, so book a call and we will work it out together." },
];

// FAQPage generated from the SAME `faqs` array that renders on the page, so the
// markup and the structured data cannot drift.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: decodeEntities(f.q),
    acceptedAnswer: { "@type": "Answer", text: decodeEntities(f.a) },
  })),
};

// STILL NO `offers` BLOCK, and now for a second reason. The first was that a
// price in structured data is a claim like any other. The second is that a
// schema.org Offer with price 0 and no validThrough is a permanent free offer
// as far as a crawler is concerned, which is the precise promise this page is
// written to avoid making. The free-during-the-pilot line belongs in prose,
// where it can carry its own qualifier.
const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Point of sale software",
  serviceType: "Point of sale software",
  description: "Point-of-sale software for restaurants, cafes, shops and salons across the Greater Toronto Area, currently in a pilot program: full access free for a limited time, set up in person, in exchange for feedback.",
  provider: { "@type": "LocalBusiness", name: "Surge", url: "https://www.surgetechpos.com" },
  areaServed: ["Greater Toronto Area", "Durham Region", "Ontario"],
  url: "https://www.surgetechpos.com/pricing",
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <JsonLd data={serviceSchema} />
      <JsonLd data={breadcrumb("Pricing", "/pricing")} />

      {/* The H1 answers the pricing question in the first four words, because
          that is the question the person arriving on this URL typed. */}
      <PageHero
        crumb="Pricing"
        title="Right now it is free, and here is the catch."
        sub="We are not selling the point of sale yet &mdash; we are running a pilot. Full access to the till for a limited time at no charge, for GTA and Durham independents willing to use it for real and tell us where it hurts."
      />

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>The pilot program</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Early access, free, in exchange for the truth</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">Surge is built and it runs real rooms. What it has not had is enough shops leaning on it at once. That is what the pilot is for, and why it does not cost you anything.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {pillars.map((p) => (
              <div key={p.title} className="rounded-md border border-[#D9E1EA] border-t-[3px] border-t-[#0A2540] bg-white p-7">
                <h3 className="text-lg font-bold text-[#0A2540]">{p.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#42566B]">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl gap-2.5 sm:grid-cols-2">
            {reassurances.map((f) => (
              <div key={f} className="flex items-center gap-2.5 rounded-[4px] border border-[#D9E1EA] bg-[#F4F7FA] px-4 py-3 text-sm font-semibold text-[#1A2B3C]">
                <Tick />
                {f}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="#apply" className={btnPrimary}>Join the pilot</Link>
            <Link href="/book" className={btnOutline}>Book a 15-minute demo first</Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <Crumb>What is included</Crumb>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">All of it. There is no smaller version.</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">There are no tiers during the pilot and nothing is held back behind an upgrade, because the point is to find out what breaks when a shop uses the whole thing.</p>
              <p className="mt-3 leading-relaxed text-[#42566B]">Setup is part of it: we come to you, load your menu, draw your floor and walk your staff through it, across the GTA and Durham Region.</p>
            </div>
            <div className="rounded-md border border-[#D9E1EA] bg-white p-7">
              <div className="space-y-3">
                {included.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <Tick />
                    <span className="text-sm leading-relaxed text-[#42566B]">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The rate card used to sit at the top of this page. What sits in its
          place is the absence of one, said out loud — and now also the fact that
          the pilot does not quietly include payments either. */}
      <section id="payments" className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Crumb>Card processing</Crumb>
                <ComingSoonBadge />
              </div>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">There is still no rate on this page</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">The pilot is the software. We are not your processor yet, so taking the card is not part of what you are signing up for, and there is no rate here to compare against the one you have.</p>
              <p className="mt-3 leading-relaxed text-[#42566B]">When it launches we will publish the rate here, in full, with what it really costs beside it. Until then, joining the pilot changes nothing about how you get paid.</p>
            </div>
            <PaymentsComingSoon heading="What happens to your current processor" body="Nothing. Surge POS records the sale and your existing merchant account takes the card, exactly as it does now. There is nothing to cancel, nothing to port, and no contract to get out of before you can try the till." />
          </div>
        </div>
      </section>

      <section id="apply" className="scroll-mt-28 border-y border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-start gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Crumb>Join the pilot</Crumb>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Tell us about your shop</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">This goes straight to us, not to a queue. We read it, we reply, and if it looks like a fit we will arrange a day to come out and set you up.</p>
              <p className="mt-3 leading-relaxed text-[#42566B]">If you would rather see it before you commit an hour of your week to it, <Link href="/book" className="font-bold text-[#1B6DC1] hover:underline">book a 15-minute demo</Link> instead &mdash; the pilot will still be here afterwards.</p>
            </div>
            <div className="lg:col-span-3">
              <PilotForm />
            </div>
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

      {/* The closing band sends people back up to the form rather than to /book:
          the demo is offered twice above and is the secondary path here. */}
      <section className="bg-[#0A2540] py-20 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="max-w-xl text-[32px] font-bold leading-[1.18] tracking-[-0.01em] sm:text-[34px]">Run the whole till for nothing, and tell us where it hurts.</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-[#B9C8D8]">Free for a limited time, set up in person across the GTA and Durham. No card, no contract, and you can stop whenever you like.</p>
          </div>
          <a href="#apply" className="whitespace-nowrap rounded-[4px] bg-white px-7 py-3.5 text-[15.5px] font-bold text-[#0A2540] transition-colors hover:bg-[#F4F7FA]">Join the pilot</a>
        </div>
      </section>
    </>
  );
}
