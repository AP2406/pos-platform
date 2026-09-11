import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb } from "../jsonld";
import { LandingEyebrow } from "../local-landing";
import { GUIDES } from "./guides";

// The guides are kept and demoted, not rewritten: they explain how card
// processing is priced in Canada, they never claimed we do it (after the two
// lines removed in the interac and lower-fees guides), and they are genuine
// ranking assets. The framing here just stops implying a sales path that does
// not exist yet.
export const metadata: Metadata = {
  title: { absolute: "Guides — Card Fees & POS for Local Business | Surge" },
  description: "Plain-English guides on card processing fees, Interac, merchant statements and point-of-sale for small businesses across Ontario and the GTA.",
  alternates: { canonical: "/guides" },
  openGraph: { ...OG_BASE, url: "/guides" },
};

export default function GuidesIndexPage() {
  return (
    <>
      <JsonLd data={breadcrumb("Guides", "/guides")} />
      <section className="border-b border-[#D9E1EA] bg-[#F4F7FA]">
        <div className="mx-auto max-w-3xl px-6 pb-14 pt-40 text-center">
          <LandingEyebrow>Guides</LandingEyebrow>
          <h1 className="mt-4 text-[38px] font-bold leading-[1.12] tracking-[-0.015em] text-[#0A2540] sm:text-[44px]">Straight answers on card fees.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#42566B]">No jargon, and genuinely no sales pitch — we do not process cards, so nothing here is steering you toward a rate of ours. Just how fees, Interac and merchant statements actually work.</p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <ul className="space-y-4">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={"/guides/" + g.slug} className="group block rounded-md border border-[#D9E1EA] bg-white p-6 transition-colors hover:bg-[#F4F7FA]">
                  <h2 className="text-lg font-bold text-[#0A2540] group-hover:text-[#1B6DC1]">{g.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#42566B]">{g.excerpt}</p>
                  <span className="mt-3 inline-block text-sm font-bold text-[#1B6DC1]">Read the guide &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
