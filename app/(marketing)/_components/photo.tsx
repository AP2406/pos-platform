import Image from "next/image";
import type { ReactNode } from "react";
import { TERMINAL_COPY } from "@/lib/services/terminal-availability";

// THE PHOTOGRAPHY REGISTRY — the eight supplied JPGs, and the rules attached
// to each one.
//
// This file replaces `image-slot.tsx`, which drew a dashed box with a shot
// brief in it because there were no photographs. There are now: eight files in
// `public/images/surge/`, copied from the handoff's `images/` folder. Nothing
// here ever points at a Downloads path — the files live in `public/` and are
// served by the app.
//
// WHY A REGISTRY RATHER THAN EIGHT <Image> CALLS SCATTERED THROUGH THE PAGES.
// Two of the eight carry a legal-ish obligation that travels WITH the file,
// not with the page:
//
//   * 07-terminal-concept.jpg may not appear without the live status line
//     "Payment terminal · Coming soon" AND the caption "Concept image.
//     Terminal hardware is not yet available." Both must be real text in the
//     same <figure>, never baked into the JPG and never hover-only.
//   * 03-tablet-counter.jpg may not appear without "Illustrative product
//     preview" under it — the menu on that screen is a rendered concept, not a
//     capture of shipping software.
//
// So each entry declares its own obligation (`requiresTerminalStatus`,
// `illustrativeInterface`) and the two wrappers below are the only sanctioned
// way to render those two files. A page that reaches for `<SurgePhoto>`
// directly with the terminal photo gets a TypeScript error, because
// `SurgePhoto` will not accept a spec whose `requiresTerminalStatus` is true.
//
// NATIVE DIMENSIONS ARE image-manifest.json's, VERBATIM. They are what reserves
// the box before the bytes arrive (no layout shift) and what caps the responsive
// set: `sizes` on every usage is written so the widest derivative Next is asked
// for stays at or under the native width. A 1536px source is never advertised
// as more than it is.
//
// ALT TEXT IS ASSET-CATALOG.md's, minus anything about the people in the frame
// beyond what they are doing. The models are illustrative — no name, no title,
// no quote, and no description of who they are.

export type SurgePhotoSpec = {
  /** Stable id; also the filename stem. */
  id: string;
  src: string;
  /** Native pixel dimensions from image-manifest.json. Never render above these. */
  width: number;
  height: number;
  /** ASSET-CATALOG.md's suggested alt. "" marks a decorative repeat. */
  alt: string;
  /** Catalog starting point, adjusted after looking at 375/768/1024/1440. */
  position: string;
  /** Lifestyle photos crop (`cover`); device shots must not be cropped (`contain`). */
  fit: "cover" | "contain";
  /** True only for 07: the coming-soon status and concept caption are mandatory. */
  requiresTerminalStatus: boolean;
  /** True only for 03: "Illustrative product preview" is mandatory. */
  illustrativeInterface: boolean;
};

