// E1 happy-hour pricing — pure resolution helpers shared by the register and the
// management UI. A window matches an item by item-id or category, on the right
// weekday, within its local-time window (overnight windows wrap past midnight).
// Highest priority wins; item-scoped beats category-scoped on a tie.

export type PriceWindow = {
  id: string;
  name: string;
  scope: "item" | "category";
  targetItemId: string | null;
  targetCategory: string | null;
  days: number[]; // 0=Sun..6=Sat; empty = every day
  startMin: number;
  endMin: number;
  mode: "price" | "percent";
  value: number;
  priority: number;
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function inWindow(win: PriceWindow, weekday: number, minute: number): boolean {
  if (win.days.length > 0 && !win.days.includes(weekday)) return false;
  if (win.startMin === win.endMin) return true; // all day
  if (win.endMin > win.startMin) return minute >= win.startMin && minute < win.endMin;
  return minute >= win.startMin || minute < win.endMin; // overnight wrap
}

export function resolveWindow(
  windows: PriceWindow[],
  item: { id: string; category: string | null },
  weekday: number,
  minute: number
): PriceWindow | null {
  let best: PriceWindow | null = null;
  for (const w of windows) {
    const matches =
      (w.scope === "item" && w.targetItemId === item.id) ||
      (w.scope === "category" && !!w.targetCategory && (item.category || "") === w.targetCategory);
    if (!matches || !inWindow(w, weekday, minute)) continue;
    if (
      best == null ||
      w.priority > best.priority ||
      (w.priority === best.priority && w.scope === "item" && best.scope === "category")
    ) {
      best = w;
    }
  }
  return best;
}

// Map a DB row to a PriceWindow (used by the register loader + management UI).
export function rowToWindow(r: Record<string, unknown>): PriceWindow {
  return {
    id: r.id as string,
    name: (r.name as string) || "Happy hour",
    scope: (r.scope as string) === "category" ? "category" : "item",
    targetItemId: (r.target_item_id as string | null) ?? null,
    targetCategory: (r.target_category as string | null) ?? null,
    days: Array.isArray(r.days) ? (r.days as unknown[]).map((d) => Number(d)) : [],
    startMin: Number(r.start_min) || 0,
    endMin: Number(r.end_min) || 0,
    mode: (r.mode as string) === "price" ? "price" : "percent",
    value: Number(r.value) || 0,
    priority: Number(r.priority) || 0,
  };
}

// Apply a window to a base price (the item/variation base, before modifiers).
export function windowPrice(base: number, win: PriceWindow): number {
  const p = win.mode === "price" ? win.value : base * (1 - (Number(win.value) || 0) / 100);
  return Math.max(0, r2(p));
}
