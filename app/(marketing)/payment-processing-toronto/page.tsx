import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { SavingsEstimator } from "../savings-estimator";
import { LandingHero, LandingSection, LandingPoints, LandingGuides, LandingCTA } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "Payment Processing in Toronto — Lower Card Rates | Surge" },
  description: "Lower credit and debit card processing rates for Toronto businesses, with no junk monthly fees and real local support. See what you'd save and book a free call.",
  alternates: { canonical: "/payment-processing-toronto" },
  openGraph: { ...OG_BASE, url: "/payment-processing-toronto" },
};

const points = [
  { title: "One honest rate", body: "2.5% + 15¢ on in-person cards, with the setup and terminal explained up front — no statement-fee maze." },
  { title: "Interac done right", body: "Canadian debit is a big share of Toronto tabs. We keep Interac cheap instead of burying it in blended pricing." },
  { title: "Set up in person", body: "We come to your counter across the city and the GTA, get your terminal live, and stay reachable after." },
  { title: "Software included", body: "A point-of-sale, sales reports and inventory come with your payments — not a separate monthly bill." },
];

const service = localService({
  name: "Payment processing in Toronto",
  description: "Credit and debit card payment processing for Toronto small businesses — lower rates, transparent pricing, Interac-friendly, with local setup and support.",
  areaServed: ["Toronto", "North York", "Scarborough", "Etobicoke", "East York", "Greater Toronto Area"],
  path: "/payment-processing-toronto",
});

export default function PaymentProcessingTorontoPage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Payment processing in Toronto", "/payment-processing-toronto")} />

      <LandingHero
        eyebrow="Toronto"
        h1={<>Payment processing in <span className="text-blue-600">Toronto</span>, without the junk fees.</>}
        intro="From a King West café to a Scarborough salon to a Kensington Market shop — Surge gives Toronto businesses a lower, transparent card rate and a real person who picks up the phone."
      />

      <LandingSection title="Why Toronto owners switch">
        <p>Toronto runs on cards. Between tourists tapping foreign Visa and Mastercard, locals paying with Apple Pay, and a heavy share of Interac debit, most independent shops here are handing a bigger slice of every sale to their processor than they realize — usually inside a &ldquo;blended&rdquo; rate that hides what each transaction actually costs.</p>
        <p>Surge replaces that with one clear rate: <strong>2.5% + 15¢</strong> on in-person cards, a one-time $10 setup, and no monthly fee. You see the number, you keep more of every sale, and you can walk away any time — there&rsquo;s no term contract.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="See what you'd save" tint>
        <p>Drag the sliders to your real monthly card volume and average ticket. Most Toronto owners are surprised by the annual number.</p>
        <div className="mt-6"><SavingsEstimator /></div>
        <p className="text-sm text-slate-500">Prefer we do the math? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free 15-minute call</Link> and we&rsquo;ll read your current statement with you.</p>
      </LandingSection>

      <LandingSection title="Payments and point of sale, together">
        <p>Every Surge account includes a built-in <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link>: fast checkout, inventory, receipts, and daily reports on the device you already have. Run a restaurant? Our <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link> handles tabs, tips and the kitchen. It&rsquo;s the same lower rate whether you&rsquo;re a single register or several across the city.</p>
      </LandingSection>

      <LandingGuides slugs={["lower-credit-card-processing-fees-ontario", "interac-vs-credit-card-fees"]} />

      <LandingCTA
        heading="Find out what you're overpaying in Toronto"
        sub="A free 15-minute call, a clear quote, and the exact dollar amount you'd save by switching. No pressure, no jargon."
      />
    </>
  );
}
