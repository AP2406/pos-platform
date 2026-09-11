import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { PaymentsComingSoon } from "../ui";
import { LandingHero, LandingSection, LandingPoints, LandingGuides, LandingCTA } from "../local-landing";

// Promoted into the top nav alongside /pos-for-restaurants. Two claims came off
// beyond the payments copy: BARCODE SCANNING (inventory exists in
// app/app/inventory; a scan path does not, so "scan to ring up and receive
// stock" was describing something we could not demo) and APPOINTMENTS (no
// module — app/app/reservations is dining-room covers and a waitlist).
export const metadata: Metadata = {
  title: { absolute: "POS for Retail (GTA) — Free Point of Sale & Inventory | Surge" },
  description: "A retail point-of-sale for GTA shops: fast checkout, stock counts, purchasing, receipts and reports, with staff roles and a time clock. Free Basic tier, runs on the device you already have. Book a free demo.",
  alternates: { canonical: "/pos-for-retail" },
  openGraph: { ...OG_BASE, url: "/pos-for-retail" },
};

const points = [
  { title: "Stock that moves as you sell", body: "Counts come down off the register itself, so the number on the screen is the number on the shelf." },
  { title: "Purchasing and cost", body: "Receive deliveries, track what an item cost you, and record waste — not just what rang through the till." },
  { title: "Fast, flexible checkout", body: "Discounts, returns, voids and split tender, each with a reason logged against the staff member who did it." },
  { title: "Reports that help", body: "Best sellers, busiest hours and daily totals, without doing the math by hand." },
];

const service = localService({
  name: "Retail point of sale",
  description: "A retail point-of-sale for GTA shops — checkout, stock counts, purchasing, receipts, staff roles and reporting, with a free Basic tier.",
  areaServed: ["Greater Toronto Area", "Toronto", "Mississauga", "Durham Region", "Markham", "Vaughan"],
  path: "/pos-for-retail",
});

export default function PosForRetailPage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("POS for retail", "/pos-for-retail")} />

      <LandingHero
        eyebrow="For retail"
        h1={<>A retail POS that keeps your <span className="text-blue-600">shelves honest</span>.</>}
        intro="Boutiques, grocers, convenience and specialty shops across the GTA run Surge: fast checkout, stock that stays honest and reports you will actually open — free to start, on the device you already own."
      />

      <LandingSection title="Inventory that keeps up with the floor">
        <p>Retail lives and dies on stock. In Surge the counts come off the register itself, so what sold is already subtracted by the time you cash out. Receive deliveries against a purchase record, see your best and worst sellers, and stop reordering from memory &mdash; all on the tablet or terminal you already have.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="Free tier, no bill to start" tint>
        <p>Most retail systems charge a monthly software fee before you have sold anything. Surge&rsquo;s Basic tier is <strong>free</strong> and is a real register, not a trial. Advanced adds staff roles and scheduling, the time clock, the ordering channels and deeper reporting for a flat monthly fee &mdash; and there is no lock-in either way.</p>
      </LandingSection>

      <LandingSection title="Grows with your shop">
        <p>Add registers and a second location as you grow, all reporting to one dashboard. Compare the tiers on the <Link href="/pricing" className="font-semibold text-blue-600 hover:text-blue-700">pricing page</Link>, or see the full <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> feature set.</p>
      </LandingSection>

      <LandingSection title="What about taking the card?" tint>
        <p>Surge does not process your cards yet. Keep whatever you use now &mdash; the till records the sale either way.</p>
        <div className="mt-6"><PaymentsComingSoon /></div>
      </LandingSection>

      <LandingGuides slugs={["lower-credit-card-processing-fees-ontario", "what-is-a-junk-fee-on-a-merchant-account"]} />

      <LandingCTA
        heading="See it running your shop"
        sub="A free 15-minute demo with your own products loaded, walking through checkout and stock. No pressure."
      />
    </>
  );
}
