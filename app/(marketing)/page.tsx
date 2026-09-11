import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Reveal } from "./reveal";
import { OG_BASE } from "./shared-metadata";
import { Crumb, Tick, ComingSoonBadge, PaymentsComingSoon, btnPrimary, btnOutline } from "./ui";

// THE PAGE NOW LEADS WITH THE PRODUCT WE SHIP.
//
// It used to open "Stop overpaying to get paid." with a savings calculator
// beside it — a payments pitch, for a rail we are not live on. The restaurant
// owner who lands here has to understand in one screen that this is a
// point-of-sale system; the processing story is a labelled "coming soon" band
// further down, not the headline and not a number.
//
// Section order, and why: register first (what it is) → what it replaces
// (the stack of subscriptions) → the rooms it runs (floor, kitchen, counter)
// → guests (online/QR/kiosk) → back office → payments, coming soon → CTA.
// Payments sit after the product is understood and before the ask, which is
// where a caveat belongs: late enough not to be the pitch, early enough that
// nobody books a demo without having read it.
export const metadata: Metadata = {
  title: { absolute: "Point of Sale for Restaurants & Retail in the GTA | Surge" },
  description: "Surge is a point-of-sale system for GTA restaurants, cafes and shops — register, floor plan, kitchen display, online and QR ordering, inventory, staff and reports. Card processing coming soon. Book a free demo.",
  alternates: { canonical: "/" },
  openGraph: { ...OG_BASE, title: "Point of Sale for Restaurants & Retail in the GTA | Surge", description: "A point-of-sale system for GTA restaurants, cafes and shops — register, floor plan, kitchen display, online and QR ordering, inventory, staff and reports.", url: "/" },
};

// Every item here is a screen that exists in the product. Verified in
// app/app/pos, app/app/floor, app/app/kitchen, app/app/catalog, app/app/orders,
// app/app/inventory, app/app/staff + schedule + clock, app/app/reports,
// app/app/reservations and app/order/[businessId]. Nothing aspirational.
const rooms = [
  {
    title: "The floor",
    body: "Map your room, open a table, fire by seat and course, split a cheque, and hand a table between servers without losing the order.",
    href: "/pos-for-restaurants",
    linkText: "POS for restaurants",
  },
  {
    title: "The line",
    body: "Tickets land on the kitchen display the moment they are sent, routed to the station that cooks them. No handwriting, no lost dupes.",
    href: "/pos-for-restaurants",
    linkText: "See the kitchen display",
  },
  {
    title: "The counter",
    body: "Ring up, apply a discount, take a return, print or email the receipt. Stock moves as you sell, so counts stay honest.",
    href: "/pos-for-retail",
    linkText: "POS for retail",
  },
];

const guestWays = [
  "Online ordering from your own menu page",
  "QR ordering and pay-at-table",
  "Self-serve kiosk",
  "Customer-facing display and digital menu board",
];

