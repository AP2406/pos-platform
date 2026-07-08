import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { SavingsEstimator } from "../savings-estimator";
import { LandingHero, LandingSection, LandingPoints, LandingGuides, LandingCTA } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "Payment Processing in Mississauga — Lower Card Rates | Surge" },
  description: "Lower card processing rates for Mississauga businesses — transparent pricing, cheap Interac, no monthly junk fees, and local setup. See your savings and book a free call.",
  alternates: { canonical: "/payment-processing-mississauga" },
  openGraph: { ...OG_BASE, url: "/payment-processing-mississauga" },
};

const points = [
  { title: "One honest rate", body: "2.5% + 15¢ in person, a one-time $10 setup, and no monthly fee — the whole cost, up front." },
  { title: "Plaza-ready", body: "From Square One to a Streetsville storefront, we set up your terminal on site and keep it simple." },
  { title: "Interac priced right", body: "Debit is a big share of everyday spend here. We keep Interac cheap instead of blending it away." },
  { title: "POS included", body: "Checkout, inventory and reports come with your payments — no separate point-of-sale bill." },
];

const service = localService({
  name: "Payment processing in Mississauga",
  description: "Credit and debit card payment processing for Mississauga small businesses — transparent flat-rate pricing, Interac-friendly, with local setup and support.",
  areaServed: ["Mississauga", "Streetsville", "Port Credit", "Meadowvale", "Malton", "Peel Region"],
  path: "/payment-processing-mississauga",
});

export default function PaymentProcessingMississaugaPage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Payment processing in Mississauga", "/payment-processing-mississauga")} />

      <LandingHero
        eyebrow="Mississauga"
        h1={<>Payment processing in <span className="text-blue-600">Mississauga</span>, minus the junk fees.</>}
        intro="From a Square One kiosk to a Port Credit restaurant to a Meadowvale plaza shop, Surge gives Mississauga businesses a lower, transparent card rate — and a real person who answers the phone."
      />

      <LandingSection title="Why Mississauga owners switch">
        <p>Mississauga is one of the busiest independent-business markets in the country, and its shops are diverse: restaurants, grocers, salons, professional services, plaza retail. What they share is a card mix heavy on Interac debit and everyday tap &mdash; exactly the transactions that a blended &ldquo;one percentage for everything&rdquo; rate quietly overcharges.</p>
        <p>Surge replaces the blend with one clear number: <strong>2.5% + 15¢</strong> in person, no monthly fee, no lock-in. You see the cost, you keep more of every sale, and you can leave whenever you want.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="See what you'd save" tint>
        <p>Set the sliders to your real monthly card volume and average ticket to see the annual difference.</p>
        <div className="mt-6"><SavingsEstimator /></div>
        <p className="text-sm text-slate-500">Want us to check your statement? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free 15-minute call.</Link></p>
      </LandingSection>

      <LandingSection title="Payments and point of sale, together">
        <p>Every account includes a built-in <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> — fast checkout, inventory and daily reports on the hardware you already own. Running a restaurant? See <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link>. Same rate whether you have one register or several across Peel.</p>
      </LandingSection>

      <LandingGuides slugs={["lower-credit-card-processing-fees-ontario", "what-is-a-junk-fee-on-a-merchant-account"]} />

      <LandingCTA
        heading="Find out what you're overpaying in Mississauga"
        sub="A free 15-minute call, a clear quote, and the exact dollar amount you'd save by switching. No pressure, no jargon."
      />
    </>
  );
}
