import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingGuides, LandingCTA } from "../local-landing";

// REPOSITIONED, NOT REDIRECTED. The URL ranks for "payment processing toronto"
// and the slug is not worth throwing away, so the page keeps its keyword in the
// title and in the H1 — but the H1 now leads with the thing we actually sell and
// says in the same breath that processing is coming. That is the only version of
// this page that is both honest and still about the query someone typed.
// The savings estimator and the 2.5% + 15¢ paragraph are gone.
export const metadata: Metadata = {
  title: { absolute: "POS for Toronto Businesses — Payment Processing Coming Soon | Surge" },
  description: "A point-of-sale system for Toronto restaurants, cafes and shops — register, floor plan, kitchen display, online and QR ordering, inventory and reports, set up in person. Card processing coming soon.",
  alternates: { canonical: "/payment-processing-toronto" },
  openGraph: { ...OG_BASE, url: "/payment-processing-toronto" },
};

const points = [
  { title: "Set up in person", body: "We come to your counter across the city, load the menu, draw the floor and show your staff around — not a box in the post." },
  { title: "Built for a busy room", body: "Floor plan, coursing and a kitchen display for the dining rooms; a fast counter mode for the cafes and shops." },
  { title: "Guests can order themselves", body: "Online ordering, a QR code on the table, and a self-serve kiosk — all landing in the same ticket queue." },
  { title: "Free while the pilot runs", body: "The whole system, on the tablet you already own, at no charge for a limited time and with no card to enter." },
];

const service = localService({
  name: "Point of sale in Toronto",
  description: "Point-of-sale software for Toronto restaurants, cafes and retail — register, floor plan and table service, kitchen display, online and QR ordering, inventory and reporting, with in-person setup.",
  areaServed: ["Toronto", "North York", "Scarborough", "Etobicoke", "East York", "Greater Toronto Area"],
  path: "/payment-processing-toronto",
});

export default function PaymentProcessingTorontoPage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Point of sale in Toronto", "/payment-processing-toronto")} />

      <LandingHero
        eyebrow="Toronto"
        h1={<>A point of sale for <span className="text-blue-600">Toronto</span> &mdash; payment processing coming soon.</>}
        intro="From a King West café to a Scarborough salon to a Kensington Market shop, Surge runs the counter, the floor and the kitchen on one system. We are building our own card processing; until it is live, you keep the processor you have."
      />

      <LandingSection title="What Toronto owners get today">
        <p>Toronto independents are usually running three or four things that do not talk to each other: a till, a tablet for delivery orders, a spreadsheet for stock, and a paper schedule taped inside the office door. The cost of that is not a line on a statement &mdash; it is the twenty minutes at close every night, and the order that got missed because it came in on the wrong screen.</p>
        <p>Surge is one system for all of it: a register, a floor plan with table service, a kitchen display, a menu builder, online and QR ordering, inventory, staff scheduling and the time clock, and reports that are already written when you lock up.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="About the payment processing" tint>
        <p>This page used to quote a card rate. It does not any more, because we are not a live processor yet and a rate we cannot honour is not a selling point.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
        <p className="text-sm text-[#7A8CA0]">Want to be told when it launches? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free 15-minute demo</Link> and we will take your details.</p>
      </LandingSection>

      <LandingSection title="Which POS fits your room">
        <p>Restaurants, bars and cafes should start with <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link> &mdash; tabs, coursing, the floor and the pass. Shops and service counters want <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">POS for retail</Link> for stock and receipts. Either way the full feature list lives on the <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale page</Link>, and it is the same system whether you have one till or several across the city.</p>
      </LandingSection>

      <LandingGuides slugs={["lower-credit-card-processing-fees-ontario", "interac-vs-credit-card-fees"]} />

      <LandingCTA
        heading="See it running a Toronto counter"
        sub="A free 15-minute demo with your own menu loaded and your floor drawn. No pressure, no jargon."
      />
    </>
  );
}
