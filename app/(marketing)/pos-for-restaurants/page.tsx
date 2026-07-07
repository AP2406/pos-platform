import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { LandingHero, LandingSection, LandingPoints, LandingCTA } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "POS for Restaurants (GTA) — Free Point of Sale | Surge" },
  description: "A restaurant point-of-sale built into your payments: tabs, tips, table service, and a kitchen display. Free Basic POS, lower card rates, no lock-in. Book a free call.",
  alternates: { canonical: "/pos-for-restaurants" },
  openGraph: { ...OG_BASE, url: "/pos-for-restaurants" },
};

const points = [
  { title: "Tabs, tips and fast tender", body: "Open a tab, split the cheque, add a tip, and close out in seconds — through the rush, not around it." },
  { title: "Table service", body: "Map your floor, fire by seat and course, and hand a table off between servers without losing the order." },
  { title: "Kitchen display", body: "Send tickets straight to the line. No handwriting, no missed modifiers, no lost dupes on a busy Friday." },
  { title: "Menu that keeps up", body: "86 an item once and it clears everywhere. Track ingredient stock and see what actually sells." },
];

const service = localService({
  name: "Restaurant point of sale",
  description: "A full restaurant point-of-sale for GTA cafes, quick-serve and full-service — tabs, tips, table service, coursing and a kitchen display, built into lower-rate payments.",
  areaServed: ["Greater Toronto Area", "Toronto", "Durham Region", "Mississauga", "Markham", "Vaughan"],
  path: "/pos-for-restaurants",
});

export default function PosForRestaurantsPage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("POS for restaurants", "/pos-for-restaurants")} />

      <LandingHero
        eyebrow="For restaurants"
        h1={<>A restaurant POS that keeps up with the <span className="text-blue-600">rush</span>.</>}
        intro="Cafés, quick-serve and full-service across the GTA run Surge: tabs, tips, table service and a kitchen display — built into payments at one honest rate, with a free Basic tier to start."
      />

      <LandingSection title="Built for the floor and the line">
        <p>Most restaurant POS systems charge a fat monthly fee for the software and then quietly mark up your card rate on top. Surge flips that: the point-of-sale is <strong>included</strong> with your payments, the Basic tier is free, and the rate is the same clear <strong>2.5% + 15¢</strong> in person — no separate POS bill, no lock-in.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="From counter to kitchen" tint>
        <p>Ring an order at the front and it&rsquo;s on the kitchen display before the server turns around. Coursing, seat numbers, forced modifiers and all-day counts are handled, so the line cooks what was ordered — not what they could read off a ticket. When it&rsquo;s slow, the same screen runs a quick-serve counter just as happily.</p>
        <p>Everything reports back to one dashboard: sales by server, voids and comps with reasons, tips, and labour against sales — the numbers you actually use to run the room.</p>
      </LandingSection>

      <LandingSection title="One rate, whether you have one register or five">
        <p>Add registers, handhelds and a second location as you grow, all on the same account and the same rate. Curious what it costs versus what you pay now? Start with <Link href="/pricing" className="font-semibold text-blue-600 hover:text-blue-700">pricing</Link>, or see the full <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> feature set.</p>
      </LandingSection>

      <LandingCTA
        heading="See your restaurant's real card cost"
        sub="A free 15-minute call, a clear quote, and the exact dollar amount you'd save — plus a walkthrough of the POS on your own menu."
      />
    </>
  );
}
