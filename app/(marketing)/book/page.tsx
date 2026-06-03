import type { Metadata } from "next";
import { BookWizard } from "./book-wizard";

export const metadata: Metadata = {
  title: "Book a Call",
  description: "Book a free 15-minute call with Surge. We will review your numbers and show you exactly how much you could save on payment processing, plus the right POS or custom build for your business.",
  alternates: { canonical: "/book" },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const points = ["A clear quote on your lower rate", "Your exact savings vs what you pay now", "The right setup for your business"];

export default function BookPage() {
  return (
    <section className="relative overflow-hidden pb-28 pt-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[85%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
      <div className="pointer-events-none absolute -left-32 top-10 h-[34rem] w-[34rem] rounded-full bg-blue-300/30 blur-[120px] [animation:surge-drift_24s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute right-0 top-28 h-[30rem] w-[30rem] rounded-full bg-cyan-300/25 blur-[120px] [animation:surge-drift_28s_ease-in-out_infinite_reverse]" />
      <div className="relative mx-auto max-w-2xl px-6 text-center">
        <Eyebrow>Book a call</Eyebrow>
        <h1 className="mt-5 text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">Book your free savings call.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">Fifteen minutes, no pressure, no jargon. Answer a few quick questions and we will come prepared with your numbers.</p>
        <div className="mt-9 flex justify-center">
          <BookWizard />
        </div>
        <p className="mt-4 text-xs font-medium text-slate-400">Takes about 30 seconds &bull; No commitment</p>
        <div className="mx-auto mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
          {points.map((p) => (
            <div key={p} className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">{p}</div>
          ))}
        </div>
      </div>
    </section>
  );
}