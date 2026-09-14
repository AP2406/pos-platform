import { TERMINAL_COPY, PRODUCT_PREVIEW_LABEL } from "@/lib/services/terminal-availability";

// THE COMING-SOON LABEL, AND WHY IT IS A COMPONENT RATHER THAN A SPAN.
//
// CONTENT-AND-LAUNCH-RULES.md requires this label beside EVERY reader image —
// hero, solutions card, mobile, all of it. A span copied five times is a span
// that gets deleted from four of them during a layout tweak. This component
// reads its text from lib/services/terminal-availability.ts, so the label and
// the lifecycle state cannot drift, and `TerminalImageFrame` below makes the
// label a structural child of the image wrapper rather than a sibling — on a
// narrow screen the picture and its caveat shrink together and the label
// cannot be the thing that gets hidden.
//
// NEVER COLOUR ALONE. The pill says the words "Coming soon"; the blue ring is
// decoration on top of a sentence, not the signal itself.

/**
 * The full pill: "Payment terminal · Coming soon".
 *
 * White fill / ink text (17.60:1) with a 1px --surge-accent ring. The ring is
 * non-text at 3.40:1, clear of WCAG's 3:1 for a meaningful graphic.
 */
export function TerminalComingSoonPill({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full border border-[var(--surge-accent)] bg-[var(--surge-surface)] px-3 py-1.5 text-[length:var(--surge-micro)] font-semibold leading-tight text-[var(--surge-ink)] shadow-[0_1px_3px_rgba(23,25,29,0.12)] " +
        className
      }
    >
      {TERMINAL_COPY.imageLabel}
    </span>
  );
}

/**
 * Short chip, for a card that already carries a "Payment terminal" heading and
 * would otherwise say the words twice.
 */
export function ComingSoonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-[var(--surge-radius-control)] bg-[var(--surge-accent-soft)] px-2.5 py-1 text-[length:var(--surge-micro)] font-bold uppercase tracking-[0.06em] text-[var(--surge-action)] " +
        className
      }
    >
      {TERMINAL_COPY.shortLabel}
    </span>
  );
}

/**
 * The "Product preview" badge for unbuilt or unverified SOFTWARE.
 *
 * Deliberately a different string and a different shape from the terminal
 * label: a floor-plan screenshot is a claim about the POS, and says nothing
 * about whether we can take a card. Filled with --surge-action so the white
 * text measures 5.22:1 — the accent would be 3.40:1 and fail.
 */
export function ProductPreviewBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full bg-[var(--surge-action)] px-3 py-1.5 text-[length:var(--surge-micro)] font-bold leading-tight text-white " +
        className
      }
    >
      {PRODUCT_PREVIEW_LABEL}
    </span>
  );
}

/**
 * Wraps any image that shows the card reader and pins the label inside it.
 *
 * `position` picks which corner the pill sits in — the design puts it bottom
 * right over the hero and mid right over the retail card. Below `sm` the pill
 * drops to a full-width row under the picture instead of floating over it: at
 * 375px a floating pill either covers the subject or wraps to three lines, and
 * the rule is that the label survives, not that it floats.
 */
export function TerminalImageFrame({
  children,
  className = "",
  position = "bottom-right",
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * `below` never floats — for a slot too small to carry a pill over it
   * without covering the subject (the square terminal render). The label is
   * still a child of this wrapper, which is the part the rule cares about.
   */
  position?: "bottom-right" | "middle-right" | "bottom-left" | "below";
}) {
  const place =
    position === "below"
      ? null
      : position === "middle-right"
        ? "sm:right-4 sm:top-1/2 sm:-translate-y-1/2"
        : position === "bottom-left"
          ? "sm:bottom-4 sm:left-4"
          : "sm:bottom-4 sm:right-4";
  return (
    <div className={"relative " + className}>
      {children}
      <div className={place ? "mt-2 flex justify-center sm:absolute sm:mt-0 " + place : "mt-2 flex justify-center"}>
        <TerminalComingSoonPill />
      </div>
    </div>
  );
}
