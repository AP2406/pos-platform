import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { SavingsEstimator } from "../savings-estimator";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "Clover Alternative — One Rate, No App Fees | Surge" },
  description: "Looking for a Clover alternative? Surge gives you one clear card rate, a free POS with no app subscriptions, no processor lock-in, and real local support. See what you'd save.",
  alternates: { canonical: "/clover-alternative" },
  openGraph: { ...OG_BASE, url: "/clover-alternative", type: "website" },
};

const tiles = [
  { title: "One clear rate", body: "Clover is commonly sold through banks and resellers, so the rate you actually get varies a lot. Surge is one stated 2.5% + 15¢ in person, everywhere." },
  { title: "No app subscriptions", body: "Clover software plans and add-on apps commonly carry their own monthly fees. Surge includes a full point-of-sale free with your payments." },
  { title: "No locked-in hardware", body: "Clover hardware is often tied to the processor that sold it and hard to reuse elsewhere. Surge runs on the device you already have." },
  { title: "Local, real support", body: "In-person setup across the GTA and Durham and a human on the phone — not a hand-off to whichever reseller signed you up." },
];

const compareRows: [string, string, string][] = [
  ["In-person rate", "2.5% + 15¢, clearly stated", "Varies by reseller / bank"],
  ["Monthly fee", "$0", "Software plan + app fees commonly apply"],
  ["Contract", "None — cancel anytime", "Often set by the reselling processor"],
  ["POS software", "Included free", "Tiered plans + paid apps"],
  ["Hardware", "Runs on your device; terminal $10 setup", "Proprietary, often processor-locked"],
  ["Support", "Local, real human", "Depends on the reseller"],
];

const service = localService({
  name: "Payment processing (Clover alternative)",
  description: "A Clover alternative for local businesses — one clear card rate, a free point-of-sale with no app subscriptions, no processor lock-in, and local setup across the GTA and Durham.",
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
        h1={<>A Clover alternative without the <span className="text-blue-600">app fees</span> or lock-in.</>}
        intro="Clover's hardware is slick, but it's usually sold through a bank or reseller — with a rate that varies, app subscriptions stacked on the software, and hardware tied to your processor. Surge keeps it simple: one clear rate, a free POS, and local support."
      />

      <LandingSection title="Why owners look for a Clover alternative">
        <p>Clover isn&rsquo;t one company selling one price &mdash; it&rsquo;s a device sold through many banks and resellers, each setting their own rate and plan. So two shops with identical Clover stations can pay very different amounts, and the monthly total often grows as &ldquo;essential&rdquo; apps get added on top of the software plan.</p>
        <p>Surge is the opposite of a reseller maze: <strong>2.5% + 15¢</strong> in person, a one-time $10 setup, <strong>no monthly fee</strong>, no app subscriptions, and a full point-of-sale included free. Nothing tied to hardware you can&rsquo;t reuse, and no contract you can&rsquo;t leave.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to Clover" tint>
        <p>Because Clover terms are set by whoever sold you the machine, treat the right-hand column as common patterns &mdash; your own plan is in your agreement.</p>
        <LandingCompare
          competitor="Clover (typical)"
          rows={compareRows}
          note="Clover is sold through many resellers, so pricing and contract terms vary widely; check the agreement from your specific provider."
        />
      </LandingSection>

      <LandingSection title="See what you'd save vs your Clover plan">
        <p>Drag the sliders to your real monthly card volume and average ticket. Add your Clover software and app fees on top of your rate, and the yearly gap versus Surge&rsquo;s flat 2.5% + 15¢ gets clear fast.</p>
        <div className="mt-6"><SavingsEstimator /></div>
        <p className="text-sm text-slate-500">Not sure what your Clover reseller is actually charging? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Send us your statement</Link> and we&rsquo;ll break it down &mdash; or learn <Link href="/guides/what-is-a-junk-fee-on-a-merchant-account" className="font-semibold text-blue-600 hover:text-blue-700">what counts as a junk fee</Link>.</p>
      </LandingSection>

      <LandingSection title="A POS you own, not rent" tint>
        <p>Where Clover locks the software behind plans and the apps behind subscriptions, Surge includes a full <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> free &mdash; inventory, reports and refunds &mdash; on hardware you already own. Running a restaurant or a shop? See <Link href="/pos-for-restaurants" className="font-semibold text-blue-600 hover:text-blue-700">POS for restaurants</Link> or <Link href="/pos-for-retail" className="font-semibold text-blue-600 hover:text-blue-700">POS for retail</Link>.</p>
      </LandingSection>

      <LandingGuides slugs={["what-is-a-junk-fee-on-a-merchant-account", "how-to-read-your-merchant-statement", "flat-rate-vs-interchange-plus-pricing"]} />

      <LandingCTA
        heading="See exactly what you'd save vs Clover"
        sub="A free 15-minute call, a clear quote, and the real dollar difference — no pressure, no jargon."
      />

      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by Clover or Fiserv. Clover is a trademark of its owner. Because Clover is sold through many resellers, pricing and terms vary widely &mdash; confirm your own agreement before switching.
      </LandingDisclaimer>
    </>
  );
}
