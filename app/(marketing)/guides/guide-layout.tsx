import Link from "next/link";
import type { Metadata } from "next";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, article, breadcrumbTrail } from "../jsonld";
import { LandingEyebrow, LandingCTA } from "../local-landing";
import { getGuide } from "./guides";

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
  return <h2 className="mt-12 text-2xl font-semibold tracking-tight text-slate-900">{children}</h2>;
}
export function GuideP({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 leading-relaxed text-slate-600">{children}</p>;
}

export function GuideArticle({ slug, lede, cta, children }: { slug: string; lede: React.ReactNode; cta: { heading: string; sub: string }; children: React.ReactNode }) {
  const g = getGuide(slug)!;
  const path = "/guides/" + slug;
  return (
    <>
      <JsonLd data={article({ headline: g.title, description: g.description, path, datePublished: g.datePublished })} />
      <JsonLd data={breadcrumbTrail([{ name: "Home", path: "" }, { name: "Guides", path: "/guides" }, { name: g.title, path }])} />

      <article className="relative overflow-hidden pb-8 pt-36">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
        <div className="relative mx-auto max-w-2xl px-6">
          <Link href="/guides" className="text-sm font-semibold text-blue-600 hover:text-blue-700">&larr; All guides</Link>
          <div className="mt-4"><LandingEyebrow>Guide</LandingEyebrow></div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{g.title}</h1>
          <p className="mt-5 text-lg text-slate-600">{lede}</p>
          {children}
          <p className="mt-8 text-xs text-slate-400">This guide is general information, not financial or legal advice. Card network rules and rates change &mdash; confirm the current details before acting.</p>
        </div>
      </article>

      <LandingCTA heading={cta.heading} sub={cta.sub} />
    </>
  );
}
