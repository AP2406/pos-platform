import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

// STRIPE IS A PROCESSOR AND A TOOLKIT, NOT A TILL — Stripe Terminal gives you
// an SDK and a reader and expects you to build the register. That makes this
// the easiest of the three pure-processor pages to reposition honestly: the
// page's original argument was already "you want a POS, not an API", and only
// the rate half of it has to come off. Kept, repositioned, demoted in the
// footer and the sitemap. See docs/site-pos-first-audit.md §3.
export const metadata: Metadata = {
  title: { absolute: "Stripe Alternative for In-Person Business — A Real POS | Surge" },
  description: "Looking for a Stripe alternative for the counter? Surge is a point-of-sale you can run without writing code — register, floor plan, kitchen display, ordering channels — set up in person across the GTA. Card processing coming soon.",
  alternates: { canonical: "/stripe-alternative", },
  openGraph: { ...OG_BASE, url: "/stripe-alternative", type: "website" },
};

const tiles = [
  { title: "Built for the counter, not the codebase", body: "Stripe is developer- and online-first. Surge is a finished register — you open it and ring up a sale." },
  { title: "Local setup, no code", body: "No integration, no API keys, no webhook to debug at 7am. We set the system up with you across the GTA and Durham." },
  { title: "The room, not just the transaction", body: "Floor plan, coursing, kitchen display, reservations, stock and staff — the parts a toolkit expects you to build yourself." },
  { title: "A real human", body: "A local person on the phone rather than docs, a dashboard and an email queue." },
];

const compareRows: [string, string, string][] = [
  ["Card processing", "Not yet — coming soon", "Yes — this is what Stripe is"],
  ["Point-of-sale software", "A finished register, free tier included", "Bring-your-own or build it on Terminal"],
  ["Floor plan & table service", "Included on Advanced", "Build it yourself"],
  ["Kitchen display", "Included on Advanced", "Build it yourself"],
  ["Online, QR & kiosk ordering", "Included on Advanced", "Build it yourself"],
  ["Setup", "Local, in person, no code", "Self-serve / developer integration"],
  ["Support", "Local, real human", "Docs, dashboard, email"],
  ["Contract", "None — cancel anytime", "None"],
];

const service = localService({
  name: "Point of sale (Stripe alternative)",
  description: "A Stripe alternative for in-person local business — a finished point-of-sale with floor plan, kitchen display and ordering channels, set up with no code across the GTA and Durham.",
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
        h1={<>A Stripe alternative for people who run a <span className="text-blue-600">counter</span>, not an API.</>}
        intro="Stripe gives you building blocks and expects you to assemble the register. Surge is the assembled register. To be clear about the trade: Stripe also processes your cards and we do not yet, so today this is a swap of the software half."
      />

      <LandingSection title="Why in-person owners look for a Stripe alternative">
        <p>Stripe built its reputation online and it is superb there. In person, though, it expects you to be self-serve: order a reader, wire it up, write the register, and lean on documentation when something goes wrong. For a café, salon or shop, that is a lot of overhead for taking a tap.</p>
        <p>Surge is the counter-first option: a finished point-of-sale with a floor plan, a kitchen display, reservations, online, QR and kiosk ordering, stock, staff and reports. Nothing to integrate, nothing to maintain, and a free tier that is a working till on day one.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to Stripe" tint>
        <p>These are different kinds of product, which the first row says plainly. Stripe&rsquo;s products vary by region, so treat the right-hand column as commonly reported patterns rather than a quote.</p>
        <LandingCompare
          competitor="Stripe (typical)"
          rows={compareRows}
          note="Stripe figures reflect commonly reported patterns and vary by product and region; confirm current Stripe products and pricing before switching."
        />
      </LandingSection>

      <LandingSection title="The part we have not shipped">
        <p>If it is the processing you want to move, we are not there yet and we are not quoting a rate. If it is the register, that part is ready.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
        <p className="text-sm text-[#7A8CA0]">Want the comparison for your own setup? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free 15-minute demo</Link> &mdash; or read <Link href="/guides/flat-rate-vs-interchange-plus-pricing" className="font-semibold text-blue-600 hover:text-blue-700">flat-rate vs interchange-plus pricing</Link>.</p>
      </LandingSection>

      <LandingSection title="A register, not a toolkit" tint>
        <p>Where Stripe hands you building blocks, Surge hands you a working business system: the full <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link>, set up in person and backed by local support. See it for <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">restaurants</Link> or <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">retail</Link>.</p>
      </LandingSection>

      <LandingGuides slugs={["flat-rate-vs-interchange-plus-pricing", "how-to-read-your-merchant-statement"]} />

      <LandingCTA
        heading="See the register you'd be moving to"
        sub="A free 15-minute demo on your own menu — no code, no pressure."
      />

      {/* Legal text, left exactly as it was. */}
      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by Stripe. Stripe is a trademark of its owner. Competitor pricing and features change and vary by product and region &mdash; confirm current terms before switching.
      </LandingDisclaimer>
    </>
  );
}
