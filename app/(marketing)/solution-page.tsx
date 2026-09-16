import {
  Hero,
  SectionHeading,
  FeatureGrid,
  Photo,
  Checklist,
  Action,
  ClosingCta,
  PaymentsPreview,
} from "./design";
import { ProductPreview } from "./product-preview";
import { JsonLd, breadcrumb } from "./jsonld";
import type { SolutionContent } from "./solution-content";
import { ExploreNext } from "./next-steps";
export function SolutionPage({ content: c }: { content: SolutionContent }) {
  return (
    // marketing.css is scoped under .surge-site, and this element is the
    // scope. It used to be the marketing layout wrapper, which put the home
    // page inside it too.
    <div className="surge-site">
      <JsonLd data={breadcrumb(c.eyebrow, c.path)} />
      <Hero
        eyebrow={c.eyebrow}
        title={c.title}
        description={c.description}
        photo={c.photo}
        caption={c.caption}
      />
      <nav className="s-wrap s-page-chapters" aria-label="On this page">
        <span>TAKE A CLOSER LOOK</span>
        <a href="#capabilities">Features</a>
        {c.preview && <a href="#workspace">The workspace</a>}
        <a href="#your-setup">Your setup</a>
        <a href="#next-steps">Next steps</a>
      </nav>
      <div className="s-surface">
        <section className="s-wrap s-section" id="capabilities">
          <SectionHeading
            eyebrow="The everyday essentials"
            title={c.sectionTitle}
          />
          <FeatureGrid
            items={c.features.map(([title, body]) => ({ title, body }))}
          />
        </section>
      </div>
      {c.preview && <ProductPreview />}
      <section className="s-wrap s-section s-split" id="your-setup" data-reveal>
        <figure>
          <Photo name={c.secondPhoto} />
          {c.secondCaption && (
            <figcaption className="s-small">{c.secondCaption}</figcaption>
          )}
        </figure>
        <div>
          <p className="s-eyebrow">Make it work for you</p>
          <h2>{c.secondTitle}</h2>
          <p>{c.secondBody}</p>
          <Checklist items={c.checks} />
          <div className="s-actions">
            <Action href="/book" secondary>
              Let’s walk through it
            </Action>
          </div>
        </div>
      </section>
      {c.payments && <PaymentsPreview />}
      <div id="next-steps">
        <ExploreNext current={c.path} />
      </div>
      <ClosingCta />
    </div>
  );
}