// `as const` on the object below is load-bearing, not tidiness: it keeps
// `requiresTerminalStatus` as the literal `false`/`true` rather than widening
// it to `boolean`, which is what lets `SurgePhoto` reject the terminal photo at
// compile time instead of at review time.
export const SURGE_PHOTOS = {
  /** Homepage hero; choosing-a-POS hero. */
  homeOwner: {
    id: "01-home-owner",
    src: "/images/surge/01-home-owner.jpg",
    width: 1536,
    height: 1024,
    alt: "Restaurant owner using a tablet at the counter.",
    // Catalog says 65% 50%. Kept on desktop — at 1440 it holds her face and
    // the tablet inside the 52% column. The home hero overrides it to 55% at
    // narrow widths; see the note on that section in page.tsx.
    position: "65% 50%",
    fit: "cover",
    requiresTerminalStatus: false,
    illustrativeInterface: false,
  },
  /** Login, setup, contact, switching. Portrait. */
  teamTablet: {
    id: "02-team-tablet",
    src: "/images/surge/02-team-tablet.jpg",
    width: 1024,
    height: 1536,
    alt: "Two restaurant team members reviewing a tablet together.",
    // 50% 50% — both faces and the tablet are centred; any horizontal shift
    // drops one of the two people out of a portrait crop.
    position: "50% 50%",
    fit: "cover",
    requiresTerminalStatus: false,
    illustrativeInterface: false,
  },
  /** POS overview and hardware tablet card. Screen is conceptual. */
  tabletCounter: {
    id: "03-tablet-counter",
    src: "/images/surge/03-tablet-counter.jpg",
    width: 1536,
    height: 1024,
    alt: "Tablet showing an illustrative restaurant menu interface on a counter.",
    position: "50% 50%",
    fit: "contain",
    requiresTerminalStatus: false,
    illustrativeInterface: true,
  },
  /** Restaurant hero and tableside service. */
  maleTableside: {
    id: "04-male-tableside",
    src: "/images/surge/04-male-tableside.jpg",
    width: 1536,
    height: 1024,
    alt: "Server using a tablet beside a restaurant table.",
    // Catalog says 50% 50%. Changed to 46% 36% for the home closing bleed:
    // that band crops to roughly 3.9:1, and a 50% 50% anchor landed the strip
    // on the server's waist. 36% vertically brings the tablet and the table it
    // is being held over into the band.
    position: "46% 36%",
    fit: "cover",
    requiresTerminalStatus: false,
    illustrativeInterface: false,
  },
  /** Retail hero and retail solution cards. */
  retailOwner: {
    id: "05-retail-owner",
    src: "/images/surge/05-retail-owner.jpg",
    width: 1536,
    height: 1024,
    alt: "Shop owner using a tablet at a retail counter.",
    // Catalog says 50% 50%. Changed to 38% 45% on the wide solutions card:
    // a 2.9:1 crop at 50% cut the owner in half at 1024. 38% keeps him and the
    // counter in frame, and the caption panel sits over the empty right side.
    position: "38% 45%",
    fit: "cover",
    requiresTerminalStatus: false,
    illustrativeInterface: false,
  },
  /** Café hero and restaurant/café solution cards. */
  cafeBarista: {
    id: "06-cafe-barista",
    src: "/images/surge/06-cafe-barista.jpg",
    width: 1536,
    height: 1024,
    alt: "Café team preparing coffee and using a tablet during service.",
    // Catalog says 50% 50%. Changed to 46% 42% on the wide solutions card:
    // the milk pour is the subject and a centre crop clipped the jug at 768.
    position: "46% 42%",
    fit: "cover",
    requiresTerminalStatus: false,
    illustrativeInterface: false,
  },
  /** THE PLANNED TERMINAL. Never render this without TerminalFigure. */
  terminalConcept: {
    id: "07-terminal-concept",
    src: "/images/surge/07-terminal-concept.jpg",
    width: 1536,
    height: 1024,
    alt: "Concept of an unbranded keypad payment terminal, coming soon.",
    position: "50% 50%",
    fit: "contain",
    requiresTerminalStatus: true,
    illustrativeInterface: false,
  },
  /** Guide hub and educational article heroes. */
  guidesDesk: {
    id: "08-guides-desk",
    src: "/images/surge/08-guides-desk.jpg",
    width: 1536,
    height: 1024,
    alt: "Sample paperwork, notebook and tablet on a café table.",
    position: "50% 50%",
    fit: "cover",
    requiresTerminalStatus: false,
    illustrativeInterface: false,
  },
} as const satisfies Record<string, SurgePhotoSpec>;

/* ---------------------------------------------------------------- render -- */

type PhotoProps = {
  /**
   * Any spec EXCEPT the terminal. The terminal has a mandatory live label and
   * caption, so it goes through `TerminalFigure`; this type makes bypassing
   * that a compile error rather than a review catch.
   */
  photo: SurgePhotoSpec & { requiresTerminalStatus: false };
  /**
   * The `sizes` attribute. REQUIRED — it is what decides which derivative the
   * browser fetches, and getting it wrong is how a 1536px source ends up asked
   * for at 3000px. Every call site writes the real CSS width of the box.
   */
  sizes: string;
  /** Display aspect ratio, e.g. "3 / 2". Reserves the box, so nothing shifts. */
  ratio?: string;
  /** Take the parent's height instead of a ratio — for a full-bleed band. */
  fill?: boolean;
  /** Only the above-the-fold hero. Everything else lazy-loads. */
  priority?: boolean;
  className?: string;
  /** Overrides the registry's object-position for one placement. */
  position?: string;
  rounded?: boolean;
};

/**
 * One photograph, responsive, in a box that is reserved before it loads.
 *
 * The wrapper owns the geometry (aspect-ratio or 100% of the parent) and the
 * <Image fill> paints inside it, so the layout is identical before and after
 * the bytes arrive — no CLS. `next/image` generates the AVIF/WebP derivatives
 * through the project's own pipeline; the JPG stays the original and the
 * fallback.
 */
export function SurgePhoto({
  photo,
  sizes,
  ratio,
  fill = false,
  priority = false,
  className = "",
  position,
  rounded = true,
}: PhotoProps) {
  const decorative = photo.alt === "";
  return (
    <div
      data-photo={photo.id}
      style={fill ? undefined : { aspectRatio: ratio ?? `${photo.width} / ${photo.height}` }}
      className={
        "relative overflow-hidden " +
        (fill ? "h-full w-full " : "w-full ") +
        (rounded ? "rounded-[var(--surge-radius-card)] " : "") +
        // A contained device shot sits on the warm surface the catalog asks
        // for; a cover crop never shows its backdrop.
        (photo.fit === "contain" ? "bg-[var(--surge-warm)] " : "") +
        className
      }
    >
      <Image
        src={photo.src}
        alt={photo.alt}
        // Decorative repeats are hidden from assistive tech outright rather
        // than announced with an empty name.
        aria-hidden={decorative ? true : undefined}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        style={{ objectPosition: position ?? photo.position }}
        className={photo.fit === "contain" ? "object-contain" : "object-cover"}
      />
    </div>
  );
}

