import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Photo, pageMetadata, ClosingCta } from "../design";
import { GUIDES } from "./guides";
export const metadata = pageMetadata(
  "Practical business & POS guides",
  "Clear, practical guides to POS decisions, card processing costs and merchant statements. Questions to help you understand your own business setup.",
  "/guides",
);
export default function GuidesPage() {
  return (
    <>
      <section className="s-wrap s-hero">
        <div className="s-hero-copy">
          <p className="s-eyebrow">The Surge reading room</p>
          <h1>A little clarity goes a long way.</h1>
          <p className="s-lede">
            Practical questions and plain-language guides for the decisions that
            come with running a business.
          </p>
          <Link href="/choosing-a-pos" className="s-text-link">
            Start with choosing your POS{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <figure className="s-hero-figure">
          <Photo name="guides" eager />
        </figure>
      </section>
      <section aria-label="Business guides" className="s-wrap s-guide-list">
        {GUIDES.map((guide, index) => (
          <article key={guide.slug} className="s-guide-card" data-reveal>
            <span className="s-guide-number">
              GUIDE {String(index + 1).padStart(2, "0")} · BUSINESS ESSENTIALS
            </span>
            <h2>
              <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
            </h2>
            <p>{guide.excerpt}</p>
            <div className="s-guide-details">
              <span>
                {Math.max(
                  1,
                  Math.ceil(
                    guide.sections.flat().join(" ").split(/\s+/).length / 180,
                  ),
                )}{" "}
                min read
              </span>
              <span>{guide.sections.length} practical questions</span>
            </div>
            <Link href={`/guides/${guide.slug}`} className="s-text-link">
              Read the guide <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>
      <ClosingCta />
    </>
  );
}
