// THE SURGE MARK — one source for every React surface.
//
// Ported from Surge-Logo-Kit-v1 (svg/surge-horizontal-flat-dark.svg and
// svg/surge-symbol-flat-dark.svg, geometry verbatim). Inline rather than an
// <img src="/brand/...">, for two reasons the kit's own rules force on us:
//
//  1. THEME. The kit ships `light` (near-black lettering) and `flat-dark`
//     (white lettering) as separate files, and an <img> cannot pick between
//     them. Inlining lets one element carry both: the lettering and outline
//     read `--logo-ink`, which flips ink->white in .dark, so each theme gets
//     the variant the kit says it should get. The bars stay `--brand`, which
//     is the kit blue in BOTH themes — the blue never moves.
//  2. SIZE. The README says use the dedicated optical icons below 48px rather
//     than shrinking the lockup, so `SurgeIcon` carries the kit's own 16/24/
//     32/48 grids as real geometry instead of scaling one path down.
//
// Nothing here stretches, rotates, shadows or recolours the letters: `tone`
// only ever selects between the variants the kit already publishes.

export type SurgeTone = "auto" | "light" | "dark" | "mono";

// The lettering + outline. `auto` follows the theme via the token; the explicit
// tones are the kit's published values, for surfaces that are a fixed colour
// regardless of theme (the marketing footer's navy, a dark hero panel).
const INK: Record<SurgeTone, string> = {
  auto: "var(--logo-ink)",
  light: "#101318",
  dark: "#FFFFFF",
  mono: "currentColor",
};

// The three bars. Always the kit blue — `mono` is the one-colour artwork
// (receipts, single-ink print), where the whole mark collapses to one value.
const BAR: Record<SurgeTone, string> = {
  auto: "var(--brand)",
  light: "#008CFF",
  dark: "#008CFF",
  mono: "currentColor",
};

type Props = {
  tone?: SurgeTone;
  className?: string;
  /** Decorative when a text "Surge" sits beside it; labelled when it stands alone. */
  title?: string | null;
};

// The horizontal lockup: mark + wordmark. The README's floor is 220px wide —
// below that use SurgeIcon (or the symbol) instead of squeezing the wordmark.
export function SurgeLogo({ tone = "auto", className, title = "Surge" }: Props) {
  const ink = INK[tone];
  const blue = BAR[tone];
  return (
    <svg
      viewBox="0 0 980 290"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <g transform="translate(32 37)"><g fill="none" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"><path stroke={ink} d="M132 12 H277 A31 31 0 0 1 308 43 V173 A31 31 0 0 1 277 204 H132" /><path stroke={blue} d="M66 60 H158 M12 108 H158 M66 156 H158" /></g></g><g fill={ink} transform="translate(410 53) scale(0.19954476479514416 -0.19954476479514416) translate(-14 -752)"><path transform="translate(0 0)" d="M14 211C19 153 32 116 62 76C106 20 178 -13 257 -13C390 -13 493 90 493 224C493 286 471 338 427 378C398 405 375 417 302 445C232 471 230 472 220 478C193 495 179 518 179 545C179 589 210 620 255 620C301 620 329 592 333 542H475C472 598 459 636 429 673C389 723 325 752 256 752C136 752 41 659 41 542C41 449 95 378 195 341C294 304 301 301 323 284C345 266 357 240 357 209C357 156 316 119 257 119C196 119 163 149 157 211Z" /><path transform="translate(502 0)" d="M547 554H414V293C414 219 409 184 393 160C374 127 337 109 292 109C258 109 232 120 214 144C195 168 187 208 187 283V554H54V257C54 163 65 114 96 69C133 16 192 -13 265 -13C332 -13 373 4 424 53V0H547Z" /><path transform="translate(1094 0)" d="M54 0H187V308C184 390 226 436 306 439V567H296C239 567 211 551 176 500V554H54Z" /><path transform="translate(1394 0)" d="M484 554V484C442 540 383 567 303 567C146 567 30 445 30 281C30 110 144 -13 302 -13C380 -13 432 12 484 73C479 -46 428 -104 329 -104C267 -104 229 -88 190 -45H39C84 -156 188 -221 324 -221C424 -221 503 -186 555 -120C594 -69 611 -1 611 105V554ZM318 445C413 445 478 377 478 275C478 175 416 109 320 109C225 109 164 174 164 275C164 377 225 445 318 445Z" /><path transform="translate(2042 0)" d="M603 218C607 238 608 250 608 270C608 441 487 567 322 567C159 567 30 438 30 275C30 113 161 -13 330 -13C421 -13 492 20 550 87C571 113 585 136 594 164H449C415 124 382 109 327 109C248 109 190 151 174 218ZM170 335C191 407 245 445 324 445C406 445 460 406 477 335Z" /></g>
    </svg>
  );
}

// The standalone symbol, for square/large placements (a spinner centre, an
// avatar-sized tile). Under 48px use SurgeIcon.
export function SurgeSymbol({ tone = "auto", className, title = "Surge" }: Props) {
  const ink = INK[tone];
  const blue = BAR[tone];
  return (
    <svg
      viewBox="0 0 384 384"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <g transform="translate(32 84)"><g fill="none" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round"><path stroke={ink} d="M132 12 H277 A31 31 0 0 1 308 43 V173 A31 31 0 0 1 277 204 H132" /><path stroke={blue} d="M66 60 H158 M12 108 H158 M66 156 H158" /></g></g>
    </svg>
  );
}

// The optical icons, 16/24/32/48. These are NOT the symbol scaled down: each
// grid has its own stroke weight and its own bar lengths so the motif survives
// at that pixel size, which is exactly why the README forbids shrinking the
// full logo into this range. Pick the grid nearest the rendered size.
const ICON_GRID = {
  16: { w: 2, frame: "M6 2 H11 Q14 2 14 5 V11 Q14 14 11 14 H6", bars: "M4 5 H8 M2 8 H8 M4 11 H8" },
  24: { w: 2, frame: "M10 2 H19 Q22 2 22 5 V19 Q22 22 19 22 H10", bars: "M6 7 H12 M2 12 H12 M6 17 H12" },
  32: { w: 3, frame: "M13 3 H26 Q29 3 29 6 V26 Q29 29 26 29 H13", bars: "M8 10 H17 M3 16 H17 M8 22 H17" },
  48: { w: 4, frame: "M19 4 H41 Q44 4 44 7 V41 Q44 44 41 44 H19", bars: "M12 14 H25 M4 24 H25 M12 34 H25" },
} as const;

export function SurgeIcon({
  size = 32,
  tone = "auto",
  className,
  title = "Surge",
}: Props & { size?: 16 | 24 | 32 | 48 }) {
  const g = ICON_GRID[size];
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <g fill="none" strokeWidth={g.w} strokeLinecap="round" strokeLinejoin="round">
        <path stroke={INK[tone]} d={g.frame} />
        <path stroke={BAR[tone]} d={g.bars} />
      </g>
    </svg>
  );
}
