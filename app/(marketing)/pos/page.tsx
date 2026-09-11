import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb } from "../jsonld";
import { Crumb, btnPrimary, btnOutline, CtaBand, PaymentsComingSoon } from "../ui";

// THE FLAGSHIP PAGE. Every feature named below was checked against a real
// screen in the product before it was written here, and the file each one lives
// in is noted beside it. Two things the page used to claim are gone because no
// code backs them: "appointments & bookings" (app/app/reservations is covers
// and a waitlist for a dining room, which is not chair-booking) and barcode
// scanning (inventory exists; a scan path does not). "Every way they pay" is
// gone too — that is the payments claim, and it now lives in the coming-soon
// band at the bottom of the page in future tense.
export const metadata: Metadata = {
  title: { absolute: "POS System for Restaurants, Cafes & Retail (GTA) | Surge" },
  description: "Surge POS: register, floor plan and table service, kitchen display, menu builder, online and QR ordering, kiosk, inventory, staff and time clock, and reports. Free Basic tier, runs on the device you already have.",
  alternates: { canonical: "/pos" },
  openGraph: { ...OG_BASE, url: "/pos" },
};

function Icon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    cart: (<><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>),
    floor: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
    kitchen: (<><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h6" /></>),
    menu: (<><path d="M4 6h16M4 12h16M4 18h10" /></>),
    box: (<><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>),
    receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6" /><path d="M9 12h6" /></>),
    chart: (<><path d="M5 20V11" /><path d="M12 20V5" /><path d="M19 20v-6" /></>),
    refund: (<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>),
    people: (<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17 20a6 6 0 0 0-1.5-4" /></>),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
  );
}

// icon / title / body — and the route in the product that makes each true.
const features = [
  { icon: "cart", title: "A register that keeps up", body: "Ring up, modify, discount, split the tender, add a tip and close out. Voids and item-level refunds take a couple of taps and log a reason." }, // app/app/pos
  { icon: "floor", title: "Floor plan and table service", body: "Draw your room, open and move tables, fire by seat and course, and transfer a table between servers without losing the order." }, // app/app/floor, app/app/pos/floor-client.tsx
  { icon: "kitchen", title: "Kitchen display", body: "Tickets go straight to the line and route to the station that cooks them, so nothing depends on handwriting or a spike of paper dupes." }, // app/app/kitchen
  { icon: "menu", title: "Menu builder", body: "Items, modifiers, prices and availability in one place. 86 something once and it clears every register, screen and online menu at the same time." }, // app/app/catalog
  { icon: "box", title: "Inventory and cost", body: "Stock counts, purchasing, recipes and waste, so you can see what a dish costs you rather than only what it sold for." }, // app/app/inventory, purchasing, recipes, waste
  { icon: "people", title: "Staff, roles and time clock", body: "Owner, manager and custom roles with real permissions, plus scheduling, clock-in, attendance and labour measured against sales." }, // app/app/staff, schedule, clock, attendance, labor
  { icon: "receipt", title: "Receipts and reservations", body: "Print or email a receipt as the sale closes; take bookings for the dining room and run a waitlist from the same system." }, // app/app/reservations
  { icon: "chart", title: "Reports you will actually open", body: "Daily totals, best sellers, busiest hours, and exports for whoever does the books." }, // app/app/reports, exports
  { icon: "refund", title: "Oversight built in", body: "Approvals and exceptions queues for the manager, and an audit trail behind the things that move money." }, // app/app/approvals, exceptions, audit
];

// Every channel below is a real route under app/. Named rather than hand-waved
// as "omnichannel" because a restaurant owner wants to know which screens exist.
const channels = [
  { title: "Online ordering", body: "Your own menu page, taking orders straight into the ticket queue." }, // app/order/[businessId]
  { title: "QR ordering and pay at table", body: "A code on the table opens the menu and the guest's own check on their phone." }, // app/order/[businessId]/[elementId], app/app/floor/qr-codes
  { title: "Self-serve kiosk", body: "A counter kiosk for the rush, ordering from the same menu as the register." }, // app/kiosk/[businessId]
  { title: "Menu board and customer display", body: "A screen for the wall and a screen facing the guest, both fed by the menu you already built." }, // app/menu/[businessId], app/cfd/[businessId]
];

const gallery = [
  { src: "/jpg16.png", alt: "A cafe owner working an order on a Surge POS tablet", caption: "Cafes & quick-serve" },
  { src: "/jpg17.png", alt: "A shop owner checking stock at a Surge POS terminal", caption: "Retail & service counters" },
];

const advanced = [
  { title: "More than one register", body: "Add tills and stations as you grow; they all report back to one dashboard." },
  { title: "More than one location", body: "A roll-up view across sites, with the menu pushed out from one place." },
  { title: "Your numbers, your way", body: "Exports and integrations for the accountant, the bookkeeper or the spreadsheet you refuse to give up." },
];

