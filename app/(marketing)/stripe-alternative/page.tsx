import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { SavingsEstimator } from "../savings-estimator";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "Stripe Alternative for In-Person Payments (GTA) | Surge" },
  description: "Looking for a Stripe alternative for in-person sales? Surge gives you a lower counter rate, local setup with no code, a full POS, and real human support. See what you'd save.",
  alternates: { canonical: "/stripe-alternative" },
  openGraph: { ...OG_BASE, url: "/stripe-alternative", type: "website" },
};

const tiles = [
  { title: "Built for the counter, not the codebase", body: "Stripe is developer- and online-first. Surge is built for in-person local business — checkout, terminal, receipts, all ready to go." },
  { title: "A lower in-person rate", body: "Stripe Terminal in person is typically around 2.7% + 5¢; Surge is 2.5% + 15¢, clearly stated. On everyday tickets the counter rate is what matters." },
  { title: "Local setup, no code", body: "No integration, no API keys. We set up your terminal in person across the GTA and Durham and you're taking payments the same day." },
  { title: "A real POS + a real human", body: "A full point-of-sale included free and a local person on the phone — not a dashboard, docs, and email support." },
];

const compareRows: [string, string, string][] = [
  ["In-person rate", "2.5% + 15¢, clearly stated", "Typically ~2.7% + 5¢ (Terminal)"],
  ["Online / keyed", "Available when you need it", "~2.9% + 30¢ (standard online)"],
  ["Setup", "Local, in person, no code", "Self-serve / developer integration"],
  ["POS software", "Full POS included free", "Bring-your-own or build it"],
  ["Support", "Local, real human", "Docs, dashboard, email"],
  ["Contract", "None — cancel anytime", "None"],
];

const service = localService({
  name: "Payment processing (Stripe alternative)",
  description: "A Stripe alternative for in-person local business — a lower counter rate, local no-code setup, a full point-of-sale included free, and real human support across the GTA and Durham.",
  areaServed: ["Greater Toronto Area", "Toronto", "Durham Region", "Ontario"],
  path: "/stripe-alternative",
});

export default function StripeAlternativePage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Stripe alternative", "/stripe-alternative")} />

      <LandingHero
        eyebrow="Switching from Stripe"
        h1={<>A Stripe alternative made for <span className="text-blue-600">in-person</span> business.</>}
        intro="Stripe is excellent if you're a developer building online checkout. But if you're running a counter, you want a lower in-person rate, someone to set up your terminal, and a real POS — not an API. That's Surge."
      />

      <LandingSection title="Why in-person owners look for a Stripe alternative">
        <p>Stripe built its reputation online, and it&rsquo;s superb there. In person, though, it expects you to be self-serve: order a reader, wire it up, and lean on documentation when something goes wrong. For a café, salon or shop, that&rsquo;s a lot of overhead for taking a tap.</p>
        <p>Surge is the counter-first option: <strong>2.5% + 15¢</strong> in person, local in-person setup with no code, a full point-of-sale included free, and a human who answers the phone. You keep the option to take online or keyed payments when you need them &mdash; you just don&rsquo;t have to be a developer to run your register.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to Stripe" tint>
        <p>Stripe&rsquo;s pricing varies by product and region, so treat the right-hand column as commonly reported figures &mdash; confirm current rates for your setup.</p>
        <LandingCompare
          competitor="Stripe (typical)"
          rows={compareRows}
          note="Stripe figures reflect commonly reported patterns and vary by product and region; confirm current Stripe pricing before switching."
        />
      </LandingSection>

      <LandingSection title="See what you'd save on in-person sales">
        <p>Drag the sliders to your real counter volume and average ticket. Compare Stripe&rsquo;s in-person Terminal rate to Surge&rsquo;s 2.5% + 15¢ &mdash; across a year of taps, the difference is real money.</p>
        <div className="mt-6"><SavingsEstimator /></div>
        <p className="text-sm text-slate-500">Want the exact comparison for your business? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free 15-minute call</Link> &mdash; or read <Link href="/guides/flat-rate-vs-interchange-plus-pricing" className="font-semibold text-blue-600 hover:text-blue-700">flat-rate vs interchange-plus pricing</Link>.</p>
      </LandingSection>

      <LandingSection title="A register, not a toolkit" tint>
        <p>Where Stripe hands you building blocks, Surge hands you a working business system: a full <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> with inventory, reports and refunds, set up in person and backed by local support. See it for <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">restaurants</Link> or <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">retail</Link>.</p>
      </LandingSection>

      <LandingGuides slugs={["flat-rate-vs-interchange-plus-pricing", "how-to-read-your-merchant-statement", "what-is-a-junk-fee-on-a-merchant-account"]} />

      <LandingCTA
        heading="See exactly what you'd save vs Stripe"
        sub="A free 15-minute call, a clear quote, and the real dollar difference on in-person sales — no pressure, no jargon."
      />

      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by Stripe. Stripe is a trademark of its owner. Competitor pricing and features change and vary by product and region &mdash; confirm current terms before switching.
      </LandingDisclaimer>
    </>
  );
}
