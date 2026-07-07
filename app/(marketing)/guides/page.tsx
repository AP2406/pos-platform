import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb } from "../jsonld";
import { LandingEyebrow } from "../local-landing";
import { GUIDES } from "./guides";

export const metadata: Metadata = {
  title: { absolute: "Guides — Payments & POS for Local Business | Surge" },
  description: "Plain-English guides on card processing fees, Interac, merchant statements and point-of-sale for small businesses across Ontario and the GTA.",
  alternates: { canonical: "/guides" },
  openGraph: { ...OG_BASE, url: "/guides" },
};

export default function GuidesIndexPage() {
  return (
    <>
      <JsonLd data={breadcrumb("Guides", "/guides")} />
      <section className="relative overflow-hidden pb-10 pt-36">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[80%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
        <div className="pointer-events-none absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-cyan-300/25 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <LandingEyebrow>Guides</LandingEyebrow>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Straight answers on payments &amp; POS.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">No jargon, no sales pitch — just how card fees, Interac and merchant statements actually work, so you can spot what you&rsquo;re overpaying.</p>
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto max-w-3xl px-6">
          <ul className="space-y-4">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={"/guides/" + g.slug} className="group block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                  <h2 className="text-lg font-semibold text-slate-900 group-hover:text-blue-700">{g.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{g.excerpt}</p>
                  <span className="mt-3 inline-block text-sm font-semibold text-blue-600">Read the guide &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
