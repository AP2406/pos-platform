import Link from "next/link";
import { getGuide } from "./guides/guides";

// Shared building blocks for the local/industry landing pages. Layout stays
// consistent; each page supplies its own unique H1, intro and body copy so the
// pages aren't thin/duplicated doorway pages.

export function LandingEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function LandingHero({ eyebrow, h1, intro }: { eyebrow: string; h1: React.ReactNode; intro: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden pb-16 pt-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[80%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
      <div className="pointer-events-none absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-cyan-300/25 blur-[120px]" />
      <div className="pointer-events-none absolute -left-28 top-10 h-[26rem] w-[26rem] rounded-full bg-blue-300/25 blur-[120px]" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <LandingEyebrow>{eyebrow}</LandingEyebrow>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">{h1}</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">{intro}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/book" className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(37,99,235,0.6)] transition-shadow hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)]">Book a free call</Link>
          <Link href="/pricing" className="rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50">See pricing</Link>
        </div>
      </div>
    </section>
  );
}

// A tidy body section for the unique per-page copy. `tint` alternates the
// background so stacked sections read as distinct bands.
export function LandingSection({ title, children, tint }: { title?: string; children: React.ReactNode; tint?: boolean }) {
  return (
    <section className={"relative border-t border-slate-100 py-16 " + (tint ? "bg-slate-50/70" : "bg-white")}>
      <div className="relative mx-auto max-w-3xl px-6">
        {title ? <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h2> : null}
        <div className="mt-5 space-y-4 leading-relaxed text-slate-600">{children}</div>
      </div>
    </section>
  );
}

// Small feature/point grid for a landing page's "what you get" band.
export function LandingPoints({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {items.map((p) => (
        <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">{p.title}</div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{p.body}</p>
        </div>
      ))}
    </div>
  );
}

// A short "learn the fees" band that links a landing page into the /guides
// cluster. Titles come from the shared GUIDES list so they can't drift.
export function LandingGuides({ slugs, heading = "Learn the fees before you switch" }: { slugs: string[]; heading?: string }) {
  const guides = slugs.map(getGuide).filter((g): g is NonNullable<typeof g> => Boolean(g));
  if (!guides.length) return null;
  return (
    <section className="relative border-t border-slate-100 bg-white py-16">
      <div className="relative mx-auto max-w-3xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{heading}</h2>
        <ul className="mt-6 space-y-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link href={"/guides/" + g.slug} className="group flex items-baseline gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <span className="font-semibold text-slate-900 group-hover:text-blue-700">{g.title}</span>
                <span className="text-sm font-semibold text-blue-600">&rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// Responsive competitor-comparison table (Surge column highlighted). Scrolls
// horizontally on narrow screens so the page body never overflows.
export function LandingCompare({ competitor, rows, note }: { competitor: string; rows: [string, string, string][]; note?: string }) {
  return (
    <div className="mt-8">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
        <table className="w-full min-w-[540px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 font-semibold text-slate-400"></th>
              <th className="px-4 py-3 font-semibold text-blue-700">Surge</th>
              <th className="px-4 py-3 font-semibold text-slate-500">{competitor}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-700">{r[0]}</td>
                <td className="bg-blue-50/40 px-4 py-3 font-semibold text-slate-900">{r[1]}</td>
                <td className="px-4 py-3 text-slate-600">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? <p className="mt-3 text-xs text-slate-400">{note}</p> : null}
    </div>
  );
}

// Fine-print disclaimer band for the competitor-comparison pages.
export function LandingDisclaimer({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative bg-white py-10">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-xs leading-relaxed text-slate-400">{children}</p>
      </div>
    </section>
  );
}

export function LandingCTA({ heading, sub }: { heading: string; sub: string }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 py-20 text-white">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-20 -bottom-24 h-72 w-72 rounded-full bg-cyan-200/30 blur-[110px]" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{heading}</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/85">{sub}</p>
        <div className="mt-8 flex justify-center">
          <Link href="/book" className="rounded-full bg-white px-8 py-4 text-sm font-semibold text-blue-700 shadow-lg transition-transform hover:scale-105">Book my free savings call</Link>
        </div>
      </div>
    </section>
  );
}
