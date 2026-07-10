import type { createClient } from "@/lib/supabase/server";

// GAP-2.1: conversational analytics ("ask your data") — the SAFE core. The LLM
// never sees the database and never writes SQL. It only maps a plain-English
// question to a constrained QuerySpec from the whitelist below; this module
// validates the spec and runs a fixed, business-scoped aggregation. All numbers
// come from real, RLS-safe queries — the model only chooses what to ask.

export const METRICS = ["net_sales", "gross_sales", "order_count", "items_sold", "avg_check", "tips", "discounts"] as const;
export const DIMENSIONS = ["none", "item", "category", "day", "weekday", "hour", "daypart", "channel"] as const;
export const DAYPARTS = ["breakfast", "lunch", "dinner", "late"] as const;

export type Metric = (typeof METRICS)[number];
export type Dimension = (typeof DIMENSIONS)[number];
export type Daypart = (typeof DAYPARTS)[number];

export type QuerySpec = {
  metric: Metric;
  dimension: Dimension;
  start: string; // YYYY-MM-DD inclusive (business timezone)
  end: string; // YYYY-MM-DD inclusive
  daypart?: Daypart | null;
  channel?: string | null; // instore | online | qr | kiosk | doordash | ubereats | grubhub
  sort?: "desc" | "asc";
  limit?: number;
};

const METRIC_LABEL: Record<Metric, string> = {
  net_sales: "Net sales (pre-tax)", gross_sales: "Gross sales", order_count: "Orders",
  items_sold: "Items sold", avg_check: "Average check", tips: "Tips", discounts: "Discounts",
};
const MONEY_METRICS = new Set<Metric>(["net_sales", "gross_sales", "avg_check", "tips", "discounts"]);

export function metricLabel(m: Metric): string { return METRIC_LABEL[m]; }
export function isMoneyMetric(m: Metric): boolean { return MONEY_METRICS.has(m); }

// The schema description handed to the LLM so it knows the allowed vocabulary.
export function schemaPrompt(todayISO: string, tz: string): string {
  return [
    "You translate a restaurant owner's plain-English question into a JSON query spec.",
    "Return ONLY this JSON shape, no markdown:",
    '{ "metric": <metric>, "dimension": <dimension>, "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "daypart": <daypart|null>, "channel": <channel|null>, "sort": "desc"|"asc", "limit": <1-50> }',
    "",
    "metric ∈ " + METRICS.join(", ") + ".",
    "dimension ∈ " + DIMENSIONS.join(", ") + " (use 'none' for a single total; 'item'/'category' break down by menu item/section).",
    "daypart ∈ " + DAYPARTS.join(", ") + " or null (breakfast=5-11h, lunch=11-16h, dinner=16-22h, late=22-5h).",
    "channel ∈ instore, online, qr, kiosk, doordash, ubereats, grubhub, or null for all.",
    "start/end are inclusive calendar dates in the business timezone (" + tz + "). Today is " + todayISO + ".",
    "Resolve relative dates ('last Friday', 'this month', 'yesterday') to explicit start/end. A single day has start=end.",
    "If the question asks for 'top'/'best', set sort=desc; 'worst'/'slowest' sort=asc. Default limit 10 for breakdowns.",
    "If a question can't be answered with this vocabulary, choose the closest valid spec.",
  ].join("\n");
}

// Validate + clamp an LLM-produced spec into a safe QuerySpec, or null if unusable.
export function validateSpec(raw: unknown): QuerySpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const metric = (METRICS as readonly string[]).includes(o.metric as string) ? (o.metric as Metric) : null;
  const dimension = (DIMENSIONS as readonly string[]).includes(o.dimension as string) ? (o.dimension as Dimension) : "none";
  if (!metric) return null;
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const start = typeof o.start === "string" && dateRe.test(o.start) ? o.start : null;
  const end = typeof o.end === "string" && dateRe.test(o.end) ? o.end : null;
  if (!start || !end) return null;
  const daypart = (DAYPARTS as readonly string[]).includes(o.daypart as string) ? (o.daypart as Daypart) : null;
  const channel = typeof o.channel === "string" && o.channel.trim() ? o.channel.trim().toLowerCase().slice(0, 20) : null;
  const sort: "desc" | "asc" = o.sort === "asc" ? "asc" : "desc";
  let limit = typeof o.limit === "number" && isFinite(o.limit) ? Math.floor(o.limit) : 10;
  limit = Math.max(1, Math.min(50, limit));
  // Guard the window to at most ~13 months.
  if (new Date(end).getTime() - new Date(start).getTime() > 400 * 86400000) return null;
  return { metric, dimension, start, end, daypart, channel, sort, limit };
}

const DAYPART_HOURS: Record<Daypart, (h: number) => boolean> = {
  breakfast: (h) => h >= 5 && h < 11,
  lunch: (h) => h >= 11 && h < 16,
  dinner: (h) => h >= 16 && h < 22,
  late: (h) => h >= 22 || h < 5,
};
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type AnalyticsResult = {
  metric: Metric;
  metricLabel: string;
  isMoney: boolean;
  dimension: Dimension;
  scalar: number | null; // for dimension 'none'
  rows: { label: string; value: number }[]; // for breakdowns
  spec: QuerySpec;
};

