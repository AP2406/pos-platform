import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

// SQUARE IS A PROCESSOR *AND* A POS, so this page repositions with no strain —
// the reader is already shopping for a till, and the comparison simply moves
// from rate-vs-rate to system-vs-system. What came off: the ~2.65% vs 2.5% + 15¢
// argument, the savings estimator, and the "terminal included, $10 one-time"
// hardware row (we do not sell hardware). The page now says in the hero that we
// are not the one taking the card, so nobody reads a POS comparison and infers
// a merchant account.
export const metadata: Metadata = {
  title: { absolute: "Square Alternative — A Deeper POS With Local Setup | Surge" },
  description: "Looking for a Square alternative? Surge is a point-of-sale with a floor plan, kitchen display, reservations and ordering channels included, set up in person across the GTA. Card processing coming soon.",
  alternates: { canonical: "/square-alternative", },
  openGraph: { ...OG_BASE, url: "/square-alternative", type: "website" },
};

const tiles = [
  { title: "A floor, not just a counter", body: "Square's till is built around a queue. Surge has a floor plan, coursing, seat numbers and table transfers, which is what a dining room actually needs." },
  { title: "The kitchen is included", body: "Tickets route to the station that cooks them on the Advanced tier, rather than being a separate product you bolt on." },
  { title: "Local, in-person setup", body: "Square ships you a reader and leaves the rest to you. We come to your room across the GTA and Durham, load the menu and train your staff." },
  { title: "Real human support", body: "Trade chat threads and callback queues for a local person who answers the phone and knows your account." },
];

// The rate row is gone. These rows compare the two things as POS systems, which
// is the only comparison we can currently stand behind.
const compareRows: [string, string, string][] = [
  ["Card processing", "Not yet — coming soon", "Built in, Square is the processor"],
  ["Floor plan & table service", "Included on Advanced", "Restaurant product / paid tier"],
  ["Kitchen display", "Included on Advanced", "Paid add-on in most setups"],
  ["Reservations & waitlist", "Included on Advanced", "Separate product"],
  ["Online, QR & kiosk ordering", "Included on Advanced", "Varies by product and tier"],
  ["Free tier", "A real register, one till", "Free tier basic; upgrades are paid"],
  ["Contract", "None — cancel anytime", "None"],
  ["Setup", "Local, in person (GTA & Durham)", "Self-serve; ship-a-reader"],
  ["Support", "Local, real human", "Chat / callback"],
];

const service = localService({
  name: "Point of sale (Square alternative)",
  description: "A Square alternative for local businesses — a point-of-sale with floor plan, kitchen display, reservations and ordering channels, set up in person across the GTA and Durham.",
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
        h1={<>A Square alternative with a <span className="text-blue-600">deeper till</span> and a local human.</>}
        intro="Square is easy to start with and thin once the room gets complicated. Surge is the point-of-sale side done properly — floor, kitchen, bookings and ordering channels. One difference to be upfront about: Square processes your cards, and we do not yet."
      />

      <LandingSection title="Why owners look for a Square alternative">
        <p>Square earned its place by making a first payment easy. But as a shop grows, the same things come up: the free till keeps bumping you toward paid tiers for the features you actually need, the restaurant pieces are a separate product line, and real help means a chat thread or a callback.</p>
        <p>Surge keeps what is good about Square &mdash; <strong>no term contract, cancel any time</strong> &mdash; and puts the depth in the software: a floor plan with table service, a kitchen display, reservations and a waitlist, online, QR and kiosk ordering, stock, staff and the time clock, with a free tier that is a real register.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to Square" tint>
        <p>Square&rsquo;s products and packaging shift, so treat the right-hand column as the patterns merchants commonly report &mdash; not a live quote. The first row is the honest one to read first.</p>
        <LandingCompare
          competitor="Square (typical)"
          rows={compareRows}
          note="Square figures reflect commonly reported patterns; confirm current Square products and pricing for your business before switching."
        />
      </LandingSection>

      <LandingSection title="The part we have not shipped">
        <p>If what you want from Square is the processing, we are not your answer yet. We are building it, we are not quoting a rate, and we would rather you read that here than hear it on a call.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
        <p className="text-sm text-[#7A8CA0]">You can run Surge on the counter and keep Square taking the card in the meantime &mdash; nothing has to be cancelled to try the till.</p>
      </LandingSection>

      <LandingSection title="More than a card reader" tint>
        <p>Where Square hands you a reader, Surge gives you a business system: the full <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link>, with in-person setup and local support across the GTA and Durham. Run a restaurant or a shop? See <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link> or <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">POS for retail</Link>.</p>
      </LandingSection>

      <LandingGuides slugs={["flat-rate-vs-interchange-plus-pricing", "how-to-read-your-merchant-statement", "what-is-a-junk-fee-on-a-merchant-account"]} />

      <LandingCTA
        heading="See the till you'd be moving to"
        sub="A free 15-minute demo on your own menu — no pressure, no jargon."
      />

      {/* Legal text, left exactly as it was. */}
      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by Square. Square is a trademark of its owner. Competitor pricing and features change and vary by merchant &mdash; confirm current terms before switching.
      </LandingDisclaimer>
    </>
  );
}
