import Link from "next/link";
import type { Metadata } from "next";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, article, breadcrumbTrail } from "../jsonld";
import { LandingEyebrow, LandingCTA } from "../local-landing";
import { getGuide, GUIDES } from "./guides";

// Shared chrome for every /guides post: metadata, Article + breadcrumb JSON-LD,
// the header, and the closing CTA. Each guide page only writes its own body.

export function guideMetadata(slug: string): Metadata {
  const g = getGuide(slug)!;
  const path = "/guides/" + slug;
  return {
    title: { absolute: g.title + " | Surge" },
    description: g.description,
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, url: path, type: "article" },
  };
}

export function GuideH2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 text-2xl font-bold tracking-[-0.01em] text-[#0A2540]">{children}</h2>;
}
export function GuideP({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 leading-relaxed text-[#42566B]">{children}</p>;
}

function RelatedGuides({ currentSlug }: { currentSlug: string }) {
  const others = GUIDES.filter((g) => g.slug !== currentSlug).slice(0, 3);
  if (!others.length) return null;
  return (
    <section className="border-t border-[#D9E1EA] bg-[#F4F7FA] py-14">
      <div className="mx-auto max-w-2xl px-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[#7A8CA0]">Keep reading</h2>
        <ul className="mt-4 space-y-3">
          {others.map((g) => (
            <li key={g.slug}>
              <Link href={"/guides/" + g.slug} className="group block rounded-md border border-[#D9E1EA] bg-white p-4 transition-colors hover:bg-[#F4F7FA]">
                <span className="font-bold text-[#0A2540] group-hover:text-[#1B6DC1]">{g.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function GuideArticle({ slug, lede, cta, children }: { slug: string; lede: React.ReactNode; cta: { heading: string; sub: string }; children: React.ReactNode }) {
  const g = getGuide(slug)!;
  const path = "/guides/" + slug;
  return (
    <>
      <JsonLd data={article({ headline: g.title, description: g.description, path, datePublished: g.datePublished })} />
      <JsonLd data={breadcrumbTrail([{ name: "Home", path: "" }, { name: "Guides", path: "/guides" }, { name: g.title, path }])} />

      <article className="relative overflow-hidden pb-8 pt-36">
        
        <div className="relative mx-auto max-w-2xl px-6">
          <Link href="/guides" className="text-sm font-bold text-[#1B6DC1] hover:underline">&larr; All guides</Link>
          <div className="mt-4"><LandingEyebrow>Guide</LandingEyebrow></div>
          <h1 className="mt-4 text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#0A2540] sm:text-[42px]">{g.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-[#42566B]">{lede}</p>
          {children}
          <p className="mt-8 text-xs text-[#7A8CA0]">This guide is general information, not financial or legal advice. Card network rules and rates change &mdash; confirm the current details before acting.</p>
        </div>
      </article>

      <RelatedGuides currentSlug={slug} />
      <LandingCTA heading={cta.heading} sub={cta.sub} />
    </>
  );
}
