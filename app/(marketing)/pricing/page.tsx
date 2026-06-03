import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing",
  description: "One honest rate: 2.5% + $0.18 per transaction. No monthly fees, no statement fees, no lock-in contracts. See exactly what you pay with Surge and book a free call.",
  alternates: { canonical: "/pricing" },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

const included = [
  "Tap, chip, swipe, and mobile payments",
  "Point-of-sale software, no extra charge",
  "Sales reports and inventory tracking",
  "In-person terminal setup across the GTA",
  "A real person on the phone when you need one",
  "Next-business-day payouts",
];

const noFees = ["No monthly fee", "No statement fee", "No lock-in contract", "No hidden junk fees"];

const compare = [
  { label: "Per-transaction rate", surge: "2.5% + $0.18", typical: "2.9% + $0.30" },
  { label: "Monthly fee", surge: "$0", typical: "$10 to $30" },
  { label: "Statement fee", surge: "$0", typical: "Often" },
  { label: "Lock-in contract", surge: "None, cancel anytime", typical: "1 to 3 years" },
  { label: "POS software", surge: "Included", typical: "Paid add-on" },
  { label: "Support", surge: "GTA-based, real human", typical: "Call center" },
];

const faqs = [
  { q: "Are there really no monthly fees?", a: "Correct. You pay the per-transaction rate and nothing else. No monthly software fee, no statement fee, no PCI fee." },
  { q: "Am I locked into a contract?", a: "No. There is no term contract and no early-termination fee. If Surge is not saving you money, you walk away." },
  { q: "Do I need to buy new hardware?", a: "Usually not. Surge runs on the tablet or phone you already have, and we can supply a terminal if you want one. We set it up with you in person." },
  { q: "How fast can I start taking payments?", a: "Most local businesses are approved and live within a few business days. We handle the setup with you." },
];

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-12 pt-36">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[80%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
        <div className="pointer-events-none absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-cyan-300/25 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="mt-5 text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">One rate. No surprises.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">The number you see is the number you pay. No monthly fees, no statement maze, no contract holding you hostage.</p>
        </div>
      </section>

      <section className="relative pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="relative">
            <div className="absolute -inset-[2px] overflow-hidden rounded-[calc(1.5rem+2px)]">
              <div className="absolute left-1/2 top-1/2 h-[260%] w-[260%] bg-[conic-gradient(from_0deg,#2563eb,#06b6d4,#38bdf8,#a5f3fc,#06b6d4,#2563eb)] [animation:surge-spin_10s_linear_infinite]" />
            </div>
            <div className="relative rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
              <div className="text-center">
                <div className="text-sm font-semibold uppercase tracking-wider text-blue-700">The Surge rate</div>
                <div className="mt-3 flex items-end justify-center gap-2">
                  <span className="text-6xl font-bold tracking-tight text-slate-900 sm:text-7xl">2.5%</span>
                  <span className="mb-2 text-2xl font-semibold text-slate-500">+ $0.18</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">per transaction &mdash; tap, chip, swipe, or mobile</div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {noFees.map((f) => (<span key={f} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{f}</span>))}
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {included.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Check className="h-3 w-3" /></span>
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <Link href="/book" className="mt-8 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(37,99,235,0.6)] transition-shadow hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)]">See your exact savings on a free call</Link>
              <p className="mt-3 text-center text-xs text-slate-400">Your final rate is confirmed on a quick call. Most local businesses qualify for the rate above.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0E1A2B] py-20 text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Surge vs the big processors</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/70">Same payments. Less taken off the top, and nothing buried in the fine print.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-3 bg-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white/60">
              <div className="px-4 py-3"> </div>
              <div className="px-4 py-3 text-center text-cyan-300">Surge</div>
              <div className="px-4 py-3 text-center">Typical processor</div>
            </div>
            {compare.map((row) => (
              <div key={row.label} className="grid grid-cols-3 border-t border-white/10 text-sm">
                <div className="px-4 py-3 text-white/70">{row.label}</div>
                <div className="px-4 py-3 text-center font-semibold text-white">{row.surge}</div>
                <div className="px-4 py-3 text-center text-white/50">{row.typical}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-white/40">Typical figures shown for comparison and may vary by provider.</p>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/50 to-white py-20">
        <div className="relative mx-auto max-w-3xl px-6">
          <div className="mb-8 text-center">
            <Eyebrow>Questions</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">The honest answers</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 py-24 text-white">
        <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/15 blur-[100px]" />
        <div className="pointer-events-none absolute -right-20 -bottom-24 h-80 w-80 rounded-full bg-cyan-200/30 blur-[110px]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Ready to stop overpaying?</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">Book a free 15-minute call and we will show you the exact amount you would save by switching to Surge.</p>
          <div className="mt-8 flex justify-center">
            <Link href="/book" className="rounded-full bg-white px-8 py-4 text-sm font-semibold text-blue-700 shadow-lg transition-transform hover:scale-105">Book my free savings call</Link>
          </div>
        </div>
      </section>
    </>
  );
}