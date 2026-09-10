// Is this business actually ready to take real money?
//
// The answer used to live inline in app/app/go-live/page.tsx, which was fine
// while exactly one screen asked the question. The dashboard now asks it too —
// for a merchant who hasn't finished setup, "what's left before I can sell" is
// genuinely the most useful thing the home page can say, more useful than a
// row of zeroes. Two copies of the rule would drift within a release, and the
// failure mode is nasty in both directions: a dashboard that says "ready" over
// a go-live page that says "3 items left", or vice versa.
//
// So the checks live here and both screens read the same list. The go-live page
// still owns the *rendering* — it has confirm buttons and legal copy that have
// no business on a dashboard. This module only answers what is done.
//
// DELIBERATELY NOT HERE: staff PINs, floor plan, printers. Those are real setup
// steps, but they have never been part of the go-live gate, and quietly adding
// them would start blocking merchants who are live today. Widening the gate is
// a product decision, not a refactor.

export type ReadinessCheckId =
  | "basics"
  | "catalog"
  | "tax"
  | "payments"
  | "register"
  | "legal";

export type ReadinessCheck = {
  id: ReadinessCheckId;
  /** Short label, sentence case. */
  title: string;
  /** One line: what's true now, or what to do about it. */
  detail: string;
  done: boolean;
  /** True when this check gates going live. `basics` is informational only. */
  required: boolean;
  /** Where the merchant finishes it. */
  href: string;
};

export type ReadinessReport = {
  checks: ReadinessCheck[];
  /** Only the required checks that are still outstanding. */
  outstanding: ReadinessCheck[];
  requiredDone: number;
  requiredTotal: number;
  /** True once every required check passes. */
  ready: boolean;
};

/** The raw facts the checks are computed from, so this stays pure and testable. */
export type ReadinessFacts = {
  name: string | null | undefined;
  /** businesses.default_tax_rate — stored as either a fraction or a percent. */
  defaultTaxRate: number | string | null | undefined;
  /** businesses.finix_merchant_state — "APPROVED" means cards are live. */
  finixMerchantState: string | null | undefined;
  /** businesses.go_live jsonb; null/absent on a fresh business. */
  goLive: unknown;
  /** Count of catalog_items where is_active. */
  activeItemCount: number;
  /** Count of drawer_sessions ever opened — not just currently-open ones. */
  drawerSessionCount: number;
};

function flag(goLive: unknown, key: string): boolean {
  if (!goLive || typeof goLive !== "object") return false;
  return (goLive as Record<string, unknown>)[key] === true;
}

/**
 * default_tax_rate is stored ambiguously across tenants — some rows hold 0.13,
 * others hold 13. Both mean the same thing, so display normalizes rather than
 * migrating live tax data.
 */
export function taxRatePercent(raw: number | string | null | undefined): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0"));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1 ? n : n * 100;
}

export function evaluateReadiness(facts: ReadinessFacts): ReadinessReport {
  const nameSet = Boolean(facts.name && String(facts.name).trim().length > 0);

  const items = Math.max(0, Math.floor(Number(facts.activeItemCount) || 0));
  const catalogDone = items > 0;

  const percent = taxRatePercent(facts.defaultTaxRate);
  const taxFree = flag(facts.goLive, "tax_free");
  const taxDone = percent > 0 || taxFree;

  const cardApproved =
    String(facts.finixMerchantState ?? "").toUpperCase() === "APPROVED";
  const cashOnly = flag(facts.goLive, "cash_only");
  const paymentsDone = cardApproved || cashOnly;

  const drawers = Math.max(0, Math.floor(Number(facts.drawerSessionCount) || 0));
  const registerDone = drawers > 0;

  const legalDone = flag(facts.goLive, "legal_accepted");

  const checks: ReadinessCheck[] = [
    {
      id: "basics",
      title: "Business basics",
      detail: nameSet ? "Name set." : "Set your business name.",
      done: nameSet,
      // Informational: the go-live page has always shown this row without
      // counting it, because a business with no name can't have been created.
      required: false,
      href: "/app/settings",
    },
    {
      id: "catalog",
      title: "Menu & items",
      detail: catalogDone
        ? items + " active item" + (items === 1 ? "" : "s") + "."
        : "Add at least one item to sell.",
      done: catalogDone,
      required: true,
      href: "/app/catalog",
    },
    {
      id: "tax",
      title: "Tax",
      detail:
        percent > 0
          ? "Rate set (" + Math.round(percent * 100) / 100 + "%)."
          : taxFree
            ? "Marked tax-free."
            : "Set a tax rate, or confirm you don't charge tax.",
      done: taxDone,
      required: true,
      href: "/app/go-live",
    },
    {
      id: "payments",
      title: "Card payments",
      detail: cardApproved
        ? "Approved — card payments are active."
        : cashOnly
          ? "Cash-only for now (cards not connected)."
          : "Connect card processing, or confirm cash only for now.",
      done: paymentsDone,
      required: true,
      href: "/app/go-live",
    },
    {
      id: "register",
      title: "Open the register",
      detail: registerDone
        ? "A drawer session has been opened."
        : "Open a cash drawer once so you're ready to ring sales.",
      done: registerDone,
      required: true,
      href: "/app/pos",
    },
    {
      id: "legal",
      title: "Legal & agreements",
      detail: legalDone
        ? "Agreements accepted."
        : "Review and accept the service agreement and payment disclosure.",
      done: legalDone,
      required: true,
      href: "/app/go-live",
    },
  ];

  const required = checks.filter((c) => c.required);
  const outstanding = required.filter((c) => !c.done);

  return {
    checks,
    outstanding,
    requiredDone: required.length - outstanding.length,
    requiredTotal: required.length,
    ready: outstanding.length === 0,
  };
}
