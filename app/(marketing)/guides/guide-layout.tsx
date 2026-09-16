import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, article, breadcrumbTrail } from "../jsonld";
import { Photo, pageMetadata, ClosingCta } from "../design";
import { GUIDES, getGuide } from "./guides";
export function guideMetadata(slug: string): Metadata {
  const guide = getGuide(slug)!;
  const metadata = pageMetadata(
    guide.title,
    guide.description,
    `/guides/${slug}`,
  );
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: guide.datePublished,
      modifiedTime: guide.dateModified,
    },
  };
}
export function GuideArticle({ slug }: { slug: string }) {
  const guide = getGuide(slug)!;
  const path = `/guides/${slug}`;
  const readingMinutes = Math.max(
    1,
    Math.ceil(guide.sections.flat().join(" ").split(/\s+/).length / 180),
  );
  return (
    // marketing.css is scoped under .surge-site, and this element is the
    // scope. It used to be the marketing layout wrapper, which put the home
    // page inside it too.
    <div className="surge-site">
      <JsonLd
        data={{
          ...article({
            headline: guide.title,
            description: guide.description,
            path,
            datePublished: guide.datePublished,
          }),
          dateModified: guide.dateModified,
        }}
      />
      <JsonLd
        data={breadcrumbTrail([
          { name: "Home", path: "" },
          { name: "Guides", path: "/guides" },
          { name: guide.title, path },
        ])}
      />
      <article className="s-article">
        <Link className="s-text-link" href="/guides">
          ← All guides
        </Link>
        <h1>{guide.title}</h1>
        <p className="s-lede">{guide.excerpt}</p>
        <div className="s-article-meta">
          Surge guides · {readingMinutes} min read · Updated 14 September 2026
        </div>
        <Photo name="guides" eager sizes="(min-width: 760px) 720px, 100vw" />
        <nav className="s-article-contents" aria-label="In this guide">
          <span>IN THIS GUIDE</span>
          <ol>
            {guide.sections.map(([heading], index) => (
              <li key={heading}>
                <a href={`#guide-section-${index + 1}`}>
                  {heading}
                  <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="s-article-body">
          {guide.sections.map(([heading, body], index) => (
            <section key={heading} id={`guide-section-${index + 1}`}>
              <h2>{heading}</h2>
              <p>{body}</p>
              {guide.source === "interchange" && index === 1 && (
                <p className="s-small">
                  Reference:{" "}
                  <a href="https://usa.visa.com/support/small-business/regulations-fees.html">
                    Card-network explanation of interchange and merchant pricing
                  </a>
                  .
                </p>
              )}
              {guide.source === "debit" && index === 0 && (
                <p className="s-small">
                  Reference:{" "}
                  <a href="https://www.consumerfinance.gov/ask-cfpb/how-are-prepaid-cards-debit-cards-and-credit-cards-different-en-433/">
                    Consumer Financial Protection Bureau: how debit and credit
                    differ
                  </a>
                  .
                </p>
              )}
            </section>
          ))}
          <aside className="s-note">
            <strong>Keep your own agreement in view.</strong>
            <p>
              These are general questions to help you review a processing
              arrangement. Costs and terms depend on your provider, market and
              contract. Confirm details with your provider.
            </p>
            <Link href="/payments-and-pos">
              How payments work alongside Surge →
            </Link>
          </aside>
        </div>
      </article>
      <section className="s-related" data-reveal>
        <div className="s-wrap">
          <h2>A little more clarity.</h2>
          <div className="s-related-links">
            {GUIDES.filter((item) => item.slug !== slug)
              .slice(0, 3)
              .map((item) => (
                <Link key={item.slug} href={`/guides/${item.slug}`}>
                  {item.title} ↗
                </Link>
              ))}
          </div>
        </div>
      </section>
      <ClosingCta
        title="Good information. Better conversations."
        description="Want to understand the POS side of your setup? We’ll walk you through Surge and answer your questions."
      />
    </div>
  );
}
