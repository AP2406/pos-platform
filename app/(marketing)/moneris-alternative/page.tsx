import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { SavingsEstimator } from "../savings-estimator";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "Moneris Alternative — No Contract, No Junk Fees | Surge" },
  description: "Looking for a Moneris alternative? Surge offers transparent card processing — one clear rate, no term contract, no monthly fee, and a free POS. See what you'd save.",
  alternates: { canonical: "/moneris-alternative" },
  openGraph: { ...OG_BASE, url: "/moneris-alternative", type: "website" },
};

const tiles = [
  { title: "No term contract", body: "Moneris agreements are commonly 3–5 years with an early-termination fee. Surge has no term and no cancellation fee — stay because it works, not because you're stuck." },
  { title: "No monthly fee", body: "No account fee or software fee stacked on before you've sold anything. One transparent rate, that's it." },
  { title: "A rate you can actually read", body: "One clear 2.5% + 15¢ in person — not a blended number with the markup buried inside." },
  { title: "POS included free", body: "A full point-of-sale comes with your payments — no separate monthly POS bill." },
];

const compareRows: [string, string, string][] = [
  ["In-person rate", "2.5% + 15¢, clearly stated", "Often a blended/custom rate"],
  ["Monthly fee", "$0", "Account + terminal fees commonly apply"],
  ["Contract", "None — cancel anytime", "Commonly a 3–5 year term"],
  ["Early-termination fee", "None", "Often $300–$500 to leave early"],
  ["POS software", "Included free", "Typically a paid add-on"],
  ["Setup", "$10 one-time", "Varies"],
  ["Support", "Local, real human", "Call centre"],
];

const service = localService({
  name: "Payment processing (Moneris alternative)",
  description: "A transparent Moneris alternative for local businesses — one clear card rate, no term contract, no monthly fee, and a free point-of-sale, with local setup across the GTA and Durham.",
  areaServed: ["Greater Toronto Area", "Toronto", "Durham Region", "Ontario"],
  path: "/moneris-alternative",
});

export default function MonerisAlternativePage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Moneris alternative", "/moneris-alternative")} />

      <LandingHero
        eyebrow="Switching from Moneris"
        h1={<>A Moneris alternative built for local business — not <span className="text-blue-600">lock-in</span>.</>}
        intro="If you're on Moneris and tired of the term contract, the monthly line items, and a rate you can't quite decode, there's a simpler option. Surge gives you one clear rate, no lock-in, and a real local person who picks up the phone."
      />

      <LandingSection title="Why owners look for a Moneris alternative">
        <p>Moneris is Canada&rsquo;s largest processor, and for big enterprises with a negotiating team it can work. But a lot of independent shops tell us the same things: they&rsquo;re locked into a multi-year term, they&rsquo;re paying monthly account and terminal fees before a single sale, and their &ldquo;rate&rdquo; is a blended number that hides what each transaction actually costs.</p>
        <p>Surge is built the other way around: <strong>2.5% + 15¢</strong> on in-person cards, a one-time $10 setup, <strong>no monthly fee</strong>, and <strong>no term contract</strong> — cancel any time. You see the number, you keep more of every sale, and if we&rsquo;re not saving you money, you walk.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to Moneris" tint>
        <p>Every business&rsquo;s Moneris agreement is different, so treat the right-hand column as the patterns small merchants commonly report &mdash; not a quote.</p>
        <LandingCompare
          competitor="Moneris (typical)"
          rows={compareRows}
          note="Moneris figures reflect commonly reported patterns for small merchants; your actual Moneris terms are in your agreement — check them."
        />
      </LandingSection>

      <LandingSection title="See what you'd save vs your Moneris rate">
        <p>Drag the sliders to your real monthly card volume and average ticket. If you know your Moneris effective rate, compare it to Surge&rsquo;s 2.5% + 15¢ &mdash; the gap, times your annual volume, is real money.</p>
        <div className="mt-6"><SavingsEstimator /></div>
        <p className="text-sm text-slate-500">Not sure what you&rsquo;re actually paying Moneris now? That&rsquo;s the point of a blended rate. <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Send us your last statement</Link> and we&rsquo;ll compute your real effective rate on a free 15-minute call &mdash; here&rsquo;s <Link href="/guides/how-to-read-your-merchant-statement" className="font-semibold text-blue-600 hover:text-blue-700">how to read it yourself</Link>.</p>
      </LandingSection>

      <LandingSection title="Switching is easier than staying" tint>
        <p>You don&rsquo;t have to wait for a contract to end to get a quote. We&rsquo;ll read your current Moneris statement with you, show you the exact difference, set up your terminal in person across the GTA and Durham, and get you taking tap, chip, Interac, Apple Pay and Google Pay from day one. If there&rsquo;s an early-termination cost, we&rsquo;ll factor it into the math honestly so you know the real break-even.</p>
      </LandingSection>

      <LandingGuides slugs={["how-to-read-your-merchant-statement", "flat-rate-vs-interchange-plus-pricing", "what-is-a-junk-fee-on-a-merchant-account"]} />

      <LandingCTA
        heading="See exactly what you'd save vs Moneris"
        sub="A free 15-minute call, a clear quote, and the real dollar difference — no pressure, no jargon."
      />

      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by Moneris. Moneris is a trademark of its owner. Competitor terms and fees change and vary by merchant &mdash; confirm your own agreement before switching.
      </LandingDisclaimer>
    </>
  );
}
