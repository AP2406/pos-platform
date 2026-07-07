import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { SavingsEstimator } from "../savings-estimator";
import { LandingHero, LandingSection, LandingPoints, LandingCTA } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "Merchant Services in Durham Region — Payments & POS | Surge" },
  description: "Merchant services for Durham Region businesses — Pickering, Ajax, Whitby and Oshawa. Lower card rates, built-in POS, no monthly junk fees, local setup. Book a free call.",
  alternates: { canonical: "/merchant-services-durham" },
  openGraph: { ...OG_BASE, url: "/merchant-services-durham" },
};

const points = [
  { title: "One honest rate", body: "2.5% + 15¢ in person, $10 one-time setup, no monthly fee. The whole cost, in one line." },
  { title: "Set up on your main street", body: "Pickering to Oshawa, we come to you, get the terminal live, and stay reachable after." },
  { title: "Interac priced right", body: "Everyday Durham spend leans on debit. We keep Interac cheap instead of blending it in." },
  { title: "Software included", body: "A full point-of-sale with inventory and reports comes with your payments — no extra bill." },
];

const service = localService({
  name: "Merchant services in Durham Region",
  description: "Payment processing and point-of-sale for Durham Region small businesses — Pickering, Ajax, Whitby, Oshawa and Clarington — with transparent flat-rate pricing and local support.",
  areaServed: ["Durham Region", "Pickering", "Ajax", "Whitby", "Oshawa", "Clarington"],
  path: "/merchant-services-durham",
});

export default function MerchantServicesDurhamPage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Merchant services in Durham Region", "/merchant-services-durham")} />

      <LandingHero
        eyebrow="Durham Region"
        h1={<>Merchant services for <span className="text-blue-600">Durham Region</span>, done straight.</>}
        intro="Pickering, Ajax, Whitby, Oshawa — Surge gives Durham's main-street businesses a lower, transparent card rate, a built-in POS, and a real local person on the phone."
      />

      <LandingSection title="Built for Durham's main streets">
        <p>Durham Region is growing fast, and its independent businesses &mdash; the Whitby café, the Oshawa barbershop, the Ajax grocer, the Pickering trades outfit &mdash; deserve better than a call-centre processor three provinces away. Most are on a blended rate that overcharges their everyday Interac debit and buries the markup.</p>
        <p>Surge is different in the way that matters: one clear rate of <strong>2.5% + 15¢</strong> in person, no monthly fee, no term contract, and someone in the GTA who actually sets up your terminal and answers when you call.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="See what you'd save" tint>
        <p>Drag the sliders to your real numbers and see the yearly difference for your shop.</p>
        <div className="mt-6"><SavingsEstimator /></div>
        <p className="text-sm text-slate-500">Prefer we do the math on your statement? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free 15-minute call.</Link></p>
      </LandingSection>

      <LandingSection title="Payments and point of sale, together">
        <p>Every Surge account includes a built-in <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link>: checkout, inventory, receipts and reports on the device you already have. Restaurants can use <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link> for tabs, tips and the kitchen. One rate, whether you run one counter or several across Durham.</p>
      </LandingSection>

      <LandingCTA
        heading="Find out what you're overpaying in Durham"
        sub="A free 15-minute call, a clear quote, and the exact dollar amount you'd save by switching. No pressure, no jargon."
      />
    </>
  );
}
