// Money, rendered and tendered, in whatever currency the merchant actually uses.
//
// WHY THIS EXISTS. Surge stored `businesses.currency` and offered a picker for
// it, and then the till ignored it completely: `currency` appeared nowhere in
// pos/page.tsx, register-client.tsx or tender-sheet.tsx, the printed receipt was
// `"$" + n.toFixed(2)`, and the cash pad suggested $20 / $50 / $100 notes as
// hardcoded integers. A merchant could set their currency and watch every screen
// contradict it. The accounting section had been doing it correctly with
// Intl.NumberFormat the whole time; the register simply never adopted the
// pattern.
//
// It lives in the shared package because both clients render money, which is the
// same argument that put DELIVERY_CHANNELS and isStoolSeat here — and the same
// failure mode if it doesn't: three copies that drift, and you find out from a
// merchant.

/**
 * How many decimal places this currency's minor unit has.
 *
 * Asked of Intl rather than kept in a table, because a table is a thing to get
 * wrong and this question already has a correct answer built into the platform.
 * JPY is 0, KWD is 3, most are 2 — and a hand-maintained list would have said 2
 * for all of them.
 */
const decimalsCache = new Map<string, number>();
export function currencyDecimals(currency: string): number {
  const code = (currency || "CAD").toUpperCase();
  const hit = decimalsCache.get(code);
  if (hit !== undefined) return hit;
  let d = 2;
  try {
    d = new Intl.NumberFormat("en-US", { style: "currency", currency: code })
      .resolvedOptions().minimumFractionDigits ?? 2;
  } catch {
    d = 2; // unknown code — behave like an ordinary two-decimal currency
  }
  decimalsCache.set(code, d);
  return d;
}

/**
 * How many minor units make one major unit: 100 for dollars, 1 for yen.
 *
 * The tender sheet counts keystrokes in minor units ("cents"), so a zero-decimal
 * currency would otherwise make the numpad enter ¥1 as ¥0.01 and compute change
 * a hundred times too small.
 */
export function minorUnits(currency: string): number {
  return Math.pow(10, currencyDecimals(currency));
}

/**
 * "$85.81" / "Rs 85.81" / "¥86".
 *
 * `narrowSymbol` on purpose: the default display renders CAD as "CA$85.81",
 * which is correct for an accounting export and wrong on a till in Canada where
 * every price tag in the room says "$". The narrow symbol is what the merchant's
 * own printed menu uses.
 */
export function formatMoney(amount: number, currency = "CAD"): string {
  const n = Number(amount) || 0;
  const code = (currency || "CAD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    })
      .format(n)
      // Intl separates a multi-character symbol from the number with a
      // NON-BREAKING space (U+00A0), and sometimes a narrow one (U+202F). That
      // is correct typography and a liability here: this string goes to a
      // thermal printer and into a QR-menu page, and a receipt printer that
      // does not know U+00A0 prints a black box in the middle of the total.
      // Normalise to the plain space every printer agrees on.
      .replace(/[  ]/g, " ");
  } catch {
    // An unrecognised code should still print a number rather than throw
    // inside a render and take the register down.
    return code + " " + n.toFixed(2);
  }
}

/**
 * Note denominations a guest might actually hand over, in MAJOR units.
 *
 * Only currencies we can sensibly claim to know. Anything else falls back to the
 * generic ladder, which is right for most decimal currencies and never absurd.
 *
 * Small values that exist only as coins are included where they are a normal
 * thing to round up to — a guest settling an 85.81 bill with 86 is the single
 * most common cash rounding there is, and it is the suggestion our old
 * hardcoded list was missing.
 */
export const CASH_NOTES: Record<string, number[]> = {
  CAD: [1, 5, 10, 20, 50, 100],
  USD: [1, 5, 10, 20, 50, 100],
  AUD: [1, 5, 10, 20, 50, 100],
  NZD: [1, 5, 10, 20, 50, 100],
  SGD: [1, 5, 10, 20, 50, 100],
  GBP: [1, 5, 10, 20, 50],
  EUR: [1, 5, 10, 20, 50, 100, 200],
  // Sri Lanka: 20/50/100/500/1000/5000 notes. The old hardcoded 2000/5000/10000
  // CENTS would have offered this merchant 20, 50 and 100 rupees on a 3,480
  // rupee bill — three suggestions all smaller than the total.
  LKR: [20, 50, 100, 500, 1000, 5000],
  INR: [10, 20, 50, 100, 200, 500],
  AED: [5, 10, 20, 50, 100, 200],
  ZAR: [10, 20, 50, 100, 200],
  PHP: [20, 50, 100, 200, 500, 1000],
  MYR: [1, 5, 10, 20, 50, 100],
  JPY: [100, 500, 1000, 5000, 10000],
};

const GENERIC_NOTES = [1, 5, 10, 20, 50, 100];

export function cashNotes(currency: string): number[] {
  return CASH_NOTES[(currency || "CAD").toUpperCase()] ?? GENERIC_NOTES;
}

/**
 * What to put on the quick-tender buttons, in MAJOR units, cheapest first.
 *
 * Rounds the total up to each note value in turn and keeps the distinct results
 * that are strictly more than the total. For 85.81 in CAD that is 86, 90, 100 —
 * which is exactly what TouchBistro shows for the same bill, arrived at from the
 * note values rather than from a hardcoded list, so it stays right in a currency
 * they never considered.
 *
 * Excludes the total itself: the caller renders that as "Exact", and a button
 * labelled "$85.81" sitting next to one labelled "Exact" is the same button
 * twice.
 */
export function cashSuggestions(total: number, currency = "CAD", max = 3): number[] {
  const t = Number(total) || 0;
  if (t <= 0) return [];
  const dp = currencyDecimals(currency);
  const round = (v: number) => Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp);
  const out: number[] = [];
  for (const note of cashNotes(currency)) {
    const up = round(Math.ceil(round(t) / note) * note);
    if (up > t && out.indexOf(up) === -1) out.push(up);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Currencies the settings picker offers.
 *
 * It used to be ["CAD", "USD"] — two North American currencies, in a product
 * positioned for operators anywhere, with a Sri Lanka pilot as the next move.
 * A merchant whose currency is missing could not select it at all.
 */
export const SUPPORTED_CURRENCIES: readonly string[] = [
  "CAD", "USD", "LKR", "GBP", "EUR", "AUD", "NZD", "SGD", "INR", "AED", "ZAR", "PHP", "MYR", "JPY",
];
