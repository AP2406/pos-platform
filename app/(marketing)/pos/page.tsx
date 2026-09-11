import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb } from "../jsonld";
import { Crumb, btnPrimary, btnOutline, CtaBand } from "../ui";

export const metadata: Metadata = {
  title: { absolute: "Free POS System for Small Business (GTA) | Surge" },
  description: "A full point-of-sale built into your payments. Fast checkout, every payment type, inventory, receipts, reports and refunds. Free Basic POS, runs on the device you already have.",
  alternates: { canonical: "/pos" },
  openGraph: { ...OG_BASE, url: "/pos" },
};

function Icon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    cart: (<><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>),
    card: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>),
    box: (<><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>),
    receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6" /><path d="M9 12h6" /></>),
    chart: (<><path d="M5 20V11" /><path d="M12 20V5" /><path d="M19 20v-6" /></>),
    refund: (<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
  );
}

const features = [
  { icon: "cart", title: "Lightning-fast checkout", body: "Ring up a sale in seconds, split the tender, add a tip, and keep the line moving." },
  { icon: "card", title: "Every way they pay", body: "Tap, chip, swipe, Apple Pay, Google Pay, Interac, Visa and Mastercard &mdash; all built in." },
  { icon: "box", title: "Inventory that keeps up", body: "Track stock, set low-stock alerts, and scan barcodes so counts stay honest." },
  { icon: "receipt", title: "Receipts your way", body: "Print on an 80mm thermal printer or email a receipt the moment a sale closes." },
  { icon: "chart", title: "Reports that help", body: "See your best sellers, busiest hours and daily totals without doing the math." },
  { icon: "refund", title: "Returns without the headache", body: "Item-level refunds and voids in a couple of taps, with reasons logged for you." },
];

const gallery = [
  { src: "/jpg16.png", alt: "A cafe owner taking an order on the phone beside a Surge POS tablet", caption: "Cafes & quick-serve" },
  { src: "/jpg17.png", alt: "A shop owner checking stock at a Surge POS terminal", caption: "Retail & service counters" },
];

const advanced = [
  { title: "Appointments & bookings", body: "Take bookings for chairs, rooms and services, then check clients out at the same screen." },
  { title: "Staff roles & permissions", body: "Owner, manager and custom roles, with reason codes on refunds, voids and discounts." },
  { title: "Built to scale", body: "Add registers and locations as you grow, all reporting back to one clean dashboard." },
];

const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Surge POS",
  description:
    "A full point-of-sale built into your payments — fast checkout, every payment type, inventory, receipts, reports and item-level refunds. Free Basic POS on the device you already have.",
  brand: { "@type": "Brand", name: "Surge" },
  category: "Point of sale software",
  offers: {
    "@type": "Offer",
    priceCurrency: "CAD",
    price: "0",
    availability: "https://schema.org/InStock",
    description: "Free Basic POS included with Surge payments; Advanced tier available.",
    url: "https://www.surgetechpos.com/pos",
  },
};

export default function PosPage() {
  return (
    <>
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumb("Point of Sale", "/pos")} />

      <section className="border-b border-[#D9E1EA] bg-[#F4F7FA]">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-40">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Crumb>Point of sale</Crumb>
              <h1 className="mt-4 text-[44px] font-bold leading-[1.12] tracking-[-0.015em] text-[#0A2540] sm:text-[50px]">A full register, built into your payments.</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#42566B]">No separate POS bill, no clunky add-on. Surge runs your whole counter on the device you already have &mdash; and it is free to start.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/book" className={btnPrimary}>Book a free demo</Link>
                <Link href="/pricing" className={btnOutline}>See pricing</Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-[#D9E1EA] bg-white shadow-[0_10px_30px_-18px_rgba(10,37,64,0.35)]">
              <div className="relative aspect-[4/3] w-full">
                <Image src="/jpg18.png" alt="A bar owner taking a card payment on a Surge POS tablet" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>What it does</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Everything the counter needs, in one place</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">The basics done right, so you can run the shop instead of fighting the till.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-md border border-[#D9E1EA] border-t-[3px] border-t-[#0A2540] p-7">
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[4px] border border-[#D9E1EA] bg-[#F4F7FA] text-[#0A2540]"><Icon name={f.icon} className="h-5 w-5" /></div>
                <h3 className="mt-4 text-lg font-bold text-[#0A2540]">{f.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]" dangerouslySetInnerHTML={{ __html: f.body }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>Real counters</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Built for every kind of counter</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">From the morning rush to last call, Surge runs the real-world spots across the GTA.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {gallery.map((g) => (
              <figure key={g.src} className="overflow-hidden rounded-md border border-[#D9E1EA] bg-white">
                <div className="relative aspect-[4/3]">
                  <Image src={g.src} alt={g.alt} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                </div>
                <figcaption className="px-5 py-4 font-bold text-[#0A2540]">{g.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-center gap-8 rounded-md border border-[#D9E1EA] p-8 md:grid-cols-3 md:p-10">
            <div className="md:col-span-2">
              <Crumb>No new hardware</Crumb>
              <h2 className="mt-3 text-2xl font-bold tracking-[-0.01em] text-[#0A2540] sm:text-3xl">Runs on the tablet or phone you already own</h2>
              <p className="mt-3 leading-relaxed text-[#42566B]">Want a dedicated terminal or a thermal receipt printer? We can supply those too &mdash; and we set everything up with you in person across the GTA.</p>
            </div>
            <div className="flex flex-wrap gap-2.5 md:justify-end">
              {["Tablet", "Phone", "Card terminal", "Thermal printer"].map((h) => (<span key={h} className="rounded-[4px] border border-[#D9E1EA] px-3.5 py-1.5 text-[13px] font-semibold text-[#42566B]">{h}</span>))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>Advanced</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Ready when you outgrow the basics</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">On the Advanced plan &mdash; free to try for 30 days &mdash; the POS grows with the business.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {advanced.map((a) => (
              <div key={a.title} className="rounded-md border border-[#D9E1EA] bg-white p-7">
                <h3 className="text-lg font-bold text-[#0A2540]">{a.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]">{a.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/pricing" className={"inline-flex " + btnOutline}>Compare Basic and Advanced</Link>
          </div>
        </div>
      </section>

      <CtaBand title="See the POS in action." sub="Book a free 15-minute demo and we will set it up around how your shop actually runs." cta="Book my free demo" />
    </>
  );
}
