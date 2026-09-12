import Link from "next/link";
import { getGuide } from "./guides/guides";
import { Crumb, btnPrimary, btnOutline, btnWhite } from "./ui";

// Shared building blocks for the local/industry landing pages. Layout stays
// consistent; each page supplies its own unique H1, intro and body copy so the
// pages aren't thin/duplicated doorway pages.

export function LandingEyebrow({ children }: { children: React.ReactNode }) {
  return <Crumb>{children}</Crumb>;
}

export function LandingHero({ eyebrow, h1, intro }: { eyebrow: string; h1: React.ReactNode; intro: React.ReactNode }) {
  return (
    <section className="border-b border-[#D9E1EA] bg-[#F4F7FA]">
      <div className="mx-auto max-w-3xl px-6 pb-16 pt-40 text-center">
        <LandingEyebrow>{eyebrow}</LandingEyebrow>
        <h1 className="mt-4 text-[38px] font-bold leading-[1.12] tracking-[-0.015em] text-[#0A2540] sm:text-[44px]">{h1}</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#42566B]">{intro}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/book" className={btnPrimary}>Book a free demo</Link>
          <Link href="/pos" className={btnOutline}>See the POS</Link>
        </div>
      </div>
    </section>
  );
}

// A tidy body section for the unique per-page copy. `tint` alternates the
// background so stacked sections read as distinct bands.
export function LandingSection({ title, children, tint }: { title?: string; children: React.ReactNode; tint?: boolean }) {
  return (
    <section className={"border-t border-[#D9E1EA] py-16 " + (tint ? "bg-[#F4F7FA]" : "bg-white")}>
      <div className="mx-auto max-w-3xl px-6">
        {title ? <h2 className="text-[28px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[30px]">{title}</h2> : null}
        <div className="mt-5 space-y-4 leading-relaxed text-[#42566B]">{children}</div>
      </div>
    </section>
  );
}

// Small feature/point grid for a landing page's "what you get" band.
export function LandingPoints({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {items.map((p) => (
        <div key={p.title} className="rounded-md border border-[#D9E1EA] bg-white p-5">
          <div className="text-sm font-bold text-[#0A2540]">{p.title}</div>
          <p className="mt-1.5 text-sm leading-relaxed text-[#42566B]">{p.body}</p>
        </div>
      ))}
    </div>
  );
}

// A short "learn the fees" band that links a landing page into the /guides
// cluster. Titles come from the shared GUIDES list so they can't drift.
// Default heading was "Learn the fees before you switch" — a switch-your-
// processor call to action, which is not what we are asking anyone to do while
// payments are still in build. The guides themselves are unchanged and still
// worth reading; only the framing moved.
export function LandingGuides({ slugs, heading = "Background reading on card fees" }: { slugs: string[]; heading?: string }) {
  const guides = slugs.map(getGuide).filter((g): g is NonNullable<typeof g> => Boolean(g));
  if (!guides.length) return null;
  return (
    <section className="border-t border-[#D9E1EA] bg-white py-16">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-[28px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[30px]">{heading}</h2>
        <ul className="mt-6 space-y-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link href={"/guides/" + g.slug} className="group flex items-baseline gap-2 rounded-md border border-[#D9E1EA] bg-white p-4 transition-colors hover:bg-[#F4F7FA]">
                <span className="font-bold text-[#0A2540] group-hover:text-[#1B6DC1]">{g.title}</span>
                <span className="text-sm font-bold text-[#1B6DC1]">&rarr;</span>
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
      <div className="overflow-x-auto rounded-md border border-[#D9E1EA]">
        <table className="w-full min-w-[540px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#0A2540] text-white">
              <th className="px-4 py-3.5 font-bold"></th>
              <th className="px-4 py-3.5 font-bold">Surge</th>
              <th className="px-4 py-3.5 font-bold text-[#B9C8D8]">{competitor}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-t border-[#D9E1EA]">
                <td className="px-4 py-3.5 font-semibold text-[#42566B]">{r[0]}</td>
                <td className="bg-[#F4F7FA] px-4 py-3.5 font-bold text-[#0A2540]">{r[1]}</td>
                {/* Was #7A8CA0, which is 3.55:1 on white — under AA for body
                    text, and these cells are body text, not fine print. The
                    competitor column still has to read as the quieter one, so
                    this is the darkest value that keeps the de-emphasis while
                    clearing the bar: #5A6E82 measures 5.27:1. */}
                <td className="px-4 py-3.5 text-[#5A6E82]">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? <p className="mt-3 text-xs text-[#7A8CA0]">{note}</p> : null}
    </div>
  );
}

// Fine-print disclaimer band for the competitor-comparison pages.
export function LandingDisclaimer({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white py-10">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-xs leading-relaxed text-[#7A8CA0]">{children}</p>
      </div>
    </section>
  );
}

export function LandingCTA({ heading, sub }: { heading: string; sub: string }) {
  return (
    <section className="bg-[#0A2540] py-20 text-white">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-[30px] font-bold leading-[1.18] tracking-[-0.01em] sm:text-[34px]">{heading}</h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[#B9C8D8]">{sub}</p>
        <div className="mt-8 flex justify-center">
          <Link href="/book" className={btnWhite}>Book my free demo</Link>
        </div>
      </div>
    </section>
  );
}
