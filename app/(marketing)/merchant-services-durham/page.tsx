import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingGuides, LandingCTA } from "../local-landing";

// "Merchant services" is the broadest of the three local keywords, and a
// point-of-sale is genuinely a merchant service — so this page carries its
// keyword more comfortably than the two "payment-processing-*" slugs do. It
// still says plainly that the processing half is not live.
export const metadata: Metadata = {
  title: { absolute: "POS & Merchant Services in Durham Region | Surge" },
  description: "A point-of-sale system for Durham Region businesses — Pickering, Ajax, Whitby and Oshawa. Register, floor plan, kitchen display, online and QR ordering, inventory and reports, set up locally. Card processing coming soon.",
  alternates: { canonical: "/merchant-services-durham" },
  openGraph: { ...OG_BASE, url: "/merchant-services-durham" },
};

const points = [
  { title: "Set up on your main street", body: "Pickering to Oshawa, we come to you, get the system live on your own devices, and stay reachable after." },
  { title: "Floor, line and counter", body: "Table service and a kitchen display for the dining rooms, a fast counter mode for everyone else." },
  { title: "Bookings and a waitlist", body: "Take reservations for the room and run the waitlist from the same screen the servers already use." },
  { title: "Free while the pilot runs", body: "We are piloting the whole system with Durham independents: a real register on the tablet you already have, at no charge for a limited time." },
];

const service = localService({
  name: "Point of sale in Durham Region",
  description: "Point-of-sale software for Durham Region small businesses — Pickering, Ajax, Whitby, Oshawa and Clarington — register, floor plan and table service, kitchen display, online and QR ordering, inventory and reporting, with local setup.",
  areaServed: ["Durham Region", "Pickering", "Ajax", "Whitby", "Oshawa", "Clarington", "Greater Toronto Area"],
  path: "/merchant-services-durham",
});

export default function MerchantServicesDurhamPage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Point of sale in Durham Region", "/merchant-services-durham")} />

      <LandingHero
        eyebrow="Durham Region"
        h1={<>Point of sale for <span className="text-blue-600">Durham Region</span>, done straight.</>}
        intro="Pickering, Ajax, Whitby, Oshawa — Surge runs the counter, the floor and the kitchen on one system, set up in person by someone who lives here. Card processing is the one part we have not shipped yet."
      />

      <LandingSection title="Built for Durham's main streets">
        <p>Durham Region is growing fast, and its independent businesses &mdash; the Whitby café, the Oshawa barbershop, the Ajax grocer, the Pickering trades outfit &mdash; deserve better than a call-centre vendor three provinces away and a till that does one thing.</p>
        <p>Surge is one system: a register, a floor plan with table service, a kitchen display, the menu builder, online and QR ordering, reservations and a waitlist, inventory, staff scheduling and the time clock, and reports that are written by the time you lock the door.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="About the merchant account" tint>
        <p>To be clear about what this page is not: we do not hold your merchant account, we do not take the card, and we do not quote a rate. That side is being built. The software side is ready now.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
        <p className="text-sm text-[#7A8CA0]">Want us to tell you when processing goes live? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free 15-minute demo.</Link></p>
      </LandingSection>

      <LandingSection title="Which POS fits your room">
        <p>Restaurants and bars want <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link>; shops and service counters want <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">POS for retail</Link>. The whole feature list is on the <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale page</Link>, and it is the same system whether you run one counter or several across Durham.</p>
      </LandingSection>

      <LandingGuides slugs={["lower-credit-card-processing-fees-ontario", "how-to-read-your-merchant-statement"]} />

      <LandingCTA
        heading="See it running a Durham counter"
        sub="A free 15-minute demo with your own menu loaded and your floor drawn. No pressure, no jargon."
      />
    </>
  );
}
