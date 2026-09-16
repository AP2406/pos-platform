import { createClient } from "@/lib/supabase/server";
import { getTodayBoundsUTC, getDayBoundsUTC } from "@/lib/utils/dates";
import { must, soft } from "@/lib/supabase/query";
import { displayItemName, formatDuration } from "@/lib/format";
import { canAccess } from "@/lib/services/route-access";
import { enabledModules } from "@/lib/modules/resolve";
import { hasFloorService } from "@/lib/modules/modes";
import { evaluateReadiness } from "@/lib/services/launch-readiness";
import { laborForPeriod } from "./accounting/cost";
import { aggregateItemSales } from "@/lib/services/product-mix";
import { channelMix } from "@/lib/services/order-channel";
import {
  agingThresholds,
  computePace,
  hourlyBuckets,
  minutesSince,
  niceCeiling,
  rankSignals,
  tradingHours,
  type AttentionSignal,
  type CurvePoint,
  type Pace,
} from "@/lib/services/dashboard-signals";
import {
  AttentionRail,
  CurrentServiceCard,
  DashboardFooter,
  KpiStrip,
  ReadinessPanel,
  SalesPerformanceCard,
  TopItemsCard,
  money,
  type Kpi,
  type KpiDelta,
  type SeriesBar,
  type ServiceStat,
  type TopItemRow,
} from "./dashboard-modules";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { enterAt } from "@/components/ui/panel";

// The admin home page for every non-transportation business.
//
// It answers two questions in this order: what needs me in the next two minutes,
// and how is the day going. That is why it isn't a wall of equal cards. An older
// version showed seven KPI tiles of identical weight — today's sales,
// transactions, avg ticket, low stock, this week, this month, avg ticket again —
// and an owner scanning it learned nothing they could act on. Week and month
// totals are reporting, not operations; they live in /app/reports, where you go
// on purpose.
//
// The order below is the priority order, and it is deliberate:
//
//   0. Launch readiness   — only while setup is unfinished. Outranks everything,
//                           because nothing else on the page can move until it's
//                           done.
//   1. The KPI band       — four figures an owner recites from memory, each
//                           against the same weekday last week or against a
//                           threshold they set themselves.
//   2. Sales performance  — the day hour by hour, or the fortnight day by day,
//                           against a real axis.
//   3. Current service    — the state of the room, always live whatever the
//                           scope control says.
//   4. Top-selling items  — the same aggregate /app/reports draws, scoped to the
//                           day, so the two can never disagree.
//   5. Needs attention    — real exceptions only, ranked by urgency, each row
//                           linking to the screen that resolves it. No competitor
//                           back office has this; see
//                           docs/competitor-dashboard-study.md.
//
// Collapsed to one column the rail moves UP, to second place behind the KPI
// band, because on a phone the priority order and the reading order are the same
// thing.
//
// THE EMPTY CASE IS THE DESIGN CASE. Most tenants looking at this page have no
// sales today: it's 9am, or they opened last week, or they're a brand-new
// merchant who hasn't rung anything. A dashboard that only reads well with a
// busy Friday behind it is a dashboard that fails most of the people who open
// it. So every module here has a written zero state, and — the lesson from the
// Orders hub, which rendered a calm empty screen over a broken query — a quiet
// day and a failed load never look the same.
//
// WHAT IS AND ISN'T REAL ON THIS PAGE is written down in
// docs/dashboard-overview-audit.md, element by element, including the four
// things the mockup asked for that have no source and are therefore not here.

type Biz = {
  id: string;
  name: string;
  industry: string;
  currency: string;
  timezone: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}

/** A query we chose not to run. Reads as "no rows, no error" to soft(). */
const NOT_ASKED = { data: null, error: null };

/**
 * Two weeks of bars. Long enough that both of last week's Fridays are on screen
 * — a weekly rhythm needs two cycles before it looks like a rhythm — and short
 * enough that fourteen bars still fit legibly across a phone.
 */
const WINDOW_DAYS = 14;

/**
 * Ringable table kinds. `seat`, `counter` and `station` can all carry an open
 * ticket too (the floor plan lets you ring any of them), but they are not what a
 * manager means by "tables", and counting them would inflate the denominator
 * with every barstool in the room.
 */
const TABLE_KINDS = ["table", "booth"];

/**
 * An axis tick, from a local hour number rather than from a Date.
 *
 * Deliberately not Intl. The buckets are already keyed by local hour — the
 * formatter did that work, correctly, across DST — and turning hour 15 back into
 * an instant so a formatter can turn it back into "3 PM" reintroduces exactly
 * the DST ambiguity the bucketing avoided. It also gets the typography wrong:
 * en-CA renders "3 p.m.", which is right in a sentence and four characters too
 * wide under a bar.
 */
function hourTick(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return twelve + " " + period;
}

/** "8–9 PM" — the spoken form, for the footer line and the text alternative. */
function hourRange(h: number): string {
  const end = (h + 1) % 24;
  const from = h % 12 === 0 ? 12 : h % 12;
  const to = end % 12 === 0 ? 12 : end % 12;
  const fromPeriod = h < 12 ? "AM" : "PM";
  const toPeriod = end < 12 ? "AM" : "PM";
  // "11 AM–12 PM" keeps both markers because the period changes; "8–9 PM" drops
  // the first, which is how a person says it.
  return fromPeriod === toPeriod
    ? from + "–" + to + " " + toPeriod
    : from + " " + fromPeriod + "–" + to + " " + toPeriod;
}

/**
 * A `Pace` turned into the arrow-and-figure line under a KPI.
 *
 * The arrow follows the raw sign, and nothing follows `computePace`'s level band
 * any more — this used to hand Delta a `good` direction and a `neutral` override
 * so the line could be painted green, red or grey, and no delta on this page is
 * painted at all now. See Delta: the arrow already encodes the direction and the
 * words already encode the comparison, so the hue was a third statement of the
 * same fact and it was spending the page's alert colour on a figure nobody gets
 * up and acts on.
 */
function paceDelta(pace: Pace, weekday: string): KpiDelta | null {
  if (pace.status === "no-benchmark" || pace.deltaPct == null) return null;
  const pct = Math.abs(pace.deltaPct);
  return {
    direction: pace.deltaPct > 0.05 ? "up" : pace.deltaPct < -0.05 ? "down" : "flat",
    // One decimal while the gap is small enough for one to matter; whole
    // percents once it is large, where ".3" is just noise on the end.
    text: (pct < 10 ? pct.toFixed(1) : String(Math.round(pct))) + "%",
    suffix: "vs last " + weekday,
  };
}