// SoftwareApplication, not Product. The old markup described this as a Product
// with a priced Offer, which reads as physical goods; what we ship is software,
// and applicationCategory is the field Google's docs want for it. The Offer is
// kept because a free tier is a real, published offer — but it carries no rate
// and no payment-processing language.
const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Surge POS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  description:
    "A point-of-sale system for restaurants, cafes and retail — register, floor plan and table service, kitchen display, menu builder, online and QR ordering, kiosk, inventory, staff and time clock, and reporting.",
  brand: { "@type": "Brand", name: "Surge" },
  offers: {
    "@type": "Offer",
    priceCurrency: "CAD",
    price: "0",
    availability: "https://schema.org/InStock",
    description: "Free Basic tier; Advanced tier available.",
    url: "https://www.surgetechpos.com/pos",
  },
};

export default function PosPage() {
  return (
    <>
      <JsonLd data={softwareSchema} />
      <JsonLd data={breadcrumb("Point of Sale", "/pos")} />

      <section className="border-b border-[#D9E1EA] bg-[#F4F7FA]">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-40">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Crumb>Point of sale</Crumb>
              <h1 className="mt-4 text-[44px] font-bold leading-[1.12] tracking-[-0.015em] text-[#0A2540] sm:text-[50px]">A full register, and everything behind it.</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#42566B]">Floor plan, kitchen display, menu builder, online and QR ordering, inventory, staff and reports &mdash; one system, on the device you already have, free to start.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/book" className={btnPrimary}>Book a free demo</Link>
                <Link href="/pricing" className={btnOutline}>See pricing</Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-[#D9E1EA] bg-white shadow-[0_10px_30px_-18px_rgba(10,37,64,0.35)]">
              <div className="relative aspect-[4/3] w-full">
                <Image src="/jpg18.png" alt="A bar owner working a ticket on a Surge POS tablet" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>What it does</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Everything the room needs, in one place</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">The basics done properly, and then the parts most tills make you buy separately.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-md border border-[#D9E1EA] border-t-[3px] border-t-[#0A2540] p-7">
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[4px] border border-[#D9E1EA] bg-[#F4F7FA] text-[#0A2540]"><Icon name={f.icon} className="h-5 w-5" /></div>
                <h3 className="mt-4 text-lg font-bold text-[#0A2540]">{f.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>Order channels</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Four more ways an order gets in</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">All of them feed the same ticket queue your staff already work from, so nothing gets re-keyed on the pass.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {channels.map((c) => (
              <div key={c.title} className="rounded-md border border-[#D9E1EA] bg-white p-7">
                <h3 className="text-lg font-bold text-[#0A2540]">{c.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
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

      <section className="border-t border-[#D9E1EA] bg-[#F4F7FA] py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-center gap-8 rounded-md border border-[#D9E1EA] bg-white p-8 md:grid-cols-3 md:p-10">
            <div className="md:col-span-2">
              <Crumb>No new hardware</Crumb>
              <h2 className="mt-3 text-2xl font-bold tracking-[-0.01em] text-[#0A2540] sm:text-3xl">Runs on the tablet or phone you already own</h2>
              {/* Was "Want a dedicated terminal or a thermal receipt printer?
                  We can supply those too" — we do not sell hardware, so the
                  offer to supply it is gone. Setting up the devices a shop
                  already has is a service we can actually do. */}
              <p className="mt-3 leading-relaxed text-[#42566B]">Bring the devices you have and we will get them set up with you in person across the GTA &mdash; menu loaded, floor drawn, staff shown around.</p>
            </div>
            <div className="flex flex-wrap gap-2.5 md:justify-end">
              {["Tablet", "Phone", "Kitchen screen", "Menu board"].map((h) => (<span key={h} className="rounded-[4px] border border-[#D9E1EA] px-3.5 py-1.5 text-[13px] font-semibold text-[#42566B]">{h}</span>))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#D9E1EA] bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>As you grow</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Ready when you outgrow one till</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">The system does not change shape when a second register or a second address turns up.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {advanced.map((a) => (
              <div key={a.title} className="rounded-md border border-[#D9E1EA] p-7">
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

      <section id="payments" className="border-t border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-8 text-center">
            <Crumb>Payments</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Taking the card is the one part we have not shipped</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">Keep the processor you have. The register records the sale either way, and ours slots in later without changing how anyone works.</p>
          </div>
          <PaymentsComingSoon />
        </div>
      </section>

      <CtaBand title="See the POS in action." sub="Book a free 15-minute demo and we will set it up around how your shop actually runs." cta="Book my free demo" />
    </>
  );
}
