import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SavingsEstimator } from "./savings-estimator";
import { Reveal } from "./reveal";
import { OG_BASE } from "./shared-metadata";

export const metadata: Metadata = {
  title: { absolute: "Payment Processing & Point of Sale for the GTA | Surge" },
  description: "Transparent payment processing and point-of-sale software for local GTA businesses — lower card rates, no junk fees, no lock-in. Book a free call.",
  alternates: { canonical: "/" },
  openGraph: { ...OG_BASE, title: "Payment Processing & Point of Sale for the GTA | Surge", description: "Transparent payment processing and point-of-sale software for local business. Lower card rates, no junk fees, no lock-in.", url: "/" },
};

function Crumb({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-bold uppercase tracking-[0.05em] text-[#1B6DC1]">{children}</div>;
}

function Tick() {
  return (
    <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px] bg-[#1E7B4D]">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" className="h-[11px] w-[11px]"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="border-b border-[#D9E1EA] bg-[linear-gradient(180deg,#F4F7FA,#FFFFFF)]">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-40">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Crumb>Payment processing &amp; point of sale</Crumb>
              <h1 className="mt-4 text-[44px] font-bold leading-[1.12] tracking-[-0.015em] text-[#0A2540] sm:text-[50px]">Stop overpaying to get paid.</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#42566B]">Transparent card processing and built-in point-of-sale software for local businesses &mdash; a lower rate, no junk fees, and dedicated human support.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/book" className="rounded-[4px] bg-[#0A2540] px-7 py-3.5 text-[15.5px] font-bold text-white transition-colors hover:bg-[#123456]">Book a free call</Link>
                <Link href="/pricing" className="rounded-[4px] border-[1.5px] border-[#0A2540] px-7 py-3.5 text-center text-[15.5px] font-bold text-[#0A2540] transition-colors hover:bg-[#F4F7FA]">See pricing</Link>
              </div>
              <div className="mt-8 grid gap-2.5">
                <div className="flex items-center gap-2.5 text-[15px] font-semibold text-[#1A2B3C]"><Tick />No junk fees or hidden line items</div>
                <div className="flex items-center gap-2.5 text-[15px] font-semibold text-[#1A2B3C]"><Tick />No lock-in contracts</div>
                <div className="flex items-center gap-2.5 text-[15px] font-semibold text-[#1A2B3C]"><Tick />In-person setup across the GTA</div>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-[#D9E1EA] bg-white shadow-[0_10px_30px_-18px_rgba(10,37,64,0.35)]">
              <div className="relative aspect-[4/3] w-full">
                <Image src="/jpg6.jpg" alt="A local business owner taking a tap card payment at a salon counter" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-[#D9E1EA] px-5 py-3.5">
                <span className="text-xs font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Your rate with Surge</span>
                <span className="text-[15px] font-bold tabular-nums text-[#1E7B4D]">2.5% + 15&cent; &middot; save 0.4% every sale</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#D9E1EA] bg-white py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 md:flex-row">
          <span className="text-[13px] font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Accepted payment methods</span>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {["Tap", "Chip & swipe", "Apple Pay", "Google Pay", "Interac", "Visa", "Mastercard"].map((m) => (
              <span key={m} className="rounded-[4px] border border-[#D9E1EA] px-3.5 py-1.5 text-[13px] font-semibold text-[#42566B]">{m}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Crumb>The fee reality check</Crumb>
                <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">How much are card fees really costing your business?</h2>
                <p className="mt-4 leading-relaxed text-[#42566B]">Most owners have never seen their effective rate written down. Set your monthly volume and average sale, and see the number for yourself.</p>
                <p className="mt-3 text-sm text-[#7A8CA0]">Your exact quote is confirmed from your real statement on a free 15-minute call.</p>
              </div>
              <SavingsEstimator />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <Crumb>Why Surge</Crumb>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Why business owners switch to Surge</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">Three things the large processors structurally can&apos;t provide.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <div className="rounded-md border border-[#D9E1EA] border-t-[3px] border-t-[#0A2540] p-7">
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[4px] border border-[#D9E1EA] bg-[#F4F7FA]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0A2540" strokeWidth="1.8" className="h-5 w-5"><path d="M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" strokeLinecap="round" /></svg>
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#0A2540]">A lower, honest rate</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]">One clear rate, below the major processors. No statement-fee maze, no surprise line items &mdash; you keep more of every sale.</p>
              </div>
              <div className="rounded-md border border-[#D9E1EA] border-t-[3px] border-t-[#0A2540] p-7">
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[4px] border border-[#D9E1EA] bg-[#F4F7FA]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0A2540" strokeWidth="1.8" className="h-5 w-5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" /><circle cx="12" cy="10" r="3" /></svg>
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#0A2540]">Real local support</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]">Based in the GTA. We set up your terminal in person and answer the phone directly &mdash; a person, not a ticket queue.</p>
              </div>
              <div className="rounded-md border border-[#D9E1EA] border-t-[3px] border-t-[#0A2540] p-7">
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[4px] border border-[#D9E1EA] bg-[#F4F7FA]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0A2540" strokeWidth="1.8" className="h-5 w-5"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" strokeLinecap="round" /></svg>
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#0A2540]">Software included</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#42566B]">Point of sale, sales reporting, and inventory insights &mdash; built into your processing, not a costly monthly add-on.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <Crumb>Industries served</Crumb>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Built for businesses like yours</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">From the counter to the chair, Surge runs real-world businesses across the GTA.</p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              <figure className="overflow-hidden rounded-md border border-[#D9E1EA]">
                <div className="relative aspect-[16/10]"><Image src="/jpg9.jpg" alt="A customer paying at the counter of a local coffee shop" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>
                <figcaption className="px-5 py-4"><div className="font-bold text-[#0A2540]">Cafes &amp; coffee shops</div><div className="mt-1 text-sm leading-relaxed text-[#42566B]">Fast lines, quick taps, morning-rush ready.</div></figcaption>
              </figure>
              <figure className="overflow-hidden rounded-md border border-[#D9E1EA]">
                <div className="relative aspect-[16/10]"><Image src="/jpg3.jpg" alt="A stylist taking a mobile payment at a salon front desk" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>
                <figcaption className="px-5 py-4"><div className="font-bold text-[#0A2540]">Salons &amp; spas</div><div className="mt-1 text-sm leading-relaxed text-[#42566B]">Appointments, tips, and split payments made simple.</div></figcaption>
              </figure>
              <figure className="overflow-hidden rounded-md border border-[#D9E1EA]">
                <div className="relative aspect-[16/10]"><Image src="/jpg1.jpg" alt="A customer tapping a phone to pay at a checkout terminal" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>
                <figcaption className="px-5 py-4"><div className="font-bold text-[#0A2540]">Retail &amp; service counters</div><div className="mt-1 text-sm leading-relaxed text-[#42566B]">Inventory and receipts on the device you already own.</div></figcaption>
              </figure>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Crumb>Point of sale</Crumb>
                <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">A point-of-sale system included with your payments</h2>
                <div className="mt-6 grid gap-3">
                  <div className="flex items-start gap-2.5 text-[15px] font-medium text-[#42566B]"><Tick />Ring up sales, split tender, and process refunds</div>
                  <div className="flex items-start gap-2.5 text-[15px] font-medium text-[#42566B]"><Tick />Track inventory and reorder with confidence</div>
                  <div className="flex items-start gap-2.5 text-[15px] font-medium text-[#42566B]"><Tick />Print or email receipts &mdash; no separate POS bill</div>
                </div>
                <Link href="/pos" className="mt-7 inline-block text-[15px] font-bold text-[#1B6DC1] hover:underline">Explore the point of sale &rarr;</Link>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-[#D9E1EA]">
                <Image src="/jpg4.jpg" alt="A card terminal printing a paper receipt" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#0A2540] py-20 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="max-w-xl text-[32px] font-bold leading-[1.18] tracking-[-0.01em] sm:text-[34px]">See how much you&apos;re overpaying.</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-[#B9C8D8]">A free 15-minute consultation, a clear quote, and the exact dollar amount you&apos;d save by switching to Surge.</p>
          </div>
          <Link href="/book" className="whitespace-nowrap rounded-[4px] bg-white px-7 py-3.5 text-[15.5px] font-bold text-[#0A2540] transition-colors hover:bg-[#F4F7FA]">Book my free savings call</Link>
        </div>
      </section>
    </>
  );
}
