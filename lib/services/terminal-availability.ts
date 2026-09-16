// THE ONE PLACE THE PAYMENT TERMINAL'S LIFECYCLE STATE LIVES.
//
// WHY THIS MODULE EXISTS. The physical card reader is not built, not for sale
// and not dated. The website shows it anyway — a hero photo, a solutions card,
// a whole "planned terminal" panel — and every one of those pictures is a
// merchant's first impression of a product they cannot buy. The failure mode is
// not one bad sentence: it is twenty-two pages each making their own decision
// about how strongly to word it, and the third one quietly saying "order
// yours". So the state, the labels and the CTAs are declared here once, and
// pages import them. A page cannot imply the terminal has launched without
// editing this file, which is the point.
//
// SOFTWARE AND HARDWARE ARE SEPARATE STATES. The POS runs today; the reader
// does not. `PRODUCT_PREVIEW_LABEL` below is the software half — unbuilt or
// unverified POS functionality shown in a screenshot — and it is deliberately
// NOT the same string as the terminal label, because a floor-plan preview says
// nothing about whether we can take a card.

/**
 * Lifecycle of the physical payment terminal.
 *
 * Only "coming-soon" is reachable today. The union exists so that turning the
 * hardware on later is a one-line change here with a compiler error at every
 * site that assumed otherwise — rather than a search-and-replace across the
 * marketing tree.
 */
export type TerminalState = "coming-soon" | "limited-availability" | "available";

export const TERMINAL_STATE: TerminalState = "coming-soon";

/**
 * True only when hardware can actually be obtained. Nothing in the UI may show
 * a buy path while this is false.
 *
 * Written through a function rather than inline, because TypeScript narrows an
 * annotated const to its literal at the declaration and then calls
 * `TERMINAL_STATE === "available"` an impossible comparison. A parameter is not
 * narrowed, so the check stays real for the day the state changes.
 */
function stateIsAvailable(state: TerminalState): boolean {
  return state === "available";
}

export const TERMINAL_IS_AVAILABLE: boolean = stateIsAvailable(TERMINAL_STATE);

/**
 * The approved status strings, copied exactly from the handoff's
 * CONTENT-AND-LAUNCH-RULES.md. Do not reword these at a call site.
 */
export const TERMINAL_COPY = {
  /** Goes beside EVERY reader image — hero, cards, mobile, all of it. */
  imageLabel: "Payment terminal · Coming soon",
  /** Short form, for a chip that already sits under a "Payment terminal" heading. */
  shortLabel: "Coming soon",
  /** The plain-language disclosure that sits under the hero CTAs. */
  note: "Terminal hardware is not yet available.",
  /** Same, with the next step attached. */
  noteWithContact: "Terminal hardware is not yet available. Contact us for updates.",
  /** Market caveat — plans, currencies and payment options are not universal. */
  marketNote: "Plans, currencies and payment options vary by market. Contact us to confirm availability.",
  /**
   * The caption that sits UNDER the terminal photograph, in the same <figure>.
   *
   * ASSET-CATALOG.md makes this mandatory beside every use of
   * 07-terminal-concept.jpg: the label says the product is unreleased, and this
   * says the picture itself is not the product. Nothing is burned into the JPG,
   * so if this string is missing the page is making a hardware claim.
   */
  conceptCaption: "Concept image. Terminal hardware is not yet available.",
  /**
   * The caption for 03-tablet-counter.jpg. Its on-screen menu is a rendered
   * concept, not a capture of Surge, so a reader must not take the screen as a
   * screenshot of shipping software.
   */
  illustrativePreview: "Illustrative product preview",
} as const;

/**
 * The only two CTA labels allowed to point at the terminal.
 *
 * Purchase, preorder, reserve, waitlist-with-a-date and delivery language are
 * all forbidden while TERMINAL_IS_AVAILABLE is false — see
 * `assertNoPurchaseLanguage` below for the list this is checked against.
 */
export const TERMINAL_CTA = {
  updates: "Get terminal updates",
  availability: "Ask about availability",
} as const;

/**
 * Where a terminal CTA goes.
 *
 * /contact, NOT a new route and NOT a new endpoint. The contact form posts to
 * `submitContact` in app/(marketing)/actions.ts, which already carries zod
 * validation, the honeypot, the shared 5-sends-per-IP-per-hour throttle and a
 * checked sendEmail. A separate "terminal updates" form would be a second
 * unauthenticated mail path on the domain that carries merchant receipts, i.e.
 * an open relay with a nicer label. The query string only preselects the
 * subject; the server ignores it.
 */
export const TERMINAL_CTA_HREF = "/contact?topic=terminal";

/** The `topic` value the contact form recognises. Kept here so the link and the form cannot drift. */
export const TERMINAL_TOPIC = "terminal";

/** Prefilled message body when a visitor arrives from a terminal CTA. Editable — it is a starting point, not a lock. */
export const TERMINAL_TOPIC_MESSAGE =
  "I would like updates on the Surge payment terminal — when it will be available and whether it will work in my market.";

/**
 * Words that may not appear in copy attached to the terminal while it is
 * unavailable. Exported so a future check (a test, a lint rule, a CMS guard)
 * has one list to read rather than a reviewer's memory.
 */
export const FORBIDDEN_TERMINAL_WORDS = [
  "buy",
  "purchase",
  "preorder",
  "pre-order",
  "order now",
  "add to cart",
  "in stock",
  "ships",
  "shipping",
  "delivery",
  "reserve yours",
] as const;

/**
 * True when a candidate string would imply the terminal can be obtained.
 * Case-insensitive, substring match — deliberately blunt, because a false
 * positive costs a reworded sentence and a false negative costs a promise we
 * cannot keep.
 */
export function impliesTerminalPurchase(text: string): boolean {
  if (TERMINAL_IS_AVAILABLE) return false;
  const haystack = text.toLowerCase();
  return FORBIDDEN_TERMINAL_WORDS.some((w) => haystack.includes(w));
}

/**
 * The label for software functionality that is designed but not verified as
 * shipped. Separate from the terminal state on purpose: a floor-plan mockup is
 * a claim about the POS, not about the card reader.
 */
export const PRODUCT_PREVIEW_LABEL = "Product preview";

/**
 * Shown under a product preview so a reader knows the numbers in it are
 * illustrative. The handoff is explicit that generated UI "should not dictate
 * exact amounts, calculations or data".
 */
export const PRODUCT_PREVIEW_NOTE = "Interface preview with sample data.";