/**
 * THE ONLY SANCTIONED WAY TO SHOW 07-terminal-concept.jpg.
 *
 * Renders, in one <figure> and in this order:
 *   1. the live status "Payment terminal · Coming soon",
 *   2. the photograph,
 *   3. the caption "Concept image. Terminal hardware is not yet available."
 *
 * Both strings are real text in the served HTML, visible at every width, never
 * hover-only, never inside the JPG. Both come from
 * lib/services/terminal-availability.ts, so the words and the lifecycle state
 * cannot drift apart, and no page can show this picture without them.
 */
export function TerminalFigure({
  sizes,
  className = "",
  mediaClassName = "",
  ratio = "3 / 2",
  aside,
  children,
}: {
  sizes: string;
  className?: string;
  /** Grid template for the picture-plus-`aside` row, when an `aside` is given. */
  mediaClassName?: string;
  ratio?: string;
  /**
   * Content that belongs BESIDE the picture — the planned-capability list on
   * the home page. It goes inside this <figure> rather than next to it so the
   * picture, the status line and the caption stay one indivisible block: the
   * rule is that 07-terminal-concept.jpg may not be rendered without its two
   * strings, and a sibling element is a thing a later edit can move away.
   */
  aside?: ReactNode;
  /** Optional CTA or extra copy, kept inside the figure with the caption. */
  children?: ReactNode;
}) {
  const spec = SURGE_PHOTOS.terminalConcept;
  const media = (
    <div
      data-photo={spec.id}
      style={{ aspectRatio: ratio }}
      className="relative w-full self-center overflow-hidden rounded-[var(--surge-radius-card)] bg-[var(--surge-warm)]"
    >
      <Image
        src={spec.src}
        alt={spec.alt}
        fill
        sizes={sizes}
        loading="lazy"
        style={{ objectPosition: spec.position }}
        className="object-contain"
      />
    </div>
  );
  return (
    <figure className={"m-0 " + className}>
      {aside ? (
        // THE PICTURE AND THE LIST ARE A ROW; THE TWO STRINGS ARE A FULL-WIDTH
        // BLOCK UNDER IT. Stacking picture → status → caption inside one narrow
        // 180px track, which is what this used to do on the home page, wrapped
        // the caption onto three lines and made the whole thing read as three
        // cramped blocks in a gutter. Given the width of the band, both strings
        // set on one line each.
        <div className={"grid items-center gap-[var(--surge-space-5)] " + mediaClassName}>
          {media}
          <div>{aside}</div>
        </div>
      ) : (
        media
      )}
      {/* BELOW the image — ASSET-CATALOG.md allows either side, and below puts
          the status and the caption together as one block a reader takes in at
          once, instead of two caveats with a picture between them. Not a
          floated pill: at 375 a pill over a 3:2 product shot covers the reader,
          which is the only thing in the frame. */}
      <p className="mt-[var(--surge-space-4)] inline-flex items-center rounded-[var(--surge-radius-control)] border border-[var(--surge-accent)] bg-[var(--surge-surface)] px-2.5 py-1 text-center text-[length:var(--surge-micro)] font-semibold leading-tight text-[var(--surge-ink)]">
        {TERMINAL_COPY.imageLabel}
      </p>
      <figcaption className="mt-1 text-[length:var(--surge-micro)] leading-snug text-[var(--surge-muted)]">
        {TERMINAL_COPY.conceptCaption}
      </figcaption>
      {children}
    </figure>
  );
}

/**
 * THE ONLY SANCTIONED WAY TO SHOW 03-tablet-counter.jpg.
 *
 * The menu on that tablet is a rendered concept. "Illustrative product
 * preview" sits under the picture, in the same figure, as live text.
 */
export function IllustrativePhotoFigure({
  sizes,
  className = "",
  ratio = "3 / 2",
}: {
  sizes: string;
  className?: string;
  ratio?: string;
}) {
  const spec = SURGE_PHOTOS.tabletCounter;
  return (
    <figure className={"m-0 " + className}>
      <div
        data-photo={spec.id}
        style={{ aspectRatio: ratio }}
        className="relative w-full overflow-hidden rounded-[var(--surge-radius-card)] bg-[var(--surge-warm)]"
      >
        <Image
          src={spec.src}
          alt={spec.alt}
          fill
          sizes={sizes}
          loading="lazy"
          style={{ objectPosition: spec.position }}
          className="object-contain"
        />
      </div>
      <figcaption className="mt-2 text-[length:var(--surge-micro)] leading-snug text-[var(--surge-muted)]">
        {TERMINAL_COPY.illustrativePreview}
      </figcaption>
    </figure>
  );
}
