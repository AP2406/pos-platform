import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { SavingsEstimator } from "../savings-estimator";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "Square Alternative — Lower Rate & Local Support | Surge" },
  description: "Looking for a Square alternative? Surge offers a lower in-person rate, real local setup and support, and a deeper POS — all with no lock-in. See what you'd save.",
  alternates: { canonical: "/square-alternative", },
  openGraph: { ...OG_BASE, url: "/square-alternative", type: "website" },
};

const tiles = [
  { title: "A lower in-person rate", body: "Square commonly charges around 2.65% per tap; Surge is 2.5% + 15¢, clearly stated. On everyday tickets that difference adds up across a year." },
  { title: "Local, in-person setup", body: "Square ships you a reader and leaves the rest to you. We set up your terminal in person across the GTA and Durham and stay reachable after." },
  { title: "Real human support", body: "Trade chat threads and callback queues for a local person who answers the phone and actually knows your account." },
  { title: "A deeper POS, included free", body: "Square's free tier is basic and nudges you toward paid upgrades. Surge includes a full point-of-sale — inventory, reports, refunds — free with your payments." },
];

const compareRows: [string, string, string][] = [
  ["In-person rate", "2.5% + 15¢, clearly stated", "Typically ~2.65% per tap"],
  ["Monthly fee", "$0", "$0 on the free tier; paid tiers add fees"],
  ["Contract", "None — cancel anytime", "None"],
  ["Setup", "Local, in person (GTA & Durham)", "Self-serve; ship-a-reader"],
  ["POS software", "Full POS included free", "Free tier basic; upgrades are paid"],
  ["Support", "Local, real human", "Chat / callback"],
  ["Hardware", "Terminal included, $10 one-time", "Reader purchase"],
];

const service = localService({
  name: "Payment processing (Square alternative)",
  description: "A Square alternative for local businesses — a lower in-person card rate, real local setup and support, and a deeper free point-of-sale, with no lock-in, across the GTA and Durham.",
  areaServed: ["Greater Toronto Area", "Toronto", "Durham Region", "Ontario"],
  path: "/square-alternative",
});

export default function SquareAlternativePage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Square alternative", "/square-alternative")} />

      <LandingHero
        eyebrow="Switching from Square"
        h1={<>A Square alternative with a lower rate and a <span className="text-blue-600">local human</span>.</>}
        intro="Square is easy to start with, but a flat ~2.65% adds up, support is a chat window, and you set it up yourself. Surge keeps the no-lock-in simplicity — and adds a lower in-person rate, local setup, and a deeper POS."
      />

      <LandingSection title="Why owners look for a Square alternative">
        <p>Square earned its place by making it easy to take a first payment. But as a shop grows, the same things come up: the flat rate quietly outpaces a sharper in-person rate, real help means a chat thread or a callback, and the free POS keeps bumping you toward paid tiers for the features you actually need.</p>
        <p>Surge keeps what&rsquo;s good about Square &mdash; <strong>no term contract, cancel any time</strong> &mdash; and fixes the rest: <strong>2.5% + 15¢</strong> in person, local in-person setup, a full POS included free, and a real person on the phone. If we&rsquo;re not saving you money, you walk.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to Square" tint>
        <p>Square&rsquo;s published pricing shifts and varies by product, so treat the right-hand column as the patterns merchants commonly report &mdash; not a live quote.</p>
        <LandingCompare
          competitor="Square (typical)"
          rows={compareRows}
          note="Square figures reflect commonly reported patterns; confirm current Square pricing for your product mix before switching."
        />
      </LandingSection>

      <LandingSection title="See what you'd save vs your Square rate">
        <p>Drag the sliders to your real monthly card volume and average ticket. Compare a flat ~2.65% to Surge&rsquo;s 2.5% + 15¢ &mdash; on most in-person tickets the gap, times your annual volume, is real money kept.</p>
        <div className="mt-6"><SavingsEstimator /></div>
        <p className="text-sm text-slate-500">Want us to check the exact difference? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free 15-minute call</Link> and we&rsquo;ll run your real numbers &mdash; or learn <Link href="/guides/flat-rate-vs-interchange-plus-pricing" className="font-semibold text-blue-600 hover:text-blue-700">how flat-rate pricing compares</Link>.</p>
      </LandingSection>

      <LandingSection title="More than a card reader" tint>
        <p>Where Square hands you a reader, Surge gives you a business system: a full <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> with inventory, reports and refunds included free, plus in-person setup and local support across the GTA and Durham. Run a restaurant or a shop? See <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link> or <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">POS for retail</Link>.</p>
      </LandingSection>

      <LandingGuides slugs={["flat-rate-vs-interchange-plus-pricing", "how-to-read-your-merchant-statement", "what-is-a-junk-fee-on-a-merchant-account"]} />

      <LandingCTA
        heading="See exactly what you'd save vs Square"
        sub="A free 15-minute call, a clear quote, and the real dollar difference — no pressure, no jargon."
      />

      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by Square. Square is a trademark of its owner. Competitor pricing and features change and vary by merchant &mdash; confirm current terms before switching.
      </LandingDisclaimer>
    </>
  );
}
