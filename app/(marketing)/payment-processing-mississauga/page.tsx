import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingGuides, LandingCTA } from "../local-landing";

// Same treatment as /payment-processing-toronto: keep the URL and the keyword,
// lead with the POS, say plainly that processing is not live. See
// docs/site-pos-first-audit.md §2 for why none of these pages were deleted.
export const metadata: Metadata = {
  title: { absolute: "POS for Mississauga Businesses — Payment Processing Coming Soon | Surge" },
  description: "A point-of-sale system for Mississauga restaurants, cafes and shops — register, floor plan, kitchen display, online and QR ordering, inventory and reports, set up on site. Card processing coming soon.",
  alternates: { canonical: "/payment-processing-mississauga" },
  openGraph: { ...OG_BASE, url: "/payment-processing-mississauga" },
};

const points = [
  { title: "Plaza-ready", body: "From Square One to a Streetsville storefront, we set the system up on site and get your staff through it the same day." },
  { title: "One menu, every screen", body: "Build the menu once and it feeds the register, the kitchen display, the online page and the menu board." },
  { title: "Stock that keeps itself", body: "Counts move as you sell, with purchasing, recipes and waste behind them when you want the real plate cost." },
  { title: "Free to start", body: "The Basic tier is a working register on the device you already own — no card, no trial clock." },
];

const service = localService({
  name: "Point of sale in Mississauga",
  description: "Point-of-sale software for Mississauga restaurants, cafes and retail — register, floor plan and table service, kitchen display, online and QR ordering, inventory and reporting, with on-site setup.",
  areaServed: ["Mississauga", "Peel Region", "Brampton", "Oakville", "Greater Toronto Area"],
  path: "/payment-processing-mississauga",
});

export default function PaymentProcessingMississaugaPage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Point of sale in Mississauga", "/payment-processing-mississauga")} />

      <LandingHero
        eyebrow="Mississauga"
        h1={<>A point of sale for <span className="text-blue-600">Mississauga</span> &mdash; payment processing coming soon.</>}
        intro="From a Square One kiosk to a Port Credit restaurant to a Meadowvale plaza shop, Surge runs the counter, the floor and the kitchen on one system. Our own card processing is still in build; until then you keep the processor you have."
      />

      <LandingSection title="What Mississauga owners get today">
        <p>Mississauga is one of the busiest independent-business markets in the country, and its shops are diverse: restaurants, grocers, salons, professional services, plaza retail. What most of them share is a pile of tools that do not speak to each other &mdash; the till, the delivery tablet, the stock sheet, the schedule on the wall.</p>
        <p>Surge is one system for the lot: a register, a floor plan with table service, a kitchen display, the menu builder, online and QR ordering, a self-serve kiosk, inventory, staff scheduling and the time clock, and the day&rsquo;s reports already written by the time you cash out.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="About the payment processing" tint>
        <p>There used to be a rate and a savings calculator here. Both are gone, because we are not yet the ones taking the card and it would be dishonest to price something we cannot sell.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
        <p className="text-sm text-[#7A8CA0]">Want to hear when it launches? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free 15-minute demo.</Link></p>
      </LandingSection>

      <LandingSection title="Which POS fits your room">
        <p>Dining rooms and cafes start with <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link>; shops and counters with <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">POS for retail</Link>. The full feature list is on the <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale page</Link>, and it is the same system whether you run one register or several across Peel.</p>
      </LandingSection>

      <LandingGuides slugs={["lower-credit-card-processing-fees-ontario", "what-is-a-junk-fee-on-a-merchant-account"]} />

      <LandingCTA
        heading="See it running a Mississauga counter"
        sub="A free 15-minute demo with your own menu loaded and your floor drawn. No pressure, no jargon."
      />
    </>
  );
}
