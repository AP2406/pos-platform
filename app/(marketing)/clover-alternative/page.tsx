import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

// CLOVER IS A POS SOLD THROUGH PROCESSORS, so like Square this page repositions
// naturally — and its two strongest arguments (app subscriptions, hardware tied
// to whoever sold it) were always software arguments, not rate arguments, so
// they survive the change intact. Off: the 2.5% + 15¢ line, the estimator, and
// the "terminal $10 setup" hardware row.
export const metadata: Metadata = {
  title: { absolute: "Clover Alternative — A POS With No App Fees | Surge" },
  description: "Looking for a Clover alternative? Surge is a point-of-sale with the floor plan, kitchen display, reservations and ordering channels included — no app subscriptions, no hardware lock-in, local setup. Card processing coming soon.",
  alternates: { canonical: "/clover-alternative", },
  openGraph: { ...OG_BASE, url: "/clover-alternative", type: "website" },
};

const tiles = [
  { title: "No app subscriptions", body: "Clover software plans and add-on apps commonly carry their own monthly fees. Surge has two tiers and everything in a tier is in it." },
  { title: "No locked-in hardware", body: "Clover hardware is often tied to the processor that sold it and hard to reuse elsewhere. Surge runs on the device you already have." },
  { title: "One system, not a plan matrix", body: "Floor plan, kitchen display, reservations, ordering channels, stock and staff — on one tier, not assembled from a catalogue." },
  { title: "Local, real support", body: "In-person setup across the GTA and Durham and a human on the phone — not a hand-off to whichever reseller signed you up." },
];

const compareRows: [string, string, string][] = [
  ["Card processing", "Not yet — coming soon", "Sold with the device by a bank or reseller"],
  ["POS software", "Two tiers, free one included", "Tiered plans + paid apps"],
  ["Floor plan & table service", "Included on Advanced", "Depends on plan and apps"],
  ["Kitchen display", "Included on Advanced", "Commonly a paid app"],
  ["Reservations & waitlist", "Included on Advanced", "Third-party app"],
  ["Hardware", "Runs on your own device", "Proprietary, often processor-locked"],
  ["Contract", "None — cancel anytime", "Often set by the reselling processor"],
  ["Support", "Local, real human", "Depends on the reseller"],
];

const service = localService({
  name: "Point of sale (Clover alternative)",
  description: "A Clover alternative for local businesses — a point-of-sale with no app subscriptions and no hardware lock-in, with local setup across the GTA and Durham.",
  areaServed: ["Greater Toronto Area", "Toronto", "Durham Region", "Ontario"],
  path: "/clover-alternative",
});

export default function CloverAlternativePage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("Clover alternative", "/clover-alternative")} />

      <LandingHero
        eyebrow="Switching from Clover"
        h1={<>A Clover alternative without the <span className="text-blue-600">app fees</span> or locked hardware.</>}
        intro="Clover's boxes are slick and the bill grows quietly — a software plan, then the apps that turn out to be essential, on hardware tied to whoever sold it. Surge is the software side without that. One thing to be upfront about: Clover comes with a processor, and we are not one yet."
      />

      <LandingSection title="Why owners look for a Clover alternative">
        <p>Clover isn&rsquo;t one company selling one product &mdash; it&rsquo;s a device sold through many banks and resellers, each setting their own plan. So two shops with identical Clover stations can pay very different amounts, and the monthly total often grows as &ldquo;essential&rdquo; apps get added on top of the software plan.</p>
        <p>Surge has two tiers and no catalogue. Basic is a free register. Advanced is the whole system &mdash; floor plan and table service, kitchen display, reservations and waitlist, online, QR and kiosk ordering, stock, staff and the time clock &mdash; for one flat monthly fee, on hardware you already own, with no contract.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to Clover" tint>
        <p>Because Clover terms are set by whoever sold you the machine, treat the right-hand column as common patterns &mdash; your own plan is in your agreement. The first row is the one to read first.</p>
        <LandingCompare
          competitor="Clover (typical)"
          rows={compareRows}
          note="Clover is sold through many resellers, so products, pricing and contract terms vary widely; check the agreement from your specific provider."
        />
      </LandingSection>

      <LandingSection title="The part we have not shipped">
        <p>A Clover deal bundles the till and the merchant account. We only do one of those today. If you leave Clover for Surge, you will need a processor &mdash; yours, or a new one &mdash; until ours is live.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
        <p className="text-sm text-[#7A8CA0]">Not sure what your Clover reseller is actually charging? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Send us the statement</Link> and we will break it down &mdash; or read <Link href="/guides/what-is-a-junk-fee-on-a-merchant-account" className="font-semibold text-blue-600 hover:text-blue-700">what counts as a junk fee</Link>.</p>
      </LandingSection>

      <LandingSection title="A POS you own, not rent" tint>
        <p>Where Clover locks the software behind plans and the apps behind subscriptions, Surge is one <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> on hardware you already have. Running a restaurant or a shop? See <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link> or <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">POS for retail</Link>.</p>
      </LandingSection>

      <LandingGuides slugs={["what-is-a-junk-fee-on-a-merchant-account", "how-to-read-your-merchant-statement", "flat-rate-vs-interchange-plus-pricing"]} />

      <LandingCTA
        heading="See the till you'd be moving to"
        sub="A free 15-minute demo on your own menu — no pressure, no jargon."
      />

      {/* Legal text, left exactly as it was. */}
      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by Clover or Fiserv. Clover is a trademark of its owner. Because Clover is sold through many resellers, pricing and terms vary widely &mdash; confirm your own agreement before switching.
      </LandingDisclaimer>
    </>
  );
}
