import Link from "next/link";
import { ImageSlot, type ImageSlotSpec } from "./image-slot";
import { TerminalComingSoonPill } from "./coming-soon-badge";
import { ArrowRight } from "./primitives";

// A SOLUTIONS CARD — the pair under "Solutions for your business".
//
// THE WHOLE CARD IS ONE LINK, not a link plus a separately-clickable arrow.
// Two focusable things pointing at the same URL is a duplicate tab stop and a
// screen reader reading the destination twice; the circular arrow is decoration
// on top of the single anchor.
//
// THE CAPTION SITS ON A SOLID BAR, NOT A GRADIENT SCRIM. The mockup fades the
// photograph to black behind the text. Gradients are out (see cta-band.tsx), so
// legibility comes from a flat 88%-opacity ink panel — which has the side
// benefit of being measurable: white on it is ≥15:1 whatever the photograph
// underneath turns out to be, where a scrim's contrast depends on the picture.
//
// `showTerminalLabel` is not optional styling. CONTENT-AND-LAUNCH-RULES.md
// requires the coming-soon label beside every reader image including small
// cards and mobile, so any card whose photograph contains the reader must set
// it, and the label renders inside the image wrapper so it cannot be dropped by
// a responsive rule.

export function SolutionCard({
  href,
  title,
  body,
  image,
  showTerminalLabel = false,
}: {
  href: string;
  title: string;
  body: string;
  image: ImageSlotSpec;
  showTerminalLabel?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-[var(--surge-radius-card)] border border-[var(--surge-border)] transition-shadow duration-[var(--surge-motion)] hover:shadow-[0_8px_24px_-16px_rgba(23,25,29,0.45)]"
    >
      <div className="relative">
        <ImageSlot spec={image} rounded={false} labelAlign="top" />
        {showTerminalLabel ? (
          // Inside the image wrapper, and visible at every width: floated over
          // the picture on sm and up, a centred row under it below that.
          <div className="flex justify-center px-3 pb-3 sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2 sm:p-0">
            <TerminalComingSoonPill />
          </div>
        ) : null}

        {/* The caption sits ON the photograph, as the design draws it, rather
            than in a bar beneath — but on a flat 88% ink panel instead of the
            mockup's fade to black, because gradients are out. */}
        <div className="flex items-end justify-between gap-4 bg-[rgb(23_25_29_/_0.88)] p-[var(--surge-space-5)] sm:absolute sm:inset-x-0 sm:bottom-0">
          <div>
            <h3 className="text-[length:var(--surge-h3)] font-bold text-white">{title}</h3>
            <p className="mt-1 text-[length:var(--surge-small)] leading-snug text-[var(--surge-on-dark-muted)]">{body}</p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white text-[var(--surge-ink)] transition-transform duration-[var(--surge-motion)] group-hover:translate-x-0.5"
          >
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