// Execute a validated spec against the business's own data (RLS-scoped). Mirrors
// the Insights aggregations: fetch the window, filter in the business timezone,
// then group. Read-only.
export async function runAnalytics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  tz: string,
  spec: QuerySpec
): Promise<AnalyticsResult> {
  const startIso = new Date(spec.start + "T00:00:00Z").toISOString();
  const endIso = new Date(new Date(spec.end + "T00:00:00Z").getTime() + 86400000).toISOString();

  // Orders in the window. Channel column may not exist pre-0071 → fall back.
  const ordersBase = (cols: string) =>
    supabase.from("orders").select(cols).eq("business_id", businessId).neq("status", "voided").gte("created_at", startIso).lt("created_at", endIso);
  const withCh = await ordersBase("id, total, subtotal, tip, discount, created_at, channel");
  const orders = (withCh.error ? (await ordersBase("id, total, subtotal, tip, discount, created_at")).data : withCh.data) as Record<string, unknown>[] | null;

  const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const dowFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });

  const hourOf = (iso: string) => Number(hourFmt.format(new Date(iso))) % 24;
  const matchesFilters = (o: Record<string, unknown>): boolean => {
    if (spec.daypart) { if (!DAYPART_HOURS[spec.daypart](hourOf(o.created_at as string))) return false; }
    if (spec.channel) {
      const ch = ((o.channel as string | null) || "instore").toLowerCase();
      if (ch !== spec.channel) return false;
    }
    return true;
  };
  const live = (orders ?? []).filter(matchesFilters);
  const liveIds = new Set(live.map((o) => o.id as string));

  const isMoney = isMoneyMetric(spec.metric);
  const label = metricLabel(spec.metric);

  // Item / category dimensions read order_items for the matched orders.
  if (spec.dimension === "item" || spec.dimension === "category") {
    const rows: { label: string; value: number }[] = [];
    if (liveIds.size > 0) {
      const ids = Array.from(liveIds);
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, name, quantity, unit_price, catalog_item_id")
        .eq("business_id", businessId)
        .in("order_id", ids);
      let catById: Record<string, string> = {};
      if (spec.dimension === "category") {
        const catIds = Array.from(new Set((items ?? []).map((i) => i.catalog_item_id as string | null).filter((x): x is string => !!x)));
        if (catIds.length > 0) {
          const { data: cats } = await supabase.from("catalog_items").select("id, category").eq("business_id", businessId).in("id", catIds);
          catById = Object.fromEntries((cats ?? []).map((c) => [c.id as string, (c.category as string | null) || "Uncategorized"]));
        }
      }
      const agg = new Map<string, number>();
      for (const it of items ?? []) {
        if (!liveIds.has(it.order_id as string)) continue;
        const key = spec.dimension === "category"
          ? (it.catalog_item_id ? catById[it.catalog_item_id as string] ?? "Uncategorized" : "Uncategorized")
          : (it.name as string) || "Item";
        const qty = Number(it.quantity) || 0;
        // items_sold counts units; money metrics use line revenue.
        const v = isMoney ? (Number(it.unit_price) || 0) * qty : qty;
        agg.set(key, (agg.get(key) ?? 0) + v);
      }
      for (const [k, v] of agg) rows.push({ label: k, value: Math.round(v * 100) / 100 });
    }
    rows.sort((a, b) => (spec.sort === "asc" ? a.value - b.value : b.value - a.value));
    return { metric: spec.metric, metricLabel: isMoney ? label : "Items sold", isMoney, dimension: spec.dimension, scalar: null, rows: rows.slice(0, spec.limit), spec };
  }

  // Order-level metric for a single order. items_sold falls back to revenue here.
  const orderValue = (o: Record<string, unknown>): number => {
    switch (spec.metric) {
      case "net_sales": return Number(o.subtotal) || 0;
      case "gross_sales": return Number(o.total) || 0;
      case "tips": return Number(o.tip) || 0;
      case "discounts": return Number(o.discount) || 0;
      default: return Number(o.total) || 0; // order_count/avg_check/items_sold handled below
    }
  };

  // Build a bucket key for a given order under the chosen dimension.
  const bucketOf = (o: Record<string, unknown>): string | null => {
    const iso = o.created_at as string;
    switch (spec.dimension) {
      case "day": return dayFmt.format(new Date(iso));
      case "weekday": return dowFmt.format(new Date(iso));
      case "hour": { const h = hourOf(iso); return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? "am" : "pm"); }
      case "daypart": { const h = hourOf(iso); return (DAYPARTS.find((d) => DAYPART_HOURS[d](h)) ?? "other"); }
      case "channel": return ((o.channel as string | null) || "instore").toLowerCase();
      default: return null;
    }
  };

  const computeMetric = (group: Record<string, unknown>[]): number => {
    if (spec.metric === "order_count") return group.length;
    if (spec.metric === "avg_check") return group.length ? Math.round((group.reduce((s, o) => s + (Number(o.total) || 0), 0) / group.length) * 100) / 100 : 0;
    if (spec.metric === "items_sold") return Math.round(group.reduce((s, o) => s + orderValue(o), 0) * 100) / 100; // approx via revenue when no item join
    return Math.round(group.reduce((s, o) => s + orderValue(o), 0) * 100) / 100;
  };

  if (spec.dimension === "none") {
    return { metric: spec.metric, metricLabel: label, isMoney, dimension: "none", scalar: computeMetric(live), rows: [], spec };
  }

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const o of live) {
    const k = bucketOf(o);
    if (k == null) continue;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(o);
  }
  const rows = Array.from(groups.entries()).map(([k, g]) => ({ label: k, value: computeMetric(g) }));
  if (spec.dimension === "weekday") rows.sort((a, b) => WEEKDAYS.indexOf(a.label) - WEEKDAYS.indexOf(b.label));
  else rows.sort((a, b) => (spec.sort === "asc" ? a.value - b.value : b.value - a.value));
  return { metric: spec.metric, metricLabel: label, isMoney, dimension: spec.dimension, scalar: null, rows: rows.slice(0, spec.limit), spec };
}