const backOffice = [
  { title: "Menu and catalog", body: "Build the menu once — items, modifiers, prices, availability. 86 something and it clears every screen at the same time." },
  { title: "Inventory and cost", body: "Stock counts, purchasing, recipes and waste, so you can see what a plate costs you and not just what it sells for." },
  { title: "Staff and time clock", body: "Roles and permissions, scheduling, clock-in, attendance and a labour view against sales." },
  { title: "Reports", body: "Daily totals, best sellers, busiest hours, and exports for whoever does your books." },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-[#D9E1EA] bg-[#F4F7FA]">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-40">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Crumb>Point of sale</Crumb>
              <h1 className="mt-4 text-[44px] font-bold leading-[1.12] tracking-[-0.015em] text-[#0A2540] sm:text-[50px]">The till that runs the whole room.</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#42566B]">Surge is a point-of-sale system for restaurants, cafes and shops across the GTA &mdash; register, floor plan, kitchen display, online and QR ordering, inventory, staff and reports, in one place.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/book" className={btnPrimary}>Book a free demo</Link>
                <Link href="/pos" className={btnOutline}>See the point of sale</Link>
              </div>
              <div className="mt-8 grid gap-2.5">
                <div className="flex items-center gap-2.5 text-[15px] font-semibold text-[#1A2B3C]"><Tick />Runs on the tablet you already own</div>
                <div className="flex items-center gap-2.5 text-[15px] font-semibold text-[#1A2B3C]"><Tick />Floor, kitchen and counter on one system</div>
                <div className="flex items-center gap-2.5 text-[15px] font-semibold text-[#1A2B3C]"><Tick />Set up with you in person across the GTA</div>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-[#D9E1EA] bg-white shadow-[0_10px_30px_-18px_rgba(10,37,64,0.35)]">
              <div className="relative aspect-[4/3] w-full">
                <Image src="/jpg18.png" alt="A bar owner taking an order on a Surge point-of-sale tablet" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
              {/* This strip used to read "Your rate with Surge — 2.5% + 15¢".
                  A rate badge in the hero was the site's loudest payments
                  claim; it is now the coming-soon note, in the same slot. */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D9E1EA] px-5 py-3.5">
                <span className="text-xs font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Card processing</span>
                <ComingSoonBadge />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#D9E1EA] bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <Crumb>What it replaces</Crumb>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">One system instead of five subscriptions</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">Most independents end up with a till, a separate kitchen screen, a booking tool, a spreadsheet for stock and another for the schedule. Surge is all of it, and the pieces already know about each other.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {rooms.map((r) => (
                <div key={r.title} className="rounded-md border border-[#D9E1EA] border-t-[3px] border-t-[#0A2540] p-7">
                  <h3 className="text-lg font-bold text-[#0A2540]">{r.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]">{r.body}</p>
                  <Link href={r.href} className="mt-4 inline-block text-[14.5px] font-bold text-[#1B6DC1] hover:underline">{r.linkText} &rarr;</Link>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Crumb>Guests order themselves</Crumb>
                <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Four more ways an order gets in</h2>
                <p className="mt-4 leading-relaxed text-[#42566B]">Every one of these lands in the same ticket queue your servers use, so nobody is re-keying an order from a tablet on the pass.</p>
                <div className="mt-6 grid gap-3">
                  {guestWays.map((g) => (
                    <div key={g} className="flex items-start gap-2.5 text-[15px] font-medium text-[#42566B]"><Tick />{g}</div>
                  ))}
                </div>
                <Link href="/pos" className="mt-7 inline-block text-[15px] font-bold text-[#1B6DC1] hover:underline">Explore the point of sale &rarr;</Link>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-[#D9E1EA]">
                <Image src="/jpg16.png" alt="A cafe owner checking an incoming order on a Surge POS tablet" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-[#D9E1EA] bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <Crumb>After close</Crumb>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">The back office is part of the till</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">Because the register already knows what sold, the rest of the paperwork mostly fills itself in.</p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {backOffice.map((b) => (
                <div key={b.title} className="rounded-md border border-[#D9E1EA] p-7">
                  <h3 className="text-lg font-bold text-[#0A2540]">{b.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]">{b.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-[#D9E1EA] bg-white pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <Crumb>Industries served</Crumb>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Built for businesses like yours</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">From the counter to the pass, Surge runs real-world rooms across the GTA.</p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              <figure className="overflow-hidden rounded-md border border-[#D9E1EA]">
                <div className="relative aspect-[16/10]"><Image src="/jpg9.jpg" alt="A busy local coffee shop counter at the morning rush" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>
                <figcaption className="px-5 py-4"><div className="font-bold text-[#0A2540]">Cafes &amp; quick-serve</div><div className="mt-1 text-sm leading-relaxed text-[#42566B]">Fast tickets, modifiers that stick, a line that keeps moving.</div></figcaption>
              </figure>
              <figure className="overflow-hidden rounded-md border border-[#D9E1EA]">
                <div className="relative aspect-[16/10]"><Image src="/jpg17.png" alt="A shop owner checking stock levels at a Surge POS terminal" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>
                <figcaption className="px-5 py-4"><div className="font-bold text-[#0A2540]">Retail &amp; service counters</div><div className="mt-1 text-sm leading-relaxed text-[#42566B]">Stock, receipts and reports on the device you already own.</div></figcaption>
              </figure>
              <figure className="overflow-hidden rounded-md border border-[#D9E1EA]">
                <div className="relative aspect-[16/10]"><Image src="/jpg3.jpg" alt="A stylist checking a client out at a salon front desk" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>
                <figcaption className="px-5 py-4"><div className="font-bold text-[#0A2540]">Salons &amp; service shops</div><div className="mt-1 text-sm leading-relaxed text-[#42566B]">Tips, split tender and a register your staff can be trusted with.</div></figcaption>
              </figure>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="payments" className="border-b border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="grid items-start gap-12 lg:grid-cols-2">
              <div>
                <Crumb>Payments</Crumb>
                <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">We are not your processor yet</h2>
                <p className="mt-4 leading-relaxed text-[#42566B]">Surge is the point of sale. Card processing and terminals are being built, and we would rather say so here than let you find out on the call.</p>
                <p className="mt-3 leading-relaxed text-[#42566B]">Nothing about that blocks you. The POS runs the room today alongside whatever processor you already use, and when ours is live it becomes one more tender type on a register your staff already know.</p>
              </div>
              <PaymentsComingSoon />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#0A2540] py-20 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="max-w-xl text-[32px] font-bold leading-[1.18] tracking-[-0.01em] sm:text-[34px]">See it running your room.</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-[#B9C8D8]">A free 15-minute demo, set up around your actual menu and floor &mdash; not a generic slideshow.</p>
          </div>
          <Link href="/book" className="whitespace-nowrap rounded-[4px] bg-white px-7 py-3.5 text-[15.5px] font-bold text-[#0A2540] transition-colors hover:bg-[#F4F7FA]">Book my free demo</Link>
        </div>
      </section>
    </>
  );
}
