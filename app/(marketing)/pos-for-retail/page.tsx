import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { LandingHero, LandingSection, LandingPoints, LandingGuides, LandingCTA } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "POS for Retail (GTA) — Free Point of Sale & Inventory | Surge" },
  description: "A retail point-of-sale built into your payments: barcode inventory, stock counts, low-stock alerts, receipts and reports. Free Basic POS, lower card rates. Book a free call.",
  alternates: { canonical: "/pos-for-retail" },
  openGraph: { ...OG_BASE, url: "/pos-for-retail" },
};

const points = [
  { title: "Barcode inventory", body: "Scan to ring up and to receive stock. Counts stay honest without a spreadsheet." },
  { title: "Low-stock alerts", body: "Know what's running out before your shelf does, and see what actually sells." },
  { title: "Fast, flexible checkout", body: "Tap, chip, swipe, Apple Pay, Google Pay and Interac — with tips, discounts and returns built in." },
  { title: "Reports that help", body: "Best sellers, busiest hours and daily totals, without doing the math by hand." },
];

const service = localService({
  name: "Retail point of sale",
  description: "A retail point-of-sale for GTA shops — barcode inventory, stock counts, low-stock alerts, receipts and reporting, built into lower-rate payments with a free Basic tier.",
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
        intro="Boutiques, grocers, convenience and specialty shops across the GTA run Surge: barcode inventory, fast checkout and real reports — built into payments at one clear rate, free to start."
      />

      <LandingSection title="Inventory that keeps up with the floor">
        <p>Retail lives and dies on stock. Surge POS scans a barcode to ring a sale and to receive a delivery, so your counts stay accurate as the day moves. Set low-stock alerts, see your best and worst sellers, and stop guessing what to reorder &mdash; all on the tablet or terminal you already have.</p>
        <LandingPoints items={points} />
      </LandingSection>

      <LandingSection title="Payments and software, one bill (well, no bill)" tint>
        <p>Most retail POS systems charge a monthly software fee and then mark up your card rate on top. Surge includes the point-of-sale with your payments: the Basic tier is <strong>free</strong>, the rate is a clear <strong>2.5% + 15¢</strong> in person, and there&rsquo;s no lock-in. Need appointments, staff roles and deeper analytics? The Advanced tier adds them &mdash; and you can try it free first.</p>
      </LandingSection>

      <LandingSection title="Grows with your shop">
        <p>Add registers and a second location as you grow, all reporting to one dashboard on the same rate. Compare the numbers on the <Link href="/pricing" className="font-semibold text-blue-600 hover:text-blue-700">pricing page</Link>, or see the full <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">point-of-sale</Link> feature set.</p>
      </LandingSection>

      <LandingGuides slugs={["lower-credit-card-processing-fees-ontario", "what-is-a-junk-fee-on-a-merchant-account"]} />

      <LandingCTA
        heading="See the POS on your own inventory"
        sub="A free 15-minute call, a clear quote, and a walkthrough of checkout and stock on your actual products. No pressure."
      />
    </>
  );
}
