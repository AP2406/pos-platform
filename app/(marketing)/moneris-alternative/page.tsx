import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

// MONERIS IS A PROCESSOR, NOT A POS — so this page cannot simply swap one
// comparison for another, and it was the hardest of the five to decide on.
// Kept rather than 301'd (see docs/site-pos-first-audit.md §3): the merchant
// typing "moneris alternative" is leaving a merchant account, and the thing
// that makes leaving painful is usually the till on the counter, which IS what
// we sell. The page therefore answers a narrower question than it used to, and
// says so in the first paragraph rather than burying it.
//
// Off: the 2.5% + 15¢ rate, the "$10 one-time setup", the savings estimator,
// the rate/monthly-fee comparison rows, and the "get you taking tap, chip,
// Interac, Apple Pay and Google Pay from day one" promise.
export const metadata: Metadata = {
  title: { absolute: "Moneris Alternative — The POS Side, No Lock-In | Surge" },
  description: "Leaving Moneris? Surge is the point-of-sale half: a register, floor plan, kitchen display, reservations and ordering channels, with no term contract and local setup across the GTA. Card processing coming soon.",
  alternates: { canonical: "/moneris-alternative", },
  openGraph: { ...OG_BASE, url: "/moneris-alternative", type: "website" },
};

const tiles = [
  { title: "No term contract", body: "Moneris agreements are commonly 3–5 years with an early-termination fee. There is no term on Surge software and no cancellation fee." },
  { title: "A till, not a terminal", body: "A bank merchant account gives you a card machine. Surge gives you the system around it — floor, kitchen, menu, stock, staff and reports." },
  { title: "Free tier that is a real register", body: "Basic costs nothing and is not a trial. Advanced adds the floor plan, kitchen display, reservations and the ordering channels." },
  { title: "Local, real support", body: "Set up in person across the GTA and Durham, with a human on the phone rather than a call-centre queue." },
];

// Rate and monthly-fee rows are gone: we have no rate to put in the left column.
// What is left is a software comparison, plus an honest first row.
const compareRows: [string, string, string][] = [
  ["Card processing", "Not yet — coming soon", "Yes — this is what Moneris is"],
  ["POS software", "Two tiers, free one included", "Typically a paid add-on"],
  ["Floor plan & table service", "Included on Advanced", "Not part of the merchant account"],
  ["Kitchen display", "Included on Advanced", "Not part of the merchant account"],
  ["Online, QR & kiosk ordering", "Included on Advanced", "Separate products"],
  ["Software contract", "None — cancel anytime", "Commonly a 3–5 year term"],
  ["Early-termination fee", "None", "Often $300–$500 to leave early"],
  ["Support", "Local, real human", "Call centre"],
];

const service = localService({
  name: "Point of sale (Moneris alternative)",
  description: "For businesses leaving Moneris — a point-of-sale with floor plan, kitchen display, reservations and ordering channels, no term contract, and local setup across the GTA and Durham.",
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
        h1={<>Leaving Moneris? We are the <span className="text-blue-600">till</span>, not the merchant account.</>}
        intro="Straight answer first: Surge does not process cards yet, so we cannot replace your Moneris merchant account today. What we can replace is the terminal-shaped hole where your point-of-sale should be — and do it with no term contract."
      />

      <LandingSection title="Why owners look for a Moneris alternative">
        <p>Moneris is Canada&rsquo;s largest processor, and for a big enterprise with a negotiating team it can work. But a lot of independent shops tell us the same things: they are locked into a multi-year term, they are paying monthly account and terminal fees before a single sale, and their &ldquo;rate&rdquo; is a blended number that hides what each transaction actually costs.</p>
        <p>We are not yet the answer to the rate half of that. We are the answer to the other half: a bank merchant account leaves you running the business on a card machine and a spreadsheet. Surge is the register, the floor plan, the kitchen display, the menu, the stock, the schedule and the reports &mdash; free to start, no term, and it works beside whatever processor you keep.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to Moneris" tint>
        <p>These are two different kinds of product, which is exactly what the first row says. Every business&rsquo;s Moneris agreement is different, so treat the right-hand column as the patterns small merchants commonly report &mdash; not a quote.</p>
        <LandingCompare
          competitor="Moneris (typical)"
          rows={compareRows}
          note="Moneris figures reflect commonly reported patterns for small merchants; your actual Moneris terms are in your agreement — check them."
        />
      </LandingSection>

      <LandingSection title="When we will be a real alternative">
        <p>We are building our own processing. We are not quoting a rate or a date, because a rate we cannot honour and a date we miss are both worse than saying nothing.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
        <p className="text-sm text-[#7A8CA0]">Not sure what you are actually paying Moneris now? That is the point of a blended rate &mdash; here is <Link href="/guides/how-to-read-your-merchant-statement" className="font-semibold text-blue-600 hover:text-blue-700">how to read the statement yourself</Link>, and we are happy to go through it with you on a <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">free call</Link> even though we cannot quote against it.</p>
      </LandingSection>

      <LandingSection title="You can move the till first" tint>
        <p>Nothing about your merchant account has to change to run Surge on the counter. Put the <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> in today, keep Moneris taking the card, and when our processing is live it becomes one more tender type on a register your staff already know. Restaurants start with <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link>; shops with <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">POS for retail</Link>.</p>
      </LandingSection>

      <LandingGuides slugs={["how-to-read-your-merchant-statement", "flat-rate-vs-interchange-plus-pricing", "what-is-a-junk-fee-on-a-merchant-account"]} />

      <LandingCTA
        heading="See the till you'd be moving to"
        sub="A free 15-minute demo on your own menu — no pressure, no jargon."
      />

      {/* Legal text, left exactly as it was. */}
      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by Moneris. Moneris is a trademark of its owner. Competitor terms and fees change and vary by merchant &mdash; confirm your own agreement before switching.
      </LandingDisclaimer>
    </>
  );
}