export async function PosDashboard({
  business,
  role,
  day,
  chart,
}: {
  business: Biz;
  role: string | null | undefined;
  /** The scope control's only value. Anything but "yesterday" means today. */
  day?: string;
  /** The chart toggle's only value. Anything but "daily" means hourly. */
  chart?: string;
}) {
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";
  const currency = business.currency || "CAD";
  const now = Date.now();

  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  const dayOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));

  // --- What this business is, and what this person may do ------------------
  //
  // Two independent gates, and both matter. enabledModules() answers "is this
  // even that kind of restaurant" — a quick-service counter has no tables, so
  // offering it a stale-open-checks alert is offering it another vertical's
  // product. canAccess() answers "may this person act on it" — a bookkeeper can
  // read the books and nothing else, so they get no 86 button and no roster.
  const modCtx = {
    industry: business.industry,
    config: (business as { config?: unknown }).config,
    driversEnabled: (business as { drivers_enabled?: boolean }).drivers_enabled,
  };
  const modules = enabledModules(modCtx);
  const hasKitchen = modules.indexOf("kitchen") !== -1;
  const hasCatalog = modules.indexOf("catalog") !== -1;
  const hasStaff = modules.indexOf("staff") !== -1;
  // Open checks, table occupancy, the time clock and /app/attendance are all
  // full-service concepts today — hasFloorService() is the same predicate the
  // register, the floor plan and the accounting pages gate on. Bar mode runs
  // tabs and arguably belongs here too, but widening that predicate changes a
  // dozen other screens, so it stays a separate decision.
  const runsChecks = hasFloorService(business as { config?: { mode?: string } | null });

  const canApprove = canAccess(role, "void");
  const canEditMenu = canAccess(role, "edit_menu");
  const canEditStaff = canAccess(role, "edit_staff");
  const canCloseDay = canAccess(role, "close_day");
  // The same permission ROUTE_PERMISSIONS puts on /app/labor. Labour cost is
  // payroll-adjacent: it is every wage in the building divided by one number,
  // and a server who can see it can work out what the kitchen earns.
  const canReadBooks = canAccess(role, "access_reports");
  const canExport = canAccess(role, "export_data");

  const settings = (business as { settings?: unknown }).settings;
  const aging = agingThresholds(settings);

  // The merchant's own labour ceiling, from settings.labor_target — the same
  // object /app/labor reads to decide `overTarget` and the same one the mobile
  // app's daily "Labor over target" push de-dupes against. Disabled is a real
  // state and it is NOT the same as zero: a business with no target gets the
  // percentage with a note, never a threshold we invented.
  const laborTargetCfg = ((settings as Record<string, unknown> | null | undefined)?.[
    "labor_target"
  ] ?? {}) as { enabled?: unknown; targetPct?: unknown };
  const laborTargetPct =
    laborTargetCfg.enabled === true && Number(laborTargetCfg.targetPct) > 0
      ? Number(laborTargetCfg.targetPct)
      : null;

  // --- Time windows --------------------------------------------------------
  //
  // The scope control moves the sales figures and nothing else. An exception
  // rail scoped to yesterday would list tickets nobody can still act on, which
  // is the opposite of what a rail is for — so the alerts, the service card and
  // the attention rows stay live whatever the control says, and they say so.
  const scope: "today" | "yesterday" = day === "yesterday" ? "yesterday" : "today";

  // todayStart keeps its literal meaning: it is what "a till from a previous
  // day" is measured against, and that question is never about the scoped day.
  const { start: todayStart, end: todayEnd } = getTodayBoundsUTC(tz);
  const { start: dayStart, end: dayEnd } =
    scope === "yesterday"
      ? getDayBoundsUTC(new Date(now - 24 * 60 * 60 * 1000), tz)
      : { start: todayStart, end: todayEnd };

  const dayLengthMs = dayEnd.getTime() - dayStart.getTime();
  // A finished day is measured whole; a running one is measured up to this
  // minute. That difference is the whole reason the comparison is honest.
  const elapsedMs =
    scope === "yesterday"
      ? dayLengthMs
      : Math.max(0, Math.min(now - dayStart.getTime(), dayLengthMs));

  // Same weekday last week, not yesterday: a Tuesday compared to a Monday is a
  // comparison that reads as a crisis every Monday. See computePace().
  //
  // The mockup's delta line reads "vs. yesterday". It stays week-over-week here
  // and that is a deliberate refusal — see docs/dashboard-overview-audit.md §6.
  //
  // Probed from the middle of the scoped day so a DST shift can't land the
  // arithmetic on the wrong local date.
  const dayNoonMs = dayStart.getTime() + dayLengthMs / 2;
  const { start: benchStart, end: benchEnd } = getDayBoundsUTC(
    new Date(dayNoonMs - 7 * 24 * 60 * 60 * 1000),
    tz
  );
  const benchLengthMs = benchEnd.getTime() - benchStart.getTime();
  const benchCutoff = benchStart.getTime() + elapsedMs;

  // The fortnight the Daily tab reads. It ends where the scoped day ends rather
  // than at the wall clock, so the last bar is always the day the KPI band is
  // talking about — a trend block whose last column disagreed with the figures
  // above it would be worse than no trend.
  //
  // Probed from noon, like every other date here, so a DST changeover can't
  // shift the window a day.
  const windowStart = getDayBoundsUTC(
    new Date(dayNoonMs - (WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000),
    tz
  ).start;

  const [
    dayRes,
    benchRes,
    windowRes,
    refundRes,
    todayCountRes,
    everSoldRes,
    catalogRes,
    ticketsRes,
    tablesRes,
    kitchenRes,
    prepRes,
    approvalsRes,
    drawerRes,
    everDrawerRes,
    clockRes,
    staffRes,
  ] = await Promise.all([
    // THE page query. An empty dashboard has to mean "no sales today" and can
    // never mean "the select was wrong" — must() throws so the error boundary
    // shows the failure instead of a convincing $0.00.
    //
    // `id` rides along because the refunds and the line items are both joined
    // back to it. `status` rides along for the refund count. `channel` and the
    // snapshot's dining_option ride along for the channel split.
    //
    // NOTE THE ARROW SELECTOR. dining_option has never been a column — it lives
    // inside the immutable snapshot, and selecting it AS a column is what broke
    // the Orders hub (see app/app/orders/page.tsx). `snapshot->>dining_option`
    // is the supported way to ask PostgREST for one key out of a JSONB blob, and
    // it is the reason this query does not have to drag every order's entire
    // snapshot across the wire to find one short string in it.
    supabase
      .from("orders")
      .select(
        "id, total, created_at, is_training, status, channel, dining_option:snapshot->>dining_option"
      )
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", dayStart.toISOString())
      .lt("created_at", dayEnd.toISOString()),

    supabase
      .from("orders")
      .select("total, created_at, is_training, status")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", benchStart.toISOString())
      .lt("created_at", benchEnd.toISOString()),

    // The fortnight behind the Daily tab.
    //
    // COST: this reads every order in the window — four columns, but a busy
    // restaurant is a few thousand rows on every dashboard load. The right
    // answer is a daily-totals rollup in the database, which is a migration and
    // therefore not this change. There is deliberately no LIMIT: a truncated
    // window would quietly understate the totals, and a chart that is wrong is
    // worse than a chart that is slow.
    supabase
      .from("orders")
      .select("id, total, created_at, is_training")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", windowStart.toISOString())
      .lt("created_at", dayEnd.toISOString()),

    // WHAT MAKES "NET SALES" ACTUALLY NET.
    //
    // Refunding a sale sets orders.status and writes a row here; it never
    // reduces orders.total (app/app/pos/sales/refund-actions.ts). So the figure
    // this page has called "net of refunds" for its whole life was gross. This
    // is the query that fixes it, and it is the same definition /app/reports
    // uses for its own `net` line: takings minus the refunds recorded against
    // those orders.
    //
    // Filtered by DATE rather than by an `in(order_id, …)` list on purpose. A
    // busy day is several hundred orders and a fortnight is several thousand;
    // thirty-seven characters of UUID each puts that URL past what sits in front
    // of PostgREST. A refund cannot predate the sale it reverses, so every
    // refund against an order in the window was created at or after the window
    // opened — and the join back to the window's own order ids happens in
    // memory, below, where it costs nothing.
    supabase
      .from("refunds")
      .select("order_id, amount")
      .eq("business_id", business.id)
      .gte("created_at", windowStart.toISOString()),

    // The service card says "N sales today" and means it, so when the scope
    // control is pointed at yesterday it needs its own count rather than
    // relabelling the one above.
    scope === "yesterday"
      ? supabase
          .from("orders")
          .select("id, is_training")
          .eq("business_id", business.id)
          .neq("status", "voided")
          .gte("created_at", todayStart.toISOString())
          .lt("created_at", todayEnd.toISOString())
      : NOT_ASKED,

    // Five rows, and only ever asked one question: has this business EVER sold
    // anything? "Never rung a sale" and "hasn't sold anything since Tuesday"
    // want different sentences on an empty chart, and that is the only way to
    // tell them apart.
    supabase
      .from("orders")
      .select("created_at, is_training")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .order("created_at", { ascending: false })
      .limit(5),

    hasCatalog
      ? supabase
          .from("catalog_items")
          .select("id, name, stock_qty, reorder_point, track_inventory, out_of_stock")
          .eq("business_id", business.id)
          .eq("is_active", true)
      : NOT_ASKED,

    runsChecks
      ? supabase
          .from("open_tickets")
          .select("id, label, opened_at, guest_count, check_dropped_at, element_id, parent_ticket_id")
          .eq("business_id", business.id)
          .order("opened_at", { ascending: true })
      : NOT_ASKED,

    // The occupancy denominator. There is no `tables` table — a table is a
    // floor_element whose kind says so — and there is no occupied flag either:
    // occupancy is the existence of an open ticket pointing at the element,
    // which is exactly how listTableMoveTargets and the floor plan's lock check
    // already derive it.
    runsChecks
      ? supabase
          .from("floor_elements")
          .select("id, kind")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .in("kind", TABLE_KINDS)
      : NOT_ASKED,

    hasKitchen
      ? supabase
          .from("kitchen_tickets")
          .select("id, label, fired_at")
          .eq("business_id", business.id)
          .is("fulfilled_at", null)
          .order("fired_at", { ascending: true })
      : NOT_ASKED,

    // Measured prep time. catalog_items.prep_minutes is a TARGET and is never
    // compared to anything; the only elapsed-time aggregate in the product lives
    // on /app/insights, over 7 or 30 days, behind a full-service redirect. This
    // is the same arithmetic scoped to the day. Bumping sets fulfilled_at rather
    // than deleting the row, which is why the history is here to read at all.
    hasKitchen
      ? supabase
          .from("kitchen_tickets")
          .select("fired_at, fulfilled_at")
          .eq("business_id", business.id)
          .not("fulfilled_at", "is", null)
          .gte("fulfilled_at", dayStart.toISOString())
          .lt("fulfilled_at", dayEnd.toISOString())
      : NOT_ASKED,

    canApprove
      ? supabase
          .from("approval_requests")
          .select("id, kind, created_at")
          .eq("business_id", business.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
      : NOT_ASKED,

    supabase
      .from("drawer_sessions")
      .select("id, opened_at")
      .eq("business_id", business.id)
      .eq("status", "open")
      .limit(1),

    // Readiness only needs to know whether a till has *ever* been opened, so one
    // row is enough — cheaper than a count over a year of sessions.
    supabase
      .from("drawer_sessions")
      .select("id")
      .eq("business_id", business.id)
      .limit(1),

    runsChecks
      ? supabase
          .from("time_clock_entries")
          .select("id, staff_id, clock_in")
          .eq("business_id", business.id)
          .is("clock_out", null)
      : NOT_ASKED,

    hasStaff
      ? supabase
          .from("staff_members")
          .select("id, name, is_active")
          .eq("business_id", business.id)
      : NOT_ASKED,
  ]);

  // soft() returns the fallback on failure, which is indistinguishable from "no
  // rows" — so we keep the error flag alongside every list. That flag is what
  // lets a module say "couldn't load" instead of quietly showing a zero.
  const benchFailed = benchRes.error != null;
  const windowFailed = windowRes.error != null;
  const refundFailed = refundRes.error != null;
  const todayCountFailed = todayCountRes.error != null;
  const everSoldFailed = everSoldRes.error != null;
  const catalogFailed = catalogRes.error != null;
  const ticketsFailed = ticketsRes.error != null;
  const tablesFailed = tablesRes.error != null;
  const kitchenFailed = kitchenRes.error != null;
  const prepFailed = prepRes.error != null;
  const approvalsFailed = approvalsRes.error != null;
  const drawerFailed = drawerRes.error != null;
  const clockFailed = clockRes.error != null;
  const staffFailed = staffRes.error != null;

  const dayRows = must(
    scope === "today" ? "today's sales" : "yesterday's sales",
    dayRes
  ) as Row[];
  const benchRows = soft("dashboard → same weekday last week", benchRes, [] as Row[]);
  const windowRows = soft("dashboard → last 14 days", windowRes, [] as Row[]);
  const refundRows = soft("dashboard → refunds", refundRes, [] as Row[]);
  const todayCountRows = soft("dashboard → today's sale count", todayCountRes, [] as Row[]);
  const everSoldRows = soft("dashboard → sales history", everSoldRes, [] as Row[]);
  const items = soft("dashboard → menu & stock", catalogRes, [] as Row[]);
  const openChecks = soft("dashboard → open checks", ticketsRes, [] as Row[]);
  const tableElements = soft("dashboard → floor plan", tablesRes, [] as Row[]);
  const kitchenTickets = soft("dashboard → kitchen tickets", kitchenRes, [] as Row[]);
  const prepTickets = soft("dashboard → prep times", prepRes, [] as Row[]);
  const approvals = soft("dashboard → pending approvals", approvalsRes, [] as Row[]);
  const openDrawers = soft("dashboard → open drawer", drawerRes, [] as Row[]);
  const everDrawers = soft("dashboard → drawer history", everDrawerRes, [] as Row[]);
  const onClock = soft("dashboard → time clock", clockRes, [] as Row[]);
  const staff = soft("dashboard → staff", staffRes, [] as Row[]);

  // --- Refund lookup -------------------------------------------------------
  //
  // Order id → dollars given back. Built once and read by the day figures, the
  // hourly bars and the daily bars, so all three are net of the same thing. If
  // the query failed this map is empty and EVERY figure that leans on it
  // relabels itself; nothing silently reports gross under a "net" heading.
  const refundByOrder = new Map<string, number>();
  for (const r of refundRows) {
    const id = r.order_id as string | null;
    if (!id) continue;
    refundByOrder.set(id, (refundByOrder.get(id) ?? 0) + num(r.amount));
  }
  const netOf = (o: Row): number =>
    num(o.total) - (refundByOrder.get(o.id as string) ?? 0);

  // --- 1 · The day ---------------------------------------------------------
  //
  // A sale counts as refunded when the *order* carries that status, which means
  // it is attributed to the day the sale was rung, not the day the money went
  // back. That is the right attribution for "how much of today did we give
  // back", and the wrong one for a cash-flow report — which is why this stays a
  // dashboard signal and /app/reports keeps its own refund figures.
  const isRefunded = (o: Row) =>
    o.status === "refunded" || o.status === "partially_refunded";

  let dayNet = 0;
  let dayCount = 0;
  let dayRefunds = 0;
  const dayPoints: CurvePoint[] = [];
  const liveDayOrders: Row[] = [];
  const dayOrderIds = new Set<string>();
  for (const o of dayRows) {
    if (o.is_training) continue;
    const amount = netOf(o);
    dayNet += amount;
    dayCount += 1;
    if (isRefunded(o)) dayRefunds += 1;
    dayPoints.push({ at: o.created_at, amount });
    liveDayOrders.push(o);
    dayOrderIds.add(o.id as string);
  }

  let benchSoFar = 0;
  let benchFull = 0;
  let benchCountSoFar = 0;
  let benchCountFull = 0;
  let benchRefundsSoFar = 0;
  for (const o of benchRows) {
    if (o.is_training) continue;
    const t = num(o.total);
    benchFull += t;
    benchCountFull += 1;
    if (new Date(o.created_at).getTime() < benchCutoff) {
      benchSoFar += t;
      benchCountSoFar += 1;
      if (isRefunded(o)) benchRefundsSoFar += 1;
    }
  }
  const pace = computePace(dayNet, benchSoFar, benchFull);

  // Named up here because every delta on the page ends "…vs last Wednesday".
  const weekday = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "long",
  }).format(new Date(benchStart.getTime() + benchLengthMs / 2));

  // --- 2 · Line items, for the top-selling table ---------------------------
  //
  // Asked by date and joined in memory, for the same reason the refunds query is
  // — an `in(order_id, …)` list over a busy day is a URL nobody's proxy will
  // carry. The hour of slack either side absorbs the gap between an order's
  // timestamp and its lines': they are written in one transaction, but "written
  // in one transaction" is not "written in the same millisecond", and a line
  // filed a second past midnight would otherwise vanish from the day it belongs to.
  const linesRes =
    dayOrderIds.size > 0
      ? await supabase
          .from("order_items")
          .select("order_id, catalog_item_id, name, unit_price, quantity")
          .eq("business_id", business.id)
          .gte("created_at", new Date(dayStart.getTime() - 3600000).toISOString())
          .lt("created_at", new Date(dayEnd.getTime() + 3600000).toISOString())
      : NOT_ASKED;
  const linesFailed = linesRes.error != null;
  const allLines = soft("dashboard → item mix", linesRes, [] as Row[]);
  const dayLines = allLines.filter((l: Row) => dayOrderIds.has(l.order_id as string));

  // The SAME aggregate /app/reports draws, not a second one that could disagree
  // with it — same keying, same split-check normalisation, same sort. Four rows,
  // because the card sits in a column beside a chart and a fifth would push the
  // two columns out of alignment for a row nobody reads.
  const topItems: TopItemRow[] = aggregateItemSales(dayLines)
    .slice(0, 4)
    .map((r) => ({ key: r.key, name: r.name, qty: r.qty, revenue: r.revenue }));

  // --- 3 · The KPI band ----------------------------------------------------

  const avgToday = dayCount > 0 ? dayNet / dayCount : 0;
  const avgPace = computePace(
    avgToday,
    benchCountSoFar > 0 ? benchSoFar / benchCountSoFar : 0,
    benchCountFull > 0 ? benchFull / benchCountFull : 0
  );

  // The one sentence that has to survive: a benchmark that failed to load and a
  // benchmark that was a closed Monday are different facts, and neither of them
  // is "0%".
  const noBenchNote = benchFailed
    ? "Last " + weekday + " couldn't be loaded."
    : "No trading last " + weekday + " to compare.";

  // Counts, not money, so a percentage is the wrong shape here: "↑ 200%" off a
  // base of one order is technically true and operationally meaningless. The
  // mockup is right about this — `↗ 18` is what an owner says out loud.
  const orderDelta: KpiDelta | null =
    benchFailed || benchCountSoFar === 0
      ? null
      : dayCount === benchCountSoFar
        ? { direction: "flat", text: "Level", suffix: "with last " + weekday }
        : {
            direction: dayCount > benchCountSoFar ? "up" : "down",
            text: String(Math.abs(dayCount - benchCountSoFar)),
            suffix: (dayCount > benchCountSoFar ? "more than last " : "fewer than last ") + weekday,
          };

  const scopeWordLower = scope === "today" ? "today" : "yesterday";
  const scopeWord = scope === "today" ? "Today" : "Yesterday";

  const kpis: Kpi[] = [
    {
      id: "net-sales",
      // The label tells the truth about the arithmetic behind it. When the
      // refunds query failed the figure is gross, and the word "Net" comes off
      // — a number labelled net that quietly isn't is the exact class of lie
      // this page keeps being rebuilt to stop telling.
      label: refundFailed ? "Sales " + scopeWordLower : "Net sales",
      value: money(dayNet, currency),
      delta: benchFailed ? null : paceDelta(pace, weekday),
      status: null,
      note: refundFailed
        ? "Refunds couldn't be loaded, so this is before them."
        : noBenchNote,
    },
    {
      id: "orders",
      label: "Completed orders",
      value: String(dayCount),
      delta: benchFailed ? null : orderDelta,
      status: null,
      note: noBenchNote,
    },
    {
      id: "average-order",
      label: "Average order",
      // The average of no sales is not zero, it is undefined, and "$0.00" would
      // read as a day where everything was comped.
      value: dayCount > 0 ? money(avgToday, currency) : "—",
      delta: dayCount === 0 || benchFailed ? null : paceDelta(avgPace, weekday),
      status: null,
      note: dayCount === 0 ? "No sales " + scopeWordLower + " to average." : noBenchNote,
    },
  ];

  // --- 3b · Labour cost ----------------------------------------------------
  //
  // The mockup's fourth KPI, and the one most likely to have been roadmap. It
  // isn't: settings.labor_target has been driving /app/labor and a daily push
  // alert for a while, and time_clock_entries × staff_members.pay_rate is how
  // every other page in the product prices a shift.
  //
  // What is NOT done here is a fifth implementation of that arithmetic. There
  // are already four and they disagree about overtime; laborForPeriod is the one
  // /app/accounting, /app/locations, the consolidated export and the scheduled
  // report all share, so calling it puts this figure on the same side of that
  // disagreement as four other screens. It can still differ from /app/labor,
  // which applies an OT multiplier. See docs/dashboard-overview-audit.md §1.
  const labor =
    canReadBooks && hasStaff
      ? await laborForPeriod(
          supabase,
          business.id,
          dayStart.toISOString(),
          // An open shift is priced to "now" inside laborForPeriod, so a running
          // day is costed to this minute — which is what makes the percentage
          // comparable to a sales figure that is also only up to this minute.
          dayEnd.toISOString()
        )
      : null;

  if (labor) {
    const pct = labor.cost > 0 && dayNet > 0 ? (labor.cost / dayNet) * 100 : null;
    // Four different reasons this cell can have no percentage, and a reader has
    // no way to tell them apart unless the cell says which. None of them is
    // "0.0%": a restaurant whose staff cost nothing does not exist, and
    // rendering it would be the most confidently wrong number on the page.
    const blocker =
      labor.hours <= 0
        ? "Nobody was clocked in " + scopeWordLower + "."
        : labor.cost <= 0
          ? "No pay rates on file — add them in Staff to cost this."
          : dayNet <= 0
            ? "No sales " + scopeWordLower + " to measure wages against."
            : null;

    // Shown when there is a real percentage to show, or when the merchant has
    // configured a target and is therefore owed an explanation for its absence.
    // A business with neither gets the refunds count instead — a fourth column
    // of "we can't tell you" is worse than a fourth column of something true.
    if (pct != null || laborTargetPct != null) {
      kpis.push({
        id: "labour",
        label: "Labour cost",
        value: pct != null ? pct.toFixed(1) + "%" : "—",
        delta: null,
        // A status, not a delta, and that is the mockup's insight: a labour
        // ratio that moved 2.4% since last Thursday is two moving numbers
        // divided by each other, and nobody stands up for it. Over or under the
        // line the merchant drew themselves is a thing you act on.
        status:
          pct != null && laborTargetPct != null
            ? {
                text: pct > laborTargetPct ? "Over target" : "Within target",
                suffix: "target " + laborTargetPct + "%",
                alert: pct > laborTargetPct,
              }
            : pct != null
              ? { text: money(labor.cost, currency), suffix: "in wages · no target set" }
              : null,
        note: blocker ?? "No target set — set one in Settings to track this.",
      });
    }
  }

  if (kpis.length < 4) {
    // The fallback fourth column. Refunds are a real signal and they are the
    // figure this band carried before labour existed; they keep the band square
    // for every business that can't or won't show a labour percentage.
    const refundDelta: KpiDelta | null =
      benchFailed || benchCountSoFar === 0
        ? null
        : dayRefunds === benchRefundsSoFar
          ? { direction: "flat", text: "Level", suffix: "with last " + weekday }
          : {
              direction: dayRefunds > benchRefundsSoFar ? "up" : "down",
              text: String(Math.abs(dayRefunds - benchRefundsSoFar)),
              suffix:
                (dayRefunds > benchRefundsSoFar ? "more than last " : "fewer than last ") +
                weekday,
            };
    kpis.push({
      id: "refunds",
      label: "Refunds",
      value: String(dayRefunds),
      delta: refundDelta,
      status: null,
      note: noBenchNote,
    });
  }

  // --- 4 · The two chart series --------------------------------------------

  const chartTab: "hourly" | "daily" = chart === "daily" ? "daily" : "hourly";
  const scopeQuery = scope === "yesterday" ? "day=yesterday" : "";
  const tabHref = (key: string) => {
    const parts = [scopeQuery, key === "daily" ? "chart=daily" : ""].filter(Boolean);
    return "/app" + (parts.length ? "?" + parts.join("&") : "");
  };
  const chartTabs = [
    { key: "hourly", label: "Hourly", href: tabHref("hourly") },
    { key: "daily", label: "Daily", href: tabHref("daily") },
  ];

  const hourFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  });
  const buckets = hourlyBuckets(dayPoints, hourFmt, dayStart.getTime(), dayLengthMs);
  const span = tradingHours(buckets);
  // The hour now in progress — the reader's place in the series, which is a
  // different fact from which hour was busiest and is marked differently (an
  // inked axis tick, not an inked bar).
  const currentHour =
    scope === "today" ? Number(hourFmt.format(new Date(now))) % 24 : -1;

  const hourBars: SeriesBar[] = [];
  if (span) {
    for (let h = span.from; h <= span.to; h++) {
      hourBars.push({
        key: "h" + h,
        tick: hourTick(h),
        full: hourRange(h),
        amount: buckets[h].amount,
        marked: h === currentHour,
      });
    }
  }

  // Bucketed by the business's own local date rather than by UTC arithmetic: a
  // 9pm sale in Vancouver is the same calendar day as an 11am one, and only the
  // timezone formatter reliably knows that across a DST boundary.
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const tickOf = new Intl.DateTimeFormat("en-CA", { timeZone: tz, weekday: "narrow" });
  const fullOf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const windowByDay = new Map<string, number>();
  for (const o of windowRows) {
    if (o.is_training) continue;
    const k = dayKey.format(new Date(o.created_at));
    windowByDay.set(k, (windowByDay.get(k) ?? 0) + netOf(o));
  }

  // Built from the calendar, not from the rows, so a closed Monday is a bar of
  // zero rather than a day that silently isn't there. A gap in a bar chart reads
  // as "we lost the data"; an empty slot reads as "we were shut".
  const dayBars: SeriesBar[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const at = new Date(dayNoonMs - i * 24 * 60 * 60 * 1000);
    const k = dayKey.format(at);
    dayBars.push({
      key: k,
      tick: tickOf.format(at),
      full: fullOf.format(at),
      amount: windowByDay.get(k) ?? 0,
      marked: i === 0,
    });
  }

  const seriesBars = chartTab === "daily" ? dayBars : hourBars;
  const seriesCeiling = niceCeiling(Math.max(...seriesBars.map((b) => b.amount), 0));
  const seriesFailed = chartTab === "daily" ? windowFailed : false;

  const everSold = everSoldFailed
    ? true
    : everSoldRows.some((o: Row) => !o.is_training);
  const lastSale = everSoldRows.find((o: Row) => !o.is_training);

  // The written zero state, and there are four of them because there are four
  // different quiet days. A first morning, a business that stopped ringing weeks
  // ago and a genuinely dead Tuesday are not the same news, and "No data" is
  // what a page says when it has decided not to find out which.
  const hourlyEmpty = !everSold
    ? "No sales recorded yet. Your first one lands here the moment it's rung up, and the day fills in hour by hour."
    : scope === "today"
      ? "Nothing rung yet today. Each hour you trade adds a bar, so the shape of your service builds itself." +
        (lastSale ? " Your last sale was " + dayOf(lastSale.created_at) + "." : "")
      : "Nothing was rung yesterday." +
        (lastSale ? " Your last sale was " + dayOf(lastSale.created_at) + "." : "");
  const dailyEmpty = !everSold
    ? "No sales recorded yet. Each day you trade adds a bar here, so the shape of your week builds itself."
    : "No sales in the last 14 days. Each day you trade adds a bar here, so the shape of your week builds itself.";

  // --- 5 · Current service -------------------------------------------------

  const serviceStats: ServiceStat[] = [];

  if (runsChecks) {
    // Occupancy: open tickets pointing at a table, over the tables that exist.
    // parent_ticket_id is load-bearing — a split check is two rows against one
    // element, and counting both would put a twenty-table room at 26/24.
    const occupied = new Set<string>();
    for (const t of openChecks) {
      if (t.parent_ticket_id) continue;
      const el = t.element_id as string | null;
      if (el) occupied.add(el);
    }
    const tableIds = new Set<string>(tableElements.map((e: Row) => e.id as string));
    const occupiedTables = [...occupied].filter((id) => tableIds.has(id)).length;

    serviceStats.push({
      key: "tables",
      label: "Occupied tables",
      value: occupiedTables + " / " + tableIds.size,
      absent: tablesFailed
        ? "Floor plan didn't load"
        : ticketsFailed
          ? "Open checks didn't load"
          : tableIds.size === 0
            ? "No tables on the floor plan yet"
            : undefined,
    });
    serviceStats.push({
      key: "open",
      label: "Open checks",
      value: String(openChecks.filter((t: Row) => !t.parent_ticket_id).length),
      absent: ticketsFailed ? "Couldn't load" : undefined,
    });
  } else if (hasKitchen) {
    serviceStats.push({
      key: "open",
      label: "Open tickets",
      value: String(kitchenTickets.length),
      absent: kitchenFailed ? "Couldn't load" : undefined,
    });
  }

  // Sales today, whichever day the sales figures are pointed at.
  const salesTodayCount =
    scope === "yesterday"
      ? todayCountRows.filter((o: Row) => !o.is_training).length
      : dayCount;
  serviceStats.push({
    key: "sales-today",
    label: "Orders today",
    value: String(salesTodayCount),
    absent: scope === "yesterday" && todayCountFailed ? "Couldn't load" : undefined,
  });

  if (hasKitchen) {
    // Measured, not targeted. The outlier guard is the one /app/insights uses:
    // a ticket fired in July and bumped in September is a screen somebody left
    // open, not a two-month cook, and one of those drags a daily mean into
    // nonsense.
    let mins = 0;
    let counted = 0;
    for (const t of prepTickets) {
      const fired = new Date(t.fired_at as string).getTime();
      const done = new Date(t.fulfilled_at as string).getTime();
      if (!Number.isFinite(fired) || !Number.isFinite(done)) continue;
      const m = (done - fired) / 60000;
      if (m < 0 || m > 240) continue;
      mins += m;
      counted += 1;
    }
    serviceStats.push({
      key: "prep",
      label: "Average prep time",
      value: counted > 0 ? Math.round(mins / counted) + " min" : "—",
      absent: prepFailed
        ? "Couldn't load"
        : counted === 0
          ? "Nothing bumped " + scopeWordLower + " yet"
          : // The sample size is part of the claim. "14 min" off three tickets
            // and "14 min" off ninety are different statements, and a mean with
            // no n behind it invites an owner to act on noise.
            undefined,
    });
  }

  // How the orders arrived. The bucketing is /app/reports' own function, so the
  // two screens cannot drift — including where it is wrong, which it is for the
  // named delivery platforms. See docs/dashboard-overview-audit.md §4.
  const channels = channelMix(liveDayOrders);

  const openDrawer = openDrawers.length > 0 ? openDrawers[0] : null;
  const drawerStale =
    openDrawer != null && new Date(openDrawer.opened_at).getTime() < todayStart.getTime();

  // The till sentence. Not an error and not a warning — before opening, "no till
  // open" is simply where every restaurant starts its day, and this line has
  // survived three rebuilds of this page because it is the one that tells a
  // first-time merchant what to do next without accusing them of anything.
  const serviceState: { text: string; tone: "neutral" | "attention" } | null = drawerFailed
    ? null
    : drawerStale && openDrawer
      ? {
          text: "The till from " + dayOf(openDrawer.opened_at) + " is still open.",
          tone: "attention",
        }
      : openDrawer
        ? { text: "Till open since " + timeOf(openDrawer.opened_at) + ".", tone: "neutral" }
        : {
            text: "No till open yet. Open one to start tracking cash.",
            tone: "neutral",
          };

  const serviceAction = runsChecks
    ? { label: "Open floor plan", href: "/app/floor" }
    : hasKitchen
      ? { label: "Open the kitchen", href: "/app/kitchen" }
      : { label: "Go to the register", href: "/app/pos" };

  // --- 6 · Launch readiness ------------------------------------------------
  //
  // Skipped outright when the catalog query failed: a broken count would render
  // as "add at least one item" to a merchant with a full menu, which is exactly
  // the class of lie this page is being rebuilt to stop telling.
  const readiness =
    catalogFailed || drawerFailed
      ? null
      : evaluateReadiness({
          name: business.name,
          defaultTaxRate: (business as { default_tax_rate?: number }).default_tax_rate,
          finixMerchantState: (business as { finix_merchant_state?: string })
            .finix_merchant_state,
          goLive: (business as { go_live?: unknown }).go_live,
          activeItemCount: items.length,
          drawerSessionCount: everDrawers.length,
        });
  const isDemo = (business as { is_demo?: boolean }).is_demo === true;
  const showReadiness =
    readiness != null &&
    !readiness.ready &&
    !isDemo &&
    // Setup advice to someone who can't change any of it is just noise.
    (canEditMenu || canAccess(role, "manage_settings"));

  // --- 7 · The attention rail ---------------------------------------------
  //
  // UNCHANGED BY THE REBUILD. Every signal, threshold and rank below is exactly
  // what it was; only the row's anatomy moved. The competitor study found no
  // back office in the category has an exception rail at all and called this the
  // page's differentiator, and a differentiator is not a thing you rewrite while
  // restyling the cards around it.
  //
  // Every `detail` is a fragment, not a sentence. The rule the whole page
  // follows: when there is a number, the number speaks. The empty states keep
  // their sentences, because a blank screen is exactly when a person needs
  // telling what they are looking at.
  const signals: AttentionSignal[] = [];
  const degraded: string[] = [];

  // Kitchen: one row for the worst tier only. A rail that lists every late
  // ticket separately stops being a rail and becomes the KDS.
  if (hasKitchen) {
    if (kitchenFailed) {
      degraded.push("kitchen tickets");
    } else {
      const ages = kitchenTickets.map((t: Row) => minutesSince(t.fired_at, now));
      const oldest = ages.length ? Math.max(...ages) : 0;
      const late = ages.filter((m: number) => m >= aging.kdsLateMin).length;
      const warn = ages.filter(
        (m: number) => m >= aging.kdsWarnMin && m < aging.kdsLateMin
      ).length;
      if (late > 0) {
        signals.push({
          id: "kds-late",
          severity: "blocked",
          title: late + " kitchen ticket" + (late === 1 ? "" : "s") + " late",
          detail:
            "oldest " + formatDuration(oldest) + " · past " + aging.kdsLateMin + " min mark",
          href: "/app/kitchen",
          actionLabel: "Open the KDS",
          weight: oldest,
        });
      } else if (warn > 0) {
        signals.push({
          id: "kds-warn",
          severity: "attention",
          title: warn + " kitchen ticket" + (warn === 1 ? "" : "s") + " running long",
          detail:
            "oldest " + formatDuration(oldest) + " · late at " + aging.kdsLateMin + " min",
          href: "/app/kitchen",
          actionLabel: "Open the KDS",
          weight: oldest,
        });
      }
    }
  }

  // Open checks that nobody has dropped a bill on. A dropped check is waiting on
  // the guest, not on the restaurant, so it is excluded — same rule the floor
  // plan uses to stop a paying table glowing red.
  if (runsChecks) {
    if (ticketsFailed) {
      degraded.push("open checks");
    } else {
      const stale = openChecks
        .filter((t: Row) => !t.check_dropped_at)
        .map((t: Row) => ({ t: t, mins: minutesSince(t.opened_at, now) }))
        .filter((x: { mins: number }) => x.mins >= aging.checkLateMin);
      if (stale.length > 0) {
        // The query is ordered by opened_at ascending, so the first survivor of
        // the filter is the oldest check on the floor.
        const worst = stale[0];
        signals.push({
          id: "checks-stale",
          severity: "attention",
          title:
            stale.length +
            " check" +
            (stale.length === 1 ? "" : "s") +
            " open past " +
            aging.checkLateMin +
            " min",
          detail:
            (worst.t.label ? worst.t.label : "oldest") +
            " · open " +
            formatDuration(worst.mins) +
            ", no check dropped",
          href: canAccess(role, "void") ? "/app/live-ops" : "/app/pos",
          actionLabel: "See the floor",
          weight: worst.mins,
        });
      }
    }
  }

  // A void waiting on approval means a server is standing at a terminal unable
  // to finish a check. Nothing else on this page is more blocking than that.
  if (canApprove) {
    if (approvalsFailed) {
      degraded.push("pending approvals");
    } else if (approvals.length > 0) {
      const waited = minutesSince(approvals[0].created_at, now);
      signals.push({
        id: "approvals",
        severity: "blocked",
        title:
          approvals.length +
          " approval" +
          (approvals.length === 1 ? "" : "s") +
          " waiting on you",
        detail: "oldest pending " + formatDuration(waited),
        href: "/app/approvals",
        actionLabel: "Review",
        weight: waited + 1000, // outranks other blocked rows: a person is waiting
      });
    }
  }

  // 86'd and low stock are menu decisions, so they're addressed to whoever can
  // change the menu. A bookkeeper sees neither — they'd have no way to act.
  if (hasCatalog && canEditMenu) {
    if (catalogFailed) {
      degraded.push("menu availability");
    } else {
      const eightySixed = items.filter((i: Row) => i.out_of_stock === true);
      if (eightySixed.length > 0) {
        const names = eightySixed
          .slice(0, 3)
          .map((i: Row) => displayItemName(i.name))
          .join(", ");
        signals.push({
          id: "eighty-sixed",
          severity: "attention",
          title:
            eightySixed.length + " item" + (eightySixed.length === 1 ? "" : "s") + " 86'd",
          detail:
            names +
            (eightySixed.length > 3 ? " and " + (eightySixed.length - 3) + " more" : ""),
          href: "/app/catalog",
          actionLabel: "Manage menu",
          weight: eightySixed.length,
        });
      }

      const low = items.filter(
        (i: Row) => i.track_inventory === true && num(i.stock_qty) <= num(i.reorder_point)
      );
      if (low.length > 0) {
        signals.push({
          id: "low-stock",
          severity: "attention",
          title:
            low.length +
            " item" +
            (low.length === 1 ? "" : "s") +
            " at or below reorder point",
          detail:
            displayItemName(low[0].name) +
            " down to " +
            num(low[0].stock_qty) +
            (low.length > 1 ? " · " + (low.length - 1) + " more" : ""),
          href: "/app/inventory",
          actionLabel: "Review inventory",
          weight: low.length,
        });
      }
    }
  }

  // A till still open from a previous day means yesterday's cash was never
  // counted. That is money unaccounted for, not a stale UI state.
  if (canCloseDay) {
    if (drawerFailed) {
      degraded.push("the cash drawer");
    } else if (drawerStale && openDrawer) {
      signals.push({
        id: "drawer-unreconciled",
        severity: "blocked",
        title: "A till from " + dayOf(openDrawer.opened_at) + " was never closed",
        detail:
          "open " +
          formatDuration(minutesSince(openDrawer.opened_at, now)) +
          " · cash uncounted",
        href: "/app/pos/drawer",
        actionLabel: "Close the day",
        weight: minutesSince(openDrawer.opened_at, now),
      });
    }
  }

  // Missed clock-outs: 16 hours is the same threshold /app/clock and
  // /app/attendance use to call a punch orphaned. Only surfaced where there is
  // somewhere to fix it — both of those screens are full-service only.
  const missedPunches = onClock.filter(
    (e: Row) => minutesSince(e.clock_in, now) > 16 * 60
  );
  if (runsChecks && canEditStaff) {
    if (clockFailed) {
      degraded.push("the time clock");
    } else if (missedPunches.length > 0) {
      signals.push({
        id: "missed-punch",
        severity: "attention",
        title:
          missedPunches.length +
          " missed clock-out" +
          (missedPunches.length === 1 ? "" : "s"),
        detail:
          "on the clock " +
          formatDuration(
            Math.max(...missedPunches.map((e: Row) => minutesSince(e.clock_in, now)))
          ),
        href: "/app/attendance",
        actionLabel: "Fix punches",
        weight: missedPunches.length,
      });
    }
  }

  // The team and menu states that used to live in the operations band are still
  // said, and they are said where a person can act on them: as rail rows when
  // they are a problem, and as the readiness panel's checklist when the business
  // has not opened yet. What went with the band is the three-column layout, not
  // the sentences.
  if (hasStaff && !staffFailed && canEditStaff) {
    const activeStaff = staff.filter((s: Row) => s.is_active !== false).length;
    if (activeStaff === 0) {
      signals.push({
        id: "no-staff",
        severity: "attention",
        title: "No staff on file yet",
        detail: "sales aren't attributed to anyone",
        href: "/app/staff",
        actionLabel: "Add people",
        weight: 0,
      });
    }
  }
  if (hasCatalog && !catalogFailed && canEditMenu && items.length === 0) {
    signals.push({
      id: "empty-menu",
      severity: "attention",
      title: "Nothing to sell yet",
      detail: "the menu is empty · add your first item",
      href: "/app/catalog",
      actionLabel: "Manage menu",
      weight: 1,
    });
  }

  const rankedSignals = rankSignals(signals);

  // --- 8 · Chrome ----------------------------------------------------------

  // The heading names the day the sales figures cover, so it follows the scope
  // control rather than the wall clock.
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dayNoonMs));

  // A server-rendered link pair, the same shape as /app/reports' range presets.
  // Client state buys nothing here: there are two destinations and both are real
  // URLs an owner can bookmark or hand to a manager.
  const scopes: { key: "today" | "yesterday"; label: string; href: string }[] = [
    { key: "today", label: "Today", href: chartTab === "daily" ? "/app?chart=daily" : "/app" },
    {
      key: "yesterday",
      label: "Yesterday",
      href: chartTab === "daily" ? "/app?day=yesterday&chart=daily" : "/app?day=yesterday",
    },
  ];

  // THE ONLY EXPORT IN THE PRODUCT THAT IS BOTH DAY-SCOPED AND NOT BROKEN.
  //
  // /app/exports has three CSV buttons; all three point at /api/export/… while
  // the handlers live at /api/exports/…, so every one of them is a 404, and they
  // are whole-table dumps with no date parameters anyway. /app/reports has a
  // working client-side CSV over exactly the rows it is showing, and it takes a
  // range. So this carries the scope across and lands on the page that can
  // actually produce the file.
  //
  // No download glyph. It opens a page, and an arrow into a tray would promise a
  // file that does not arrive until you click again.
  const scopedDayKey = dayKey.format(new Date(dayNoonMs));
  const exportHref =
    scope === "today"
      ? "/app/reports?range=today"
      : "/app/reports?from=" + scopedDayKey + "&to=" + scopedDayKey;

  const asOf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(now));

  return (
    // `isolate` still earns its place: the grain layer sits above everything at
    // z-10 and this is what keeps it scoped to the dashboard rather than
    // resolving against the page root and covering the app shell.
    <div className="relative isolate max-w-7xl">
      {/* THE VERTICAL SCALE. Two steps and no others: 28px between major bands
          (the title block, the KPI band, the two-column detail region, the
          footer) and 16px between cards inside a band. The page used to run
          16 / 28 / 12 / 24 depending on which commit added which module, and
          nothing reads as unfinished faster than gaps that are nearly but not
          quite the same. */}
      <div className="space-y-7">
        {/* The title block and its controls are one group, so they sit on the
            16 step inside a band that is itself 28 from the next one. */}
        <div className="u-in flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            {/* "Overview", not the business name. The breadcrumb and the
                sidebar both already say which workspace this is, and the one
                thing a heading here can add is what the page is — everything
                below it is a summary of everything else, which is what the word
                means. The date under it is the only thing on this page that can
                be silently stale, so it is the subtitle. */}
            <h1 className="text-[26px] sm:text-3xl font-bold tracking-[-0.02em] leading-none">
              Overview
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{dateLabel}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/* Every back office in the category puts a scope control right
                here, and a page without one reads as unfinished even to someone
                who can't say why. Ours is narrow on purpose — it moves the sales
                figures and says so, rather than pretending to scope a service
                card that is only ever live.

                RADIUS NESTING: the track is rounded-lg (12px) with 2px of
                padding, so the pill inside wants 10px, not the 9.6 that
                rounded-md happens to be. */}
            <div
              className="inline-flex items-center rounded-lg bg-raised ring-1 ring-line p-0.5"
              title="Sets which day the sales figures cover. Current service and the attention list below are always live."
              role="group"
              aria-label="Which day the sales figures cover"
            >
              {scopes.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  aria-current={s.key === scope ? "page" : undefined}
                  className={
                    // u-press on both halves, not just the inactive one: the
                    // selected segment is still a link you can click, and a
                    // control where half the targets acknowledge a press and
                    // half don't feels broken in a way people report as "laggy".
                    "u-tx u-tx-move u-press u-focus rounded-[10px] px-3 py-1.5 text-[13px] " +
                    (s.key === scope
                      ? "bg-card font-medium text-foreground"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground")
                  }
                >
                  {s.label}
                </Link>
              ))}
            </div>

            {canExport && (
              <Button asChild variant="subtle" size="lg" className="px-3.5">
                <Link href={exportHref}>Export</Link>
              </Button>
            )}

            {/* THE PAGE'S ONE SOLID FILL. The mockup's header carries the scope
                control and the export and nothing else; this button stays
                anyway, because it is the only thing on the admin home that
                STARTS work rather than inspecting it, and a home screen with no
                way to begin is a report. Same height, same radius, same padding
                as its neighbour — the hierarchy is carried entirely by material,
                fill against surface, rather than by making one of them bigger. */}
            <Button asChild variant="brand" size="lg" className="px-3.5">
              <Link href="/app/pos">New sale</Link>
            </Button>
          </div>
        </div>

        {showReadiness && readiness && (
          <div className="u-in" style={enterAt(1)}>
            <ReadinessPanel report={readiness} />
          </div>
        )}

        {/* Four figures, above the columns rather than inside one, because the
            band is the summary of the whole page and burying it in the left
            column would make it look like part of the chart. */}
        <KpiStrip items={kpis} enterFrom={2} />

        {/* THE DETAIL REGION — two columns, packed by column rather than by row.
            The page has a silhouette here instead of four identical full-width
            bands, and the attention rail sits at the bottom right where it is
            still above the fold on any laptop.

            `lg:grid-rows-[auto_1fr]` plus the row-span on the right column is
            what buys column packing: a plain two-column grid aligns ROWS, which
            would put any mismatch inside each row instead of at the foot of the
            page and leave the service card stretched beside a chart.

            THE ORDER UTILITIES ARE NOT DECORATION. Collapsed to one column the
            rail moves to second place, directly under the KPI band — on a phone
            the reading order IS the priority order, and "what needs me" outranks
            "how is the day going" every time. On desktop the grid puts it back
            where the mockup has it, because there the eye takes the whole page
            in at once and position means something different. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          <div
            className="u-in order-2 min-w-0 flex lg:order-none lg:col-start-1 lg:row-start-1"
            style={enterAt(6)}
          >
            <SalesPerformanceCard
              bars={seriesBars}
              ceiling={seriesCeiling}
              currency={currency}
              tabs={chartTabs}
              activeTab={chartTab}
              scopeWord={chartTab === "daily" ? "Daily net" : scopeWord}
              peakLabel={chartTab === "daily" ? "Best day" : "Highest sales hour"}
              // Thirteen ticks reading "9 AM" will not fit across a phone and
              // barely fit across a laptop column; fourteen reading "Tu" will.
              tickEvery={chartTab === "daily" ? 1 : seriesBars.length > 8 ? 2 : 1}
              failed={seriesFailed}
              emptyLine={chartTab === "daily" ? dailyEmpty : hourlyEmpty}
              className="flex-1"
            />
          </div>

          <div className="order-1 min-w-0 flex flex-col gap-4 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2">
            {/* The rail is FIRST in the DOM so it is first after the KPI band on
                a phone, and the grid pulls it to the second row on desktop. */}
            <div className="u-in order-2 flex lg:order-none" style={enterAt(8)}>
              <CurrentServiceCard
                stats={serviceStats}
                channels={channels}
                state={serviceState}
                action={serviceAction}
                emptyLine={
                  "Nothing rung " +
                  scopeWordLower +
                  " yet, so there is no split to draw. Dine-in, takeout and delivery each take a share of this bar as orders land."
                }
              />
            </div>

            <div className="u-in order-1 flex flex-1 lg:order-none" style={enterAt(7)}>
              <AttentionRail
                signals={rankedSignals}
                degraded={degraded}
                className="flex-1"
              />
            </div>
          </div>

          <div
            className="u-in order-3 min-w-0 flex lg:col-start-1 lg:row-start-2"
            style={enterAt(9)}
          >
            <TopItemsCard
              rows={topItems}
              currency={currency}
              failed={linesFailed}
              href="/app/reports"
              hrefLabel="View report"
              emptyTitle={
                hasCatalog && !catalogFailed && items.length === 0
                  ? "Nothing on the menu yet"
                  : "Nothing sold " + scopeWordLower + " yet"
              }
              emptyLine={
                hasCatalog && !catalogFailed && items.length === 0
                  ? "Add your first item and it starts earning a place here the moment somebody orders it."
                  : "The four biggest earners of the day appear here, with the quantity behind each one."
              }
              className="flex-1"
            />
          </div>
        </div>

        <DashboardFooter asOf={asOf} currency={currency} isDemo={isDemo} />
      </div>

      {/* The grain, last and on top. It covers the cards as well as the canvas
          on purpose — film grain belongs to the photograph, not to one object in
          it, and a page where only the background is textured reads as cards
          pasted onto a texture rather than as one surface. At 3.2% (4.5% on ink)
          it is under the threshold where a reader can identify it; what they
          notice is its absence, as everything looking slightly more like a
          render. pointer-events-none is load-bearing — this layer sits over
          every link on the page. */}
      <div aria-hidden className="u-grain absolute -inset-x-8 inset-y-0 z-10" />
    </div>
  );
}
