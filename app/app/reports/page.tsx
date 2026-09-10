import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness, listBusinesses } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { displayItemName } from "@/lib/format";
import { ExportButton } from "./export-button";
import { reasonLabel, reasonLabelForAction, COMP_REASONS } from "../pos/reason-codes";

type OrderRow = {
  id: string;
  sale_number: number | null;
  created_at: string;
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string;
  status: string;
  staff_id: string | null;
  channel: ChannelKey;
};

// Fulfillment channel. Two fields feed it and neither alone is enough:
// `orders.channel` is populated only for third-party / online orders, while an
// order rung in-house carries dining_option inside the SNAPSHOT (there is no
// dining_option column — see lib/services/order-fulfill.ts). Anything with
// neither is a counter sale, which is what "In-store" means here.
const CHANNELS = ["dine_in", "takeout", "pickup", "delivery", "in_store"] as const;
type ChannelKey = (typeof CHANNELS)[number];

const CHANNEL_LABEL: Record<ChannelKey, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  pickup: "Pickup",
  delivery: "Delivery",
  in_store: "In-store",
};

function channelOf(o: Record<string, unknown>): ChannelKey {
  const snap = (o.snapshot ?? null) as { dining_option?: string | null } | null;
  const d = (snap?.dining_option ?? "").toLowerCase();
  if (d === "dine_in" || d === "takeout" || d === "pickup" || d === "delivery") return d;
  const c = ((o.channel as string | null) ?? "").toLowerCase();
  if (c.includes("delivery")) return "delivery";
  if (c.includes("pickup")) return "pickup";
  if (c.includes("takeout") || c.includes("togo")) return "takeout";
  return "in_store";
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function money(n: number): string {
  return "$" + n.toFixed(2);
}

function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";

  const sp = await searchParams;
  // A bookkeeper closing August needs Aug 1 - Aug 31, not "last 30 days".
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const customFrom = sp.from && isoDate.test(sp.from) ? sp.from : null;
  const customTo = sp.to && isoDate.test(sp.to) ? sp.to : null;
  const hasCustom = !!(customFrom && customTo && customFrom <= customTo);
  const range = hasCustom
    ? "custom"
    : sp.range === "today" || sp.range === "30d"
      ? sp.range
      : "7d";

  // Show the cross-location link only to owners/managers of more than one business.
  const myBusinesses = await listBusinesses();
  const multiLocation =
    myBusinesses.filter((b) => b.role === "owner" || b.role === "manager").length > 1;

  const rangeLabels: Record<string, string> = {
    today: "Today",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    custom: customFrom + " to " + customTo,
  };

  // Default look-back is 31 days; a custom range may reach further, so the
  // query window has to follow it or the page would silently show nothing.
  const defaultCutoffMs = Date.now() - 31 * 86400000;
  const customStartMs = hasCustom ? new Date(customFrom + "T00:00:00Z").getTime() : null;
  const customEndMs = hasCustom
    ? new Date(customTo + "T00:00:00Z").getTime() + 86400000
    : null;
  const cutoffIso = new Date(
    customStartMs != null ? Math.min(customStartMs, defaultCutoffMs) : defaultCutoffMs
  ).toISOString();
  const { data: ordersData } = await supabase
    .from("orders")
    .select("id, sale_number, created_at, subtotal, discount, tax, tip, total, payment_method, status, staff_id, channel, snapshot")
    .eq("business_id", business.id)
    .neq("is_training", true)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(3000);

  const allOrders: OrderRow[] = (ordersData ?? []).map((o) => ({
    id: o.id as string,
    sale_number: o.sale_number != null ? Number(o.sale_number) : null,
    created_at: o.created_at as string,
    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    tax: Number(o.tax) || 0,
    tip: Number(o.tip) || 0,
    total: Number(o.total) || 0,
    payment_method: (o.payment_method as string | null) ?? "cash",
    status: (o.status as string | null) ?? "paid",
    staff_id: (o.staff_id as string | null) ?? null,
    // Fulfillment channel. `orders.channel` is only set for third-party/online
    // orders; everything rung in-house carries dining_option in the SNAPSHOT
    // (there is no dining_option column — see order-fulfill.ts).
    channel: channelOf(o),
  }));

  const now = Date.now();
  const todayKey = dayKey(new Date().toISOString(), tz);
  // One window definition, reused by the orders filter, the labor query and the
  // audit query — they used to each re-derive it and could disagree.
  const windowStartMs =
    range === "custom" && customStartMs != null
      ? customStartMs
      : range === "today"
        ? new Date(todayKey + "T00:00:00").getTime()
        : range === "7d"
          ? now - 7 * 86400000
          : now - 30 * 86400000;
  const windowEndMs = range === "custom" && customEndMs != null ? customEndMs : Infinity;
  const inRange = (o: OrderRow): boolean => {
    if (range === "today") return dayKey(o.created_at, tz) === todayKey;
    const t = new Date(o.created_at).getTime();
    return t >= windowStartMs && t < windowEndMs;
  };

  const orders = allOrders.filter((o) => o.status !== "voided" && inRange(o));
  const orderIds = orders.map((o) => o.id);

  const count = orders.length;
  const gross = round2(orders.reduce((a, o) => a + o.subtotal, 0));
  const discounts = round2(orders.reduce((a, o) => a + o.discount, 0));
  const tax = round2(orders.reduce((a, o) => a + o.tax, 0));
  const tips = round2(orders.reduce((a, o) => a + o.tip, 0));
  const collected = round2(orders.reduce((a, o) => a + o.total, 0));

  const payTotals: Record<string, number> = { cash: 0, card: 0, gift_card: 0, store_credit: 0, house_account: 0, other: 0 };
  let refunds = 0;
  const itemAgg: Record<string, { name: string; qty: number; revenue: number; catId: string | null }> = {};
  const catAgg: Record<string, { qty: number; revenue: number }> = {};
  // Reporting/tax sales category (food/alcohol/merch), distinct from display category.
  const salesCatAgg: Record<string, { qty: number; revenue: number }> = {};
  // Modifier attach-rate/mix: how often each modifier is chosen, from the order
  // snapshot's structured modifiers. `listRevenue` is the option's MENU LIST value
  // (already inside the line price), NOT reconciled revenue — see lineModifierSchema.
  const modAgg: Record<string, { group: string; name: string; count: number; listRevenue: number }> = {};

  if (orderIds.length > 0) {
    const { data: payData } = await supabase
      .from("payments")
      .select("order_id, method, amount")
      .eq("business_id", business.id)
      .in("order_id", orderIds);
    const paidOrderIds = new Set<string>();
    for (const p of payData ?? []) {
      const m = (p.method as string) || "other";
      const amt = Number(p.amount) || 0;
      paidOrderIds.add(p.order_id as string);
      if (payTotals[m] !== undefined) payTotals[m] += amt;
      else payTotals.other += amt;
    }
    for (const o of orders) {
      if (paidOrderIds.has(o.id)) continue;
      const m = o.payment_method;
      if (payTotals[m] !== undefined) payTotals[m] += o.total;
      else payTotals.other += o.total;
    }

    const { data: refundData } = await supabase
      .from("refunds")
      .select("amount")
      .eq("business_id", business.id)
      .in("order_id", orderIds);
    for (const r of refundData ?? []) {
      refunds += Number(r.amount) || 0;
    }

    const { data: lineData } = await supabase
      .from("order_items")
      .select("catalog_item_id, name, unit_price, quantity")
      .eq("business_id", business.id)
      .in("order_id", orderIds);

    const lines = lineData ?? [];
    const catItemIds = Array.from(
      new Set(
        lines
          .map((l) => l.catalog_item_id as string | null)
          .filter((id): id is string => !!id)
      )
    );
    const catById: Record<string, string | null> = {};
    const salesCatById: Record<string, string | null> = {};
    if (catItemIds.length > 0) {
      const { data: cats } = await supabase
        .from("catalog_items")
        .select("id, category, sales_category")
        .eq("business_id", business.id)
        .in("id", catItemIds);
      for (const c of cats ?? []) {
        catById[c.id as string] = (c.category as string | null) ?? null;
        salesCatById[c.id as string] = (c.sales_category as string | null) ?? null;
      }
    }

    // Modifier mix from the order snapshots (the structured store). Fetched only for
    // the in-range orders, and only the snapshot column, so it's a bounded second read.
    const { data: snapData } = await supabase
      .from("orders")
      .select("id, snapshot")
      .eq("business_id", business.id)
      .in("id", orderIds);
    for (const row of snapData ?? []) {
      const snap = row.snapshot as { items?: Array<{ quantity?: number; modifiers?: Array<{ group_name?: string | null; name?: string; price?: number }> | null }> } | null;
      for (const it of snap?.items ?? []) {
        const q = Number(it.quantity) || 1;
        const mods = it.modifiers;
        if (!Array.isArray(mods)) continue;
        for (const m of mods) {
          if (!m || !m.name) continue;
          const group = (m.group_name || "").trim() || "Other";
          const name = String(m.name);
          const key = group + " " + name;
          if (!modAgg[key]) modAgg[key] = { group, name, count: 0, listRevenue: 0 };
          modAgg[key].count += q;
          modAgg[key].listRevenue += (Number(m.price) || 0) * q;
        }
      }
    }

    for (const l of lines) {
      const cid = (l.catalog_item_id as string | null) ?? null;
      // Collapse split "X (shared)" into "X" so product mix shows one row per item.
      const name = displayItemName(l.name as string);
      const qty = Number(l.quantity) || 0;
      const revenue = (Number(l.unit_price) || 0) * qty;
      const key = cid ? "id:" + cid : "name:" + name;
      if (!itemAgg[key]) itemAgg[key] = { name: name, qty: 0, revenue: 0, catId: cid };
      itemAgg[key].qty += qty;
      itemAgg[key].revenue += revenue;

      // No catalog_item_id = a Custom (one-off) line; show it as "Custom" rather
      // than "Uncategorized" (which is reserved for catalog items lacking a category).
      const catLabel = cid ? catById[cid] || "Uncategorized" : "Custom";
      if (!catAgg[catLabel]) catAgg[catLabel] = { qty: 0, revenue: 0 };
      catAgg[catLabel].qty += qty;
      catAgg[catLabel].revenue += revenue;

      const salesLabel = cid ? salesCatById[cid] || "Uncategorized" : "Custom";
      if (!salesCatAgg[salesLabel]) salesCatAgg[salesLabel] = { qty: 0, revenue: 0 };
      salesCatAgg[salesLabel].qty += qty;
      salesCatAgg[salesLabel].revenue += revenue;
    }
  }

  refunds = round2(refunds);
  const net = round2(collected - refunds);
  const cash = round2(payTotals.cash);
  const card = round2(payTotals.card);
  const giftCard = round2(payTotals.gift_card);
  const storeCredit = round2(payTotals.store_credit);
  const houseAccount = round2(payTotals.house_account);
  const other = round2(payTotals.other);

  const topItems = Object.keys(itemAgg)
    .map((k) => itemAgg[k])
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  const categories = Object.keys(catAgg)
    .map((k) => ({ name: k, qty: catAgg[k].qty, revenue: catAgg[k].revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  const salesCategories = Object.keys(salesCatAgg)
    .map((k) => ({ name: k, qty: salesCatAgg[k].qty, revenue: salesCatAgg[k].revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  // Only show the sales-category card once at least one item has a real sales
  // category set (otherwise it's all "Uncategorized"/"Custom" and adds noise).
  const hasSalesCategories = salesCategories.some((c) => c.name !== "Uncategorized" && c.name !== "Custom");

  const topModifiers = Object.values(modAgg)
    .sort((a, b) => b.count - a.count || b.listRevenue - a.listRevenue)
    .slice(0, 20);
  const hasModifiers = topModifiers.length > 0;

  // P1-23: per-server sales (full service). Each server's net sales, tips,
  // order count and average check, from the order's attributed staff_id.
  const showServers = hasFloorService(business);
  type ServerAgg = { staffId: string; name: string; count: number; sales: number; tips: number; hours: number };
  let servers: ServerAgg[] = [];
  if (showServers) {
    const agg: Record<string, { count: number; sales: number; tips: number }> = {};
    // Sales with no attributed staff_id are bucketed as "Unassigned" rather than
    // dropped, so the totals reconcile and unattributed sales are visible.
    const UNASSIGNED = "__unassigned__";
    for (const o of orders) {
      const sid = o.staff_id || UNASSIGNED;
      if (!agg[sid]) agg[sid] = { count: 0, sales: 0, tips: 0 };
      agg[sid].count += 1;
      agg[sid].sales += o.subtotal;
      agg[sid].tips += o.tip;
    }

    // P1-24 labor: clocked hours per staff in the same range. A shift counts
    // toward the range if it clocked in within it; open shifts count up to now.
    const rangeStartMs = windowStartMs;
    const hoursByStaff: Record<string, number> = {};
    const { data: shifts } = await supabase
      .from("time_clock_entries")
      .select("staff_id, clock_in, clock_out")
      .eq("business_id", business.id)
      .gte("clock_in", new Date(rangeStartMs).toISOString());
    for (const sh of shifts ?? []) {
      const sid = sh.staff_id as string;
      const inMs = new Date(sh.clock_in as string).getTime();
      const outMs = sh.clock_out ? new Date(sh.clock_out as string).getTime() : now;
      const hrs = Math.max(0, (outMs - inMs) / 3600000);
      hoursByStaff[sid] = (hoursByStaff[sid] ?? 0) + hrs;
    }

    // Include staff who clocked hours even with no attributed sales.
    const sids = Array.from(new Set([...Object.keys(agg), ...Object.keys(hoursByStaff)]));
    const nameById: Record<string, string> = { [UNASSIGNED]: "Unassigned" };
    // Only real UUIDs go to the staff lookup (never the synthetic Unassigned key).
    const realSids = sids.filter((s) => s !== UNASSIGNED);
    if (realSids.length > 0) {
      const { data: staffRows } = await supabase
        .from("staff_members")
        .select("id, name")
        .eq("business_id", business.id)
        .in("id", realSids);
      for (const s of staffRows ?? []) nameById[s.id as string] = s.name as string;
    }
    servers = sids
      .map((sid) => ({
        staffId: sid,
        name: nameById[sid] ?? "Server",
        count: agg[sid]?.count ?? 0,
        sales: round2(agg[sid]?.sales ?? 0),
        tips: round2(agg[sid]?.tips ?? 0),
        hours: Math.round((hoursByStaff[sid] ?? 0) * 10) / 10,
      }))
      // Real servers first (by sales), Unassigned always pinned last.
      .sort((a, b) =>
        (a.staffId === UNASSIGNED ? 1 : 0) - (b.staffId === UNASSIGNED ? 1 : 0) ||
        b.sales - a.sales ||
        a.name.localeCompare(b.name)
      );
  }

  const rangeStartIso = new Date(windowStartMs).toISOString();

  // Staff names for the CSV (all attributed orders, not just the server card).
  const exportStaffIds = Array.from(new Set(orders.map((o) => o.staff_id).filter((x): x is string => !!x)));
  const exportNameById: Record<string, string> = {};
  if (exportStaffIds.length > 0) {
    const { data: sn } = await supabase.from("staff_members").select("id, name").eq("business_id", business.id).in("id", exportStaffIds);
    for (const s of sn ?? []) exportNameById[s.id as string] = s.name as string;
  }

  // Transaction-level CSV: one row per sale, for a bookkeeper/accountant hand-off.
  const exportRows: (string | number)[][] = [
    ["Date/time", "Sale #", "Server", "Channel", "Subtotal", "Discount", "Tax", "Tip", "Total", "Payment", "Status"],
    ...orders.map((o) => [
      new Date(o.created_at).toLocaleString("en-CA", { timeZone: tz }),
      o.sale_number ?? "",
      o.staff_id ? exportNameById[o.staff_id] ?? "" : "",
      CHANNEL_LABEL[o.channel],
      o.subtotal.toFixed(2),
      o.discount.toFixed(2),
      o.tax.toFixed(2),
      o.tip.toFixed(2),
      o.total.toFixed(2),
      o.payment_method,
      o.status,
    ]),
  ];
  const exportFilename = "surge-sales-" + range + "-" + todayKey + ".csv";

  // Voids, comps & discounts by reason — from the sensitive-action audit trail, so a
  // manager can see WHY money was taken off checks (not just how much).
  const reasonAgg: Record<string, { action: string; code: string; count: number; amount: number }> = {};
  {
    const { data: auditRows } = await supabase
      .from("audit_events")
      .select("action, reason_code, metadata, created_at")
      .eq("business_id", business.id)
      .in("action", ["void", "comp", "discount"])
      .gte("created_at", rangeStartIso)
      .limit(5000);
    for (const a of auditRows ?? []) {
      const action = (a.action as string) || "";
      const code = (a.reason_code as string | null) || "none";
      const key = action + "|" + code;
      if (!reasonAgg[key]) reasonAgg[key] = { action, code, count: 0, amount: 0 };
      reasonAgg[key].count += 1;
      reasonAgg[key].amount += Number((a.metadata as { amount?: unknown } | null)?.amount) || 0;
    }
  }
  const reasonRows = Object.values(reasonAgg).sort((a, b) => b.amount - a.amount || b.count - a.count);
  const hasReasons = reasonRows.length > 0;
  const reasonActionLabel: Record<string, string> = { void: "Void", comp: "Comp", discount: "Discount" };
  const reasonText = (action: string, code: string): string => {
    if (code === "none") return "—";
    return action === "comp" ? reasonLabel(COMP_REASONS, code) : reasonLabelForAction(action, code);
  };

  // Channel mix for the selected range. Net = subtotal - discount (pre-tax), the
  // same basis the summary tiles use, so the rows reconcile with the totals.
  const channelRows = (() => {
    const by = new Map<ChannelKey, { count: number; net: number }>();
    for (const o of orders) {
      const cur = by.get(o.channel) ?? { count: 0, net: 0 };
      cur.count += 1;
      cur.net += o.subtotal - o.discount;
      by.set(o.channel, cur);
    }
    const total = Array.from(by.values()).reduce((a, v) => a + v.net, 0);
    return CHANNELS.filter((k) => by.has(k)).map((k) => {
      const v = by.get(k)!;
      return {
        key: k,
        count: v.count,
        net: round2(v.net),
        avg: round2(v.count > 0 ? v.net / v.count : 0),
        share: total > 0 ? Math.round((v.net / total) * 100) : 0,
      };
    }).sort((a, b) => b.net - a.net);
  })();

  const tabs: { key: string; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {"Sales for " + rangeLabels[range].toLowerCase() + ". Voided sales are excluded."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton rows={exportRows} filename={exportFilename} />
          {multiLocation && (
            <Link
              href="/app/locations"
              className="shrink-0 text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
            >
              All locations
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => {
          const active = range === t.key;
          return (
            <Link
              key={t.key}
              href={"/app/reports?range=" + t.key}
              className={
                "px-3 py-1.5 text-sm rounded-md border transition-colors " +
                (active
                  ? "border-foreground bg-accent font-medium"
                  : "border-border hover:border-foreground/40")
              }
            >
              {t.label}
            </Link>
          );
        })}
        {/* Closing a month needs exact dates, not a rolling window. */}
        <form action="/app/reports" method="get" className="flex items-center gap-1.5">
          <input
            type="date"
            name="from"
            defaultValue={customFrom ?? ""}
            aria-label="From date"
            className={
              "h-[34px] rounded-md border bg-transparent px-2 text-sm " +
              (range === "custom" ? "border-foreground" : "border-border")
            }
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            name="to"
            defaultValue={customTo ?? ""}
            aria-label="To date"
            className={
              "h-[34px] rounded-md border bg-transparent px-2 text-sm " +
              (range === "custom" ? "border-foreground" : "border-border")
            }
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm rounded-md border border-border hover:border-foreground/40 transition-colors"
          >
            Apply
          </button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
          <span className="text-xs text-muted-foreground">
            {count + (count === 1 ? " sale" : " sales")}
          </span>
        </div>

        <div className="text-3xl font-semibold tabular-nums">{money(net)}</div>
        <div className="text-xs text-muted-foreground mt-1">net of refunds</div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Gross</div>
            <div className="tabular-nums">{money(gross)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Discounts</div>
            <div className={"tabular-nums " + (discounts > 0 ? "text-red-500" : "")}>
              {discounts > 0 ? "-" + money(discounts) : money(0)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Tax</div>
            <div className="tabular-nums">{money(tax)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Tips</div>
            <div className="tabular-nums">{money(tips)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Collected</div>
            <div className="tabular-nums">{money(collected)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Refunds</div>
            <div className={"tabular-nums " + (refunds > 0 ? "text-red-500" : "")}>
              {refunds > 0 ? "-" + money(refunds) : money(0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Cash</div>
            <div className="tabular-nums">{money(cash)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Card</div>
            <div className="tabular-nums">{money(card)}</div>
          </div>
          {giftCard > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">Gift card</div>
              <div className="tabular-nums">{money(giftCard)}</div>
            </div>
          )}
          {storeCredit > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">Store credit</div>
              <div className="tabular-nums">{money(storeCredit)}</div>
            </div>
          )}
          {houseAccount > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">House account</div>
              <div className="tabular-nums">{money(houseAccount)}</div>
            </div>
          )}
          <div>
            <div className="text-muted-foreground text-xs">Other</div>
            <div className="tabular-nums">{money(other)}</div>
          </div>
        </div>
      </div>

      {/* Sales by channel — the revenue-centre split an operator uses to weigh
          packaging and aggregator cost against dining-room covers. Only
          channels that actually occurred are listed, so a dine-in-only
          restaurant doesn't read four empty rows. */}
      <div className="mb-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Sales by channel</h2>
        {channelRows.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground">No sales in this period.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-raised border-b border-border text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div>Channel</div>
              <div className="text-right">Orders</div>
              <div className="text-right">Net sales</div>
              <div className="text-right">Avg ticket</div>
              <div className="text-right">Share</div>
            </div>
            {channelRows.map((r) => (
              <div key={r.key} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-border last:border-0 text-sm">
                <div className="font-medium">{CHANNEL_LABEL[r.key]}</div>
                <div className="text-right tabular-nums text-muted-foreground">{r.count}</div>
                <div className="text-right tabular-nums">{money(r.net)}</div>
                <div className="text-right tabular-nums text-muted-foreground">{money(r.avg)}</div>
                <div className="text-right tabular-nums text-muted-foreground">{r.share}%</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Top items</h2>
          {topItems.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">No items sold in this period.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {topItems.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.qty + (it.qty === 1 ? " sold" : " sold")}
                    </div>
                  </div>
                  <div className="text-sm tabular-nums shrink-0">
                    {money(round2(it.revenue))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">By category</h2>
          {categories.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">No category data in this period.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {categories.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.qty + " items"}
                    </div>
                  </div>
                  <div className="text-sm tabular-nums shrink-0">
                    {money(round2(c.revenue))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasSalesCategories && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">By sales category</h2>
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {salesCategories.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.qty + " items"}</div>
                  </div>
                  <div className="text-sm tabular-nums shrink-0">{money(round2(c.revenue))}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasModifiers && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-medium text-muted-foreground">Top modifiers</h2>
            <span className="text-xs text-muted-foreground">menu value — how often each is chosen</span>
          </div>
          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-4 py-2">Modifier</th>
                  <th className="text-left font-medium px-4 py-2">Group</th>
                  <th className="text-right font-medium px-4 py-2">Times added</th>
                  <th className="text-right font-medium px-4 py-2">Menu value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topModifiers.map((m, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-medium truncate">{m.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate">{m.group}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{m.listRevenue > 0 ? money(round2(m.listRevenue)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1.5">Menu value is the option&rsquo;s list price at sale time; it isn&rsquo;t adjusted for check-level discounts, comps, or happy-hour pricing. Split-tendered checks aren&rsquo;t yet included, so totals here can run low where checks are split.</p>
        </div>
      )}

      {showServers && (
        <div className="mt-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">By server</h2>
          {servers.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">No server-attributed sales in this period.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-4 py-2">Server</th>
                    <th className="text-right font-medium px-4 py-2">Sales</th>
                    <th className="text-right font-medium px-4 py-2">Checks</th>
                    <th className="text-right font-medium px-4 py-2">Avg check</th>
                    <th className="text-right font-medium px-4 py-2">Tips</th>
                    <th className="text-right font-medium px-4 py-2">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {servers.map((s) => (
                    <tr key={s.staffId}>
                      <td className="px-4 py-2.5 font-medium truncate">{s.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(s.sales)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{s.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{money(round2(s.count > 0 ? s.sales / s.count : 0))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(s.tips)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{s.hours > 0 ? s.hours.toFixed(1) + "h" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {hasReasons && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-medium text-muted-foreground">Voids, comps &amp; discounts by reason</h2>
            <span className="text-xs text-muted-foreground">why money came off checks</span>
          </div>
          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-4 py-2">Type</th>
                  <th className="text-left font-medium px-4 py-2">Reason</th>
                  <th className="text-right font-medium px-4 py-2">Count</th>
                  <th className="text-right font-medium px-4 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reasonRows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-medium">{reasonActionLabel[r.action] ?? r.action}</td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate">{reasonText(r.action, r.code)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.amount > 0 ? money(round2(r.amount)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1.5">From the sensitive-action log. Training-mode actions aren&rsquo;t recorded here.</p>
        </div>
      )}
    </div>
  );
}