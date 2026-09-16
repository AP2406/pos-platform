// Layout and type primitives for the redesigned marketing surface.
//
// Every value here reads a token from app/(marketing)/tokens.css. Nothing in
// this directory contains a hex literal except the two hover shades noted
// below: the point of the port is that the next palette change is one file,
// not twenty-two pages.
//
// `_components` is a private folder — Next never routes it — so these files can
// sit next to the pages they serve without becoming URLs.

import type { ReactNode } from "react";

/* ---------------------------------------------------------------- layout -- */

/** The 1240px rail with the responsive gutter. Class lives in tokens.css. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"surge-wrap " + className}>{children}</div>;
}

type Tone = "surface" | "canvas" | "warm" | "dark";

const TONE_BG: Record<Tone, string> = {
  surface: "bg-[var(--surge-surface)]",
  canvas: "bg-[var(--surge-canvas)]",
  warm: "bg-[var(--surge-warm)]",
  dark: "bg-[var(--surge-ink)]",
};

/**
 * A full-width band. `dark` also flips the focus-ring colour (see
 * `.surge-on-dark` in tokens.css) because --surge-action is only 2.5:1 on
 * charcoal and would be an invisible focus indicator there.
 */
export function Band({
  tone = "surface",
  className = "",
  id,
  children,
  labelledBy,
}: {
  tone?: Tone;
  className?: string;
  id?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  const dark = tone === "dark" ? " surge-on-dark text-[var(--surge-on-dark)]" : "";
  return (
    <section id={id} aria-labelledby={labelledBy} className={TONE_BG[tone] + dark + " " + className}>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ type -- */

/**
 * The small blue label above a heading.
 *
 * --surge-action, NOT --surge-accent. This renders at 13px, which is nowhere
 * near WCAG's large-text threshold, and the accent measures 3.40:1 on white.
 * The action token is 5.22:1. Same rule everywhere a blue WORD sits on a light
 * surface; the accent is for rules, icon strokes and the charcoal band.
 */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={"text-[length:var(--surge-micro)] font-bold uppercase tracking-[0.08em] text-[var(--surge-action)] " + className}>
      {children}
    </p>
  );
}

/** Eyebrow on the charcoal band, where the accent is the legible one (5.19:1). */
export function EyebrowOnDark({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={"text-[length:var(--surge-micro)] font-bold uppercase tracking-[0.08em] text-[var(--surge-accent)] " + className}>
      {children}
    </p>
  );
}

const HEADING_SIZE = {
  display: "text-[length:var(--surge-display)] leading-[var(--surge-leading-tight)]",
  bandDisplay: "text-[length:var(--surge-h2-display)] leading-[var(--surge-leading-heading)]",
  h2: "text-[length:var(--surge-h2)] leading-[var(--surge-leading-heading)]",
  h3: "text-[length:var(--surge-h3)] leading-[1.3]",
} as const;

export function Heading({
  as = "h2",
  size = "h2",
  id,
  className = "",
  children,
}: {
  as?: "h1" | "h2" | "h3";
  size?: keyof typeof HEADING_SIZE;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const Tag = as;
  return (
    <Tag id={id} className={HEADING_SIZE[size] + " font-bold tracking-[-0.02em] " + className}>
      {children}
    </Tag>
  );
}

/** Body copy. 18px at 1.55, capped near 68 characters per DESIGN-SYSTEM.md. */
export function Lede({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={"max-w-[var(--surge-measure)] text-[length:var(--surge-body-lg)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)] " + className}>
      {children}
    </p>
  );
}

/* --------------------------------------------------------------- controls -- */

// 44px floor and the 8px control radius come from `.surge-control`; the strings
// below add layout, fill, ink and padding. Transitions read --surge-motion, so
// prefers-reduced-motion zeroes them with no extra rule. `inline-flex` is a
// utility here rather than part of `.surge-control` so that a responsive
// `lg:hidden` on a control still wins — see the note in tokens.css.
const CONTROL_BOX = "surge-control inline-flex items-center justify-center gap-2 ";
//
// The two hover values are the only literals in this file. A hover state is a
// darker step of an existing token rather than a token in its own right — the
// handoff ships no hover scale — and #0058b8 (white text, 6.51:1) is one rung
// under --surge-action, so the control gets darker on hover, never lighter.

/** White on --surge-action is 5.22:1. Never --surge-accent: that pairing is 3.40:1. */
export const btnPrimary =
  CONTROL_BOX + "bg-[var(--surge-action)] px-6 text-[length:var(--surge-small)] font-bold text-white hover:bg-[#0058b8]";

/** Outline button on a light surface. Border is the control border (3.04:1), not the hairline. */
export const btnOutline =
  CONTROL_BOX + "border border-[var(--surge-border-control)] bg-[var(--surge-surface)] px-6 text-[length:var(--surge-small)] font-bold text-[var(--surge-ink)] hover:bg-[var(--surge-canvas)]";

/** Outline button drawn in the accent, for a secondary action that should still read as blue. */
export const btnOutlineAccent =
  CONTROL_BOX + "border border-[var(--surge-accent)] bg-[var(--surge-surface)] px-6 text-[length:var(--surge-small)] font-bold text-[var(--surge-action)] hover:bg-[var(--surge-accent-soft)]";

/** On the charcoal band. White fill, ink text — 17.60:1. */
export const btnOnDark =
  CONTROL_BOX + "bg-white px-6 text-[length:var(--surge-small)] font-bold text-[var(--surge-ink)] hover:bg-[var(--surge-warm)]";

/** Inline text link. Action blue, 5.22:1; underlined on hover rather than always, so a paragraph is not striped. */
export const linkAction =
  "font-bold text-[var(--surge-action)] underline-offset-4 hover:underline";

/** The arrow that sits inside a CTA in the design. Decorative — the label carries the meaning. */
export function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={"h-[1em] w-[1em] " + className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  );
}

/** Screen-reader-only text, for the cases where a visible label would duplicate. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0,0,0,0)]">{children}</span>;
}
