// Shared shapes + pure helpers for the menu builder.
//
// Lives in its own module so the server page, the builder shell and the edit
// panel can agree on one Item type without importing each other (the panel and
// the shell would otherwise be a cycle).

import type { ModGroup } from "./modifier-groups-editor";
import type { AvailabilityWindow } from "../settings/availability-actions";

export type Option = { id: string; name: string; price: number };
export type TaxRate = { id: string; name: string; rate: number };
export type CourseOption = { id: string; name: string };
export type StationOption = { id: string; name: string };

export type Item = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  is_active: boolean;
  taxable: boolean;
  tax_rate_id: string | null;
  tax_rate_ids: string[];
  barcode: string | null;
  image_url: string | null;
  out_of_stock: boolean;
  out_of_stock_at?: string | null;
  allergens?: string[] | null;
  prep_minutes?: number | null;
  default_course_id: string | null;
  station_id: string | null;
  sales_category: string | null;
  short_name: string | null;
  open_price: boolean;
  requires_manager_approval: boolean;
  allow_returns: boolean;
  print_separate_ticket: boolean;
  variations: Option[];
  modifiers: Option[];
  modifierGroups: ModGroup[];
};

/**
 * The key the category rail uses for "items with no category".
 *
 * A sentinel rather than `null`, because the rail's selection is a single
 * string and `""` is a legal-looking category name a merchant could type. The
 * delimiters make a collision with a real category effectively impossible, and
 * the worst case if someone does type it is cosmetic: their category and the
 * uncategorised bucket would share a row.
 */
export const NO_CATEGORY = "::uncategorised::";

/** Every non-empty category on the menu, alphabetical. */
export function categoriesOf(items: Item[]): string[] {
  return Array.from(
    new Set(items.map((i) => (i.category || "").trim()).filter((c) => c.length > 0))
  ).sort((a, b) => a.localeCompare(b));
}

export function itemsInCategory(items: Item[], key: string | null): Item[] {
  if (key === null) return items;
  if (key === NO_CATEGORY) return items.filter((i) => !(i.category || "").trim());
  return items.filter((i) => (i.category || "").trim() === key);
}

/**
 * THREE states, not the mockup's two.
 *
 * `is_active` (does this appear on the register at all) and `out_of_stock` (is
 * it 86'd right now) are independent columns that answer different questions,
 * and collapsing them into one Available/Sold-out pill would make a hidden item
 * and a sold-out item indistinguishable — which is exactly the confusion an
 * 86 board exists to prevent. Sold-out wins when both are set, because that is
 * the one with a clock on it.
 */
export type ItemStatus = "available" | "sold_out" | "hidden";

export function statusOf(item: Item): ItemStatus {
  if (item.out_of_stock) return "sold_out";
  if (!item.is_active) return "hidden";
  return "available";
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  available: "Available",
  sold_out: "Sold out",
  hidden: "Hidden",
};

/** Price, in the merchant's own currency symbol-less convention (as the rest of the app). */
export function money(value: number): string {
  return "$" + (Number.isFinite(value) ? value : 0).toFixed(2);
}

/**
 * "Required · Select 1" / "Optional · Up to 4" — the mockup's modifier summary,
 * generated from the real required/min_select/max_select columns rather than
 * written out by hand.
 */
export function describeGroup(g: ModGroup): string {
  const head = g.required ? "Required" : "Optional";
  if (g.max_select !== null && g.max_select === g.min_select) {
    return head + " · Select " + g.max_select;
  }
  if (g.max_select !== null) {
    return head + " · Up to " + g.max_select;
  }
  if (g.min_select > 0) return head + " · At least " + g.min_select;
  return head + " · Any number";
}

// Local copy of the settings card's window formatter. Six lines, and the
// original lives beside a "use server" module that cannot export sync helpers —
// duplicating them is cheaper than a third file, and neither copy can drift in
// a way that matters (they format the same two integers).
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hhmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

export function summarizeWindow(w: AvailabilityWindow): string {
  const days =
    w.days.length === 0
      ? "Every day"
      : w.days.slice().sort().map((d) => DAY_NAMES[d]).join(", ");
  return days + " · " + hhmm(w.start_min) + "–" + hhmm(w.end_min);
}

/** Windows that gate this item — its own, plus any on its category. */
export function windowsForItem(
  windows: AvailabilityWindow[],
  item: Item
): AvailabilityWindow[] {
  const cat = (item.category || "").trim();
  return windows.filter(
    (w) =>
      (w.scope === "item" && w.target_item_id === item.id) ||
      (w.scope === "category" && cat.length > 0 && w.target_category === cat)
  );
}
