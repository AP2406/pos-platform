import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

// THE WEAKEST FIT OF THE FIVE, AND STILL NOT DELETED. A bank merchant account
// has no POS story at all, so there is nothing here to swap like-for-like — the
// honest version of this page is "we are not a bank processor; if you are
// leaving one you still need a till, and that is the part we do". Deleting it
// would 404 a ranking URL with no close survivor to redirect to, and a 301 onto
// /pricing would be a consolidation Google commonly treats as a soft 404.
// Kept, repositioned, demoted. Full reasoning: docs/site-pos-first-audit.md §3.
//
// Off: the 2.5% + 15¢ rate, the $10 setup, "the terminal is yours, not rented"
// (we do not supply terminals), the savings estimator, and the rate/monthly-fee
// comparison rows.
export const metadata: Metadata = {
  title: { absolute: "TD Merchant Solutions Alternative — The POS Half | Surge" },
  description: "Leaving a bank merchant account? Surge is the point-of-sale half: register, floor plan, kitchen display, reservations and ordering channels, with no term contract and local setup across the GTA. Card processing coming soon.",
  alternates: { canonical: "/td-merchant-solutions-alternative", },
  openGraph: { ...OG_BASE, url: "/td-merchant-solutions-alternative", type: "website" },
};

const tiles = [
  { title: "No term contract", body: "Bank merchant agreements are commonly multi-year with an early-termination fee. There is no term on Surge software and no cancellation fee." },
  { title: "Nothing rented", body: "No monthly terminal rental, because there is no terminal — the POS runs on the tablet or phone you already own." },
  { title: "The business, not just the sale", body: "A bank gives you a card machine. Surge gives you the floor plan, the kitchen display, the menu, the stock, the schedule and the reports." },
  { title: "Local, real support", body: "In-person setup across the GTA and Durham and a human on the phone rather than a call-centre queue." },
];

const compareRows: [string, string, string][] = [
  ["Card processing", "Not yet — coming soon", "Yes — this is what a bank merchant account is"],
  ["POS software", "Two tiers, free one included", "Typically separate / third-party"],
  ["Floor plan & table service", "Included on Advanced", "Not part of the merchant account"],
  ["Kitchen display", "Included on Advanced", "Not part of the merchant account"],
  ["Online, QR & kiosk ordering", "Included on Advanced", "Separate products"],
  ["Hardware", "Runs on your own device", "Terminal often rented monthly"],
  ["Software contract", "None — cancel anytime", "Commonly a multi-year term"],
  ["Support", "Local, real human", "Call centre"],
];

const service = localService({
  name: "Point of sale (bank merchant services alternative)",
  description: "For businesses leaving a bank merchant account — a point-of-sale with floor plan, kitchen display, reservations and ordering channels, no term contract, and local setup across the GTA and Durham.",
  areaServed: ["Greater Toronto Area", "Toronto", "Durham Region", "Ontario"],
  path: "/td-merchant-solutions-alternative",
});

export default function TdMerchantSolutionsAlternativePage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("TD Merchant Solutions alternative", "/td-merchant-solutions-alternative")} />

      <LandingHero
        eyebrow="Switching from TD Merchant Solutions"
        h1={<>Leaving a bank processor? We are the <span className="text-blue-600">till</span>, not the merchant account.</>}
        intro="Straight answer first: Surge does not process cards yet, so we cannot take over a TD merchant account today. What a bank account never gave you in the first place is a point-of-sale — and that is the part we do, with no term contract and nothing rented."
      />

      <LandingSection title="Why owners look for a bank-processor alternative">
        <p>Signing up for payments through your bank is convenient, and for some businesses that is enough. But a lot of owners tell us the same story: a multi-year term they do not remember agreeing to, a monthly terminal rental that never ends, an account fee before the first sale, and a &ldquo;rate&rdquo; that is really a blend hiding what each card actually costs.</p>
        <p>We are not yet the answer to the rate half of that. We are the answer to the part the bank never covered: the business still runs on a card machine, a notebook and a spreadsheet. Surge is the register, the floor plan, the kitchen display, the menu, the stock, the schedule and the reports &mdash; free to start, no term, working beside whatever processor you keep.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to a bank processor" tint>
        <p>These are two different kinds of product, which is what the first row says. Every bank merchant agreement is negotiated, so treat the right-hand column as the patterns small merchants commonly report &mdash; your own terms are in your contract.</p>
        <LandingCompare
          competitor="TD Merchant Solutions (typical)"
          rows={compareRows}
          note="Figures reflect commonly reported patterns for small merchants on bank processing; your actual terms are in your agreement — check them."
        />
      </LandingSection>

      <LandingSection title="When we will be a real alternative">
        <p>We are building our own card processing. Until it is live we do not quote a rate, we do not sell terminals, and we will not pretend otherwise to win a call.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
        <p className="text-sm text-[#7A8CA0]">Not sure what your bank is actually charging? Here is <Link href="/guides/how-to-read-your-merchant-statement" className="font-semibold text-blue-600 hover:text-blue-700">how to read the statement yourself</Link>, and we are happy to go through it with you on a <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">free call</Link> even though we cannot quote against it yet.</p>
      </LandingSection>

      <LandingSection title="You can move the till first" tint>
        <p>Nothing about your merchant account has to change to run Surge on the counter. Put the <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> in now and keep the bank taking the card. Restaurants start with <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link>; shops with <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">POS for retail</Link>.</p>
      </LandingSection>

      <LandingGuides slugs={["how-to-read-your-merchant-statement", "what-is-a-junk-fee-on-a-merchant-account", "flat-rate-vs-interchange-plus-pricing"]} />

      <LandingCTA
        heading="See the till you'd be moving to"
        sub="A free 15-minute demo on your own menu — no pressure, no jargon."
      />

      {/* Legal text, left exactly as it was. */}
      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by The Toronto-Dominion Bank or Global Payments. TD and TD Merchant Solutions are trademarks of their owner. Competitor terms and fees change and vary by merchant &mdash; confirm your own agreement before switching.
      </LandingDisclaimer>
    </>
  );
}
