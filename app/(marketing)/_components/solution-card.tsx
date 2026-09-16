import Link from "next/link";
import { SurgePhoto, type SurgePhotoSpec } from "./photo";
import { ArrowRight } from "./primitives";

// A SOLUTIONS CARD — the pair under "Solutions for your business".
//
// THE CAPTION OVERLAYS THE PHOTOGRAPH. 01-home.jpg puts the title and sub over
// the bottom-left of the picture with the circular arrow at the bottom right,
// and the card is exactly as tall as the photograph. Earlier this pass the
// caption sat in a bar UNDER the image, which made each card ~100px taller than
// the mockup and changed the shape of the whole band.
//
// A FLAT INK PANEL, NOT A SCRIM. The mockup fades the photograph to black
// behind the text. Gradients are out across this site, and the handoff
// independently bans "glow, rainbow gradients or exaggerated shadows", so the
// legibility comes from a flat panel at the opacity the mockup reaches behind
// its text. The side benefit is that it is measurable: white on 70% ink over
// any photograph is ≥11:1, where a scrim's contrast depends on the picture.
//
// NO COMING-SOON PILL ON THIS CARD ANY MORE. The mockup's retail photograph
// contained a keypad reader, so it carried the terminal label. The supplied
// 05-retail-owner.jpg does not contain one, and ASSET-CATALOG.md is explicit:
// "Do not add Coming soon to 01, 02, 04, 05, 06 or 08: they show tablets or
// staff, not the unreleased payment terminal." A status label on a photograph
// with no terminal in it points at the tablet, which is not the thing that is
// unavailable.
//
// THE WHOLE CARD IS ONE LINK, not a link plus a separately-clickable arrow.
// Two focusable things pointing at the same URL is a duplicate tab stop and a
// screen reader reading the destination twice; the circular arrow is decoration
// on top of the single anchor.

/** The mockup's card crop: 578 × 200 at a 1280 viewport. */
const CARD_RATIO = "289 / 100";

export function SolutionCard({
  href,
  title,
  body,
  image,
}: {
  href: string;
  title: string;
  body: string;
  image: SurgePhotoSpec & { requiresTerminalStatus: false };
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-[var(--surge-radius-card)] transition-shadow duration-[var(--surge-motion)] hover:shadow-[0_8px_24px_-16px_rgba(23,25,29,0.45)]"
    >
      <SurgePhoto
        photo={image}
        ratio={CARD_RATIO}
        rounded={false}
        // Two cards side by side inside a 1240px rail from md up; one full
        // card below that. The widest box is ~596px, so at 2× the browser asks
        // for ~1192px against a 1536px source — inside native, never upscaled.
        sizes="(min-width: 768px) 46vw, 92vw"
      />

      {/* 78% INK, AND BOTH LINES IN WHITE. The opacity is the floor the
          contrast maths allows, not a taste call: worst case is a photograph
          that is pure white behind the panel, which puts the panel at
          rgb(74,76,79) and white text on it at 8.66:1. The sub used
          --surge-on-dark-muted, which is 9.29:1 on solid ink but only 2.07:1
          on the same panel over a white photograph — a real AA failure that a
          darker photograph was hiding. White at 85% keeps the two lines
          visually distinct and still measures 6.8:1 in that worst case. */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-[rgb(23_25_29_/_0.78)] px-[var(--surge-space-5)] pb-[var(--surge-space-4)] pt-[var(--surge-space-4)]">
        <div>
          <h3 className="text-[length:var(--surge-h3)] font-bold text-white">{title}</h3>
          <p className="mt-0.5 text-[length:var(--surge-small)] leading-snug text-white/85">{body}</p>
        </div>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-[var(--surge-ink)] transition-transform duration-[var(--surge-motion)] group-hover:translate-x-0.5"
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
