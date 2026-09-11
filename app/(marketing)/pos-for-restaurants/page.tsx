import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingGuides, LandingCTA } from "../local-landing";

// Already POS-first, so this page was promoted rather than rewritten: it moves
// into the top nav and up the sitemap. The edits are the payments claims —
// "built into your payments", the 2.5% + 15¢ paragraph, and a CTA that sold a
// savings call rather than a demo.
export const metadata: Metadata = {
  title: { absolute: "POS for Restaurants (GTA) — Free Point of Sale | Surge" },
  description: "A restaurant point-of-sale for GTA cafes, quick-serve and full-service: tabs, tips, table service, coursing, a kitchen display, reservations and online ordering. Free Basic tier. Book a free demo.",
  alternates: { canonical: "/pos-for-restaurants" },
  openGraph: { ...OG_BASE, url: "/pos-for-restaurants" },
};

const points = [
  { title: "Tabs, tips and fast tender", body: "Open a tab, split the cheque, add a tip, and close out in seconds — through the rush, not around it." },
  { title: "Table service", body: "Map your floor, fire by seat and course, and hand a table off between servers without losing the order." },
  { title: "Kitchen display", body: "Send tickets straight to the line. No handwriting, no missed modifiers, no lost dupes on a busy Friday." },
  { title: "Menu that keeps up", body: "86 an item once and it clears everywhere. Track ingredient stock and see what actually sells." },
  { title: "Reservations and waitlist", body: "Take bookings for the room and work the waitlist from the same screen the floor already uses." },
  { title: "Orders from everywhere", body: "Online ordering, a QR code on the table and a self-serve kiosk, all landing in the one ticket queue." },
];

const service = localService({
  name: "Restaurant point of sale",
  description: "A full restaurant point-of-sale for GTA cafes, quick-serve and full-service — tabs, tips, table service, coursing, a kitchen display, reservations and online ordering.",
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
        intro="Cafés, quick-serve and full-service across the GTA run Surge: tabs, tips, table service, coursing and a kitchen display, with a free Basic tier to start."
      />

      <LandingSection title="Built for the floor and the line">
        <p>Most restaurant systems make you buy the floor and the pass separately &mdash; a till here, a kitchen screen there, a booking tool that emails you. Surge is one system: the Basic tier is a free register, and Advanced adds the floor plan, the kitchen display, reservations, the schedule and the ordering channels for a flat monthly fee with no term contract.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="From counter to kitchen" tint>
        <p>Ring an order at the front and it&rsquo;s on the kitchen display before the server turns around. Coursing, seat numbers, forced modifiers and all-day counts are handled, so the line cooks what was ordered — not what they could read off a ticket. When it&rsquo;s slow, the same screen runs a quick-serve counter just as happily.</p>
        <p>Everything reports back to one dashboard: sales by server, voids and comps with reasons, tips, and labour against sales — the numbers you actually use to run the room.</p>
      </LandingSection>

      <LandingSection title="One system, whether you have one register or five">
        <p>Add registers, stations and a second location as you grow, all on the same account. See what each tier includes on <Link href="/pricing" className="font-semibold text-blue-600 hover:text-blue-700">pricing</Link>, or read the full <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> feature set.</p>
      </LandingSection>

      <LandingSection title="What about taking the card?" tint>
        <p>Surge does not process your cards yet. Keep the merchant account you have &mdash; the register records the sale regardless, and ours becomes one more tender type when it is ready.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
      </LandingSection>

      <LandingGuides slugs={["lower-credit-card-processing-fees-ontario", "flat-rate-vs-interchange-plus-pricing"]} />

      <LandingCTA
        heading="See it running your restaurant"
        sub="A free 15-minute demo on your own menu, with your floor drawn and a ticket sent to the pass."
      />
    </>
  );
}
