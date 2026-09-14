import Link from "next/link";
import type { ReactNode } from "react";
import { Container, Heading, linkAction } from "./primitives";

// THE GUIDE LAYOUT — the reading shell for /guides/* (mockups 17–21).
//
// Three things it fixes that a plain <article> does not:
//
//   * MEASURE. Article text is capped at --surge-measure (68ch), which is the
//     figure DESIGN-SYSTEM.md names. A guide set in a 1240px column is a guide
//     nobody finishes.
//   * THE CONTENTS RAIL COLLAPSES ON MOBILE. DESIGN-SYSTEM.md asks for it
//     explicitly ("make guide contents collapsible"), and it is a <details>
//     rather than a scripted drawer so it works before hydration — the same
//     reasoning as faq-accordion.tsx. On lg it becomes a sticky sidebar and the
//     <details> is forced open by `open`, because a permanently-visible rail
//     that can still be collapsed is a control with no purpose.
//   * ONE H1. The rules ask for "a single descriptive main heading" per page;
//     the title is rendered here so a guide page cannot accidentally ship two.
//
// Phase 2 moves the five guide pages onto this shell. The existing
// app/(marketing)/guides/guide-layout.tsx keeps serving them until then.

export type GuideSection = { id: string; label: string };

export function GuideLayout({
  eyebrow,
  title,
  standfirst,
  sections,
  children,
  related,
}: {
  eyebrow: string;
  title: string;
  standfirst?: string;
  /** Anchor list for the contents rail. Each id must exist as a heading id in `children`. */
  sections: GuideSection[];
  children: ReactNode;
  related?: { href: string; label: string }[];
}) {
  return (
    <article>
      <Container className="py-[var(--surge-space-8)]">
        <p className="text-[length:var(--surge-micro)] font-bold uppercase tracking-[0.08em] text-[var(--surge-action)]">{eyebrow}</p>
        <Heading as="h1" size="h2" className="mt-3 max-w-[20ch] text-[var(--surge-ink)]">
          {title}
        </Heading>
        {standfirst ? (
          <p className="mt-4 max-w-[var(--surge-measure)] text-[length:var(--surge-body-lg)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">
            {standfirst}
          </p>
        ) : null}
      </Container>

      <Container className="grid gap-[var(--surge-space-7)] pb-[var(--surge-space-9)] lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-[var(--surge-space-8)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-[96px] lg:self-start">
          <details open className="rounded-[var(--surge-radius-card)] border border-[var(--surge-border)] p-4 lg:border-0 lg:p-0">
            <summary className="cursor-pointer list-none text-[length:var(--surge-micro)] font-bold uppercase tracking-[0.08em] text-[var(--surge-muted)] [&::-webkit-details-marker]:hidden">
              On this page
            </summary>
            <ul className="mt-3 space-y-2 text-[length:var(--surge-small)]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={"#" + s.id} className="text-[var(--surge-muted)] underline-offset-4 hover:text-[var(--surge-action)] hover:underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </nav>

        <div className="max-w-[var(--surge-measure)] text-[length:var(--surge-body)] leading-[var(--surge-leading-body)] text-[var(--surge-ink)]">
          {children}

          {related && related.length ? (
            <div className="mt-[var(--surge-space-8)] border-t border-[var(--surge-border)] pt-[var(--surge-space-5)]">
              <h2 className="text-[length:var(--surge-micro)] font-bold uppercase tracking-[0.08em] text-[var(--surge-muted)]">Related guides</h2>
              <ul className="mt-3 space-y-2">
                {related.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className={linkAction}>
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Container>
    </article>
  );
}
