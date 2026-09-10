import { createClient } from "@/lib/supabase/server";
import { getTodayBoundsUTC, getDayBoundsUTC } from "@/lib/utils/dates";
import { must, soft } from "@/lib/supabase/query";
import { displayItemName, formatDuration } from "@/lib/format";
import { canAccess } from "@/lib/services/route-access";
import { enabledModules } from "@/lib/modules/resolve";
import { hasFloorService } from "@/lib/modules/modes";
import { evaluateReadiness } from "@/lib/services/launch-readiness";
import {
  agingThresholds,
  computePace,
  cumulativeCurve,
  minutesSince,
  paymentMix,
  rankSignals,
  type AttentionSignal,
  type CurvePoint,
  type Pace,
} from "@/lib/services/dashboard-signals";
import {
  AttentionRail,
  ChecksTable,
  DailySalesCard,
  KpiStrip,
  OpsBlock,
  PaymentMixCard,
  ReadinessPanel,
  TodayModule,
  money,
  type CheckRow,
  type DayBar,
  type Kpi,
  type KpiDelta,
  type OpsStat,
  type PaceCurve,
  type RowTint,
} from "./dashboard-modules";
import Link from "next/link";
import {
  Banknote,
  Calculator,
  ChefHat,
  Package,
  Receipt,
  Undo2,
  Users,
} from "lucide-react";

// The admin home page for every non-transportation business.
//
// It answers exactly one question: what needs me in the next two minutes? That
// is why it isn't a wall of equal cards. The old version showed seven KPI tiles
// of identical weight — today's sales, transactions, avg ticket, low stock,
// this week, this month, avg ticket again — and an owner scanning it learned
// nothing they could act on. Week and month totals are reporting, not
// operations; they live in /app/reports, where you go on purpose.
//
// The order below is the priority order, and it is deliberate:
//
//   0. Launch readiness   — only while setup is unfinished. Outranks everything,
//                           because nothing else on the page can move until it's
//                           done.
//   1. Today, with pace   — one dominant number, against the same weekday last
//                           week, truncated to the same time of day.
//   2. Needs you now      — real exceptions only, ranked by urgency, each row
//                           linking to the screen that resolves it.
//   3. Three ops blocks   — Service / Menu & stock / Team. A number, a state,
//                           one action.
//   4. The check register — recent and open checks with real status.
//
// THE EMPTY CASE IS THE DESIGN CASE. Most tenants looking at this page have no
// sales today: it's 9am, or they opened last week, or they're a brand-new
// merchant who hasn't rung anything. A dashboard that only reads well with a
// busy Friday behind it is a dashboard that fails most of the people who open
// it. So every module here has a written zero state, and — the lesson from the
// Orders hub, which rendered a calm empty screen over a broken query — a quiet
// day and a failed load never look the same.

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

/** Channel/dining label, from the column when it's set and the snapshot when it isn't. */
function channelLabel(channel: unknown, snapshot: unknown): string | null {
  const c = typeof channel === "string" ? channel.toLowerCase() : "";
  const map: Record<string, string> = {
    kiosk: "Kiosk",
    online: "Online",
    qr: "QR order",
  };
  if (c && map[c]) return map[c];
  if (c) return c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " ");
  // dining_option has never been a column — it lives in the immutable snapshot.
  // Selecting it as one is what broke the Orders hub; see app/app/orders/page.tsx.
  const snap = (snapshot ?? null) as { dining_option?: string | null } | null;
  const d = (snap?.dining_option ?? "").toLowerCase();
  const dining: Record<string, string> = {
    dine_in: "Dine-in",
    takeout: "Takeout",
    delivery: "Delivery",
    pickup: "Pickup",
  };
  return dining[d] ?? null;
}

/** Half-hourly: fine enough to show a rush, coarse enough to stay a line. */
const CHART_STEPS = 48;

/**
 * Two weeks of bars. Long enough that both of last week's Fridays are on
 * screen — a weekly rhythm needs two cycles before it looks like a rhythm —
 * and short enough that fourteen bars still fit legibly across a phone.
 */
const WINDOW_DAYS = 14;

/**
 * A `Pace` turned into the arrow-and-figure line under a KPI.
 *
 * The arrow follows the raw sign but the colour follows `computePace`'s level
 * band, which is why `neutral` exists: a restaurant that is 4% up on last
 * Tuesday is not up, it is having the same Tuesday, and painting that green
 * teaches an owner to ignore green. The arrow still points, because the number
 * beside it has a sign and they must not disagree.
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
    good: "up",
    neutral: pace.status === "level",
  };
}

export async function PosDashboard({
  business,
  role,
  day,
}: {
  business: Biz;
  role: string | null | undefined;
  /** The scope control's only value. Anything but "yesterday" means today. */
  day?: string;
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
  // Open checks, table aging, the time clock and /app/attendance are all
  // full-service concepts today — hasFloorService() is the same predicate the
  // register, the floor plan and the accounting pages gate on. Bar mode runs
  // tabs and arguably belongs here too, but widening that predicate changes a
  // dozen other screens, so it stays a separate decision.
  const runsChecks = hasFloorService(business as { config?: { mode?: string } | null });

  const canApprove = canAccess(role, "void");
  const canEditMenu = canAccess(role, "edit_menu");
  const canEditStaff = canAccess(role, "edit_staff");
  const canCloseDay = canAccess(role, "close_day");

  const settings = (business as { settings?: unknown }).settings;
  const aging = agingThresholds(settings);

  // --- Time windows --------------------------------------------------------
  //
  // The scope control moves the sales figures and nothing else. An exception
  // rail scoped to yesterday would list tickets nobody can still act on, which
  // is the opposite of what a rail is for — so the alerts, the ops blocks and
  // the register stay live whatever the control says, and the strip says so.
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
  // Probed from the middle of the scoped day so a DST shift can't land the
  // arithmetic on the wrong local date.
  const dayNoonMs = dayStart.getTime() + dayLengthMs / 2;
  const { start: benchStart, end: benchEnd } = getDayBoundsUTC(
    new Date(dayNoonMs - 7 * 24 * 60 * 60 * 1000),
    tz
  );
  const benchLengthMs = benchEnd.getTime() - benchStart.getTime();
  const benchCutoff = benchStart.getTime() + elapsedMs;

  // The fortnight the bar chart and the payment donut both read. It ends where
  // the scoped day ends rather than at the wall clock, so the last bar is
  // always the day the hero number is talking about — a trend block whose last
  // column disagreed with the headline above it would be worse than no trend.
  //
  // Probed from noon, like every other date here, so a DST changeover can't
  // shift the window a day.
  const windowStart = getDayBoundsUTC(
    new Date(dayNoonMs - (WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000),
    tz
  ).start;

  const orderSel =
    "id, sale_number, total, created_at, status, payment_method, is_training, channel, snapshot, staff_id";

  const [
    dayRes,
    benchRes,
    windowRes,
    todayCountRes,
    recentRes,
    catalogRes,
    ticketsRes,
    kitchenRes,
    approvalsRes,
    drawerRes,
    everDrawerRes,
    clockRes,
    staffRes,
  ] = await Promise.all([
    // THE page query. An empty dashboard has to mean "no sales today" and can
    // never mean "the select was wrong" — must() throws so the error boundary
    // shows the failure instead of a convincing $0.00. created_at rides along
    // because the chart needs to know when in the day each sale landed.
    // `status` rides along for the refunds KPI: the rows are already here, and
    // a second query to count three refunds would be a second chance to fail.
    supabase
      .from("orders")
      .select("total, created_at, is_training, status")
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

    // One query, two charts. The daily bars need amount-by-day and the payment
    // donut needs amount-by-tender over the same fortnight, and asking twice
    // would double the rows read to answer two halves of one question.
    //
    // COST: this reads every order in the window — four columns, but a busy
    // restaurant is a few thousand rows on every dashboard load. The right
    // answer is a daily-totals rollup in the database, which is a migration and
    // therefore not this change. There is deliberately no LIMIT: a truncated
    // window would quietly understate the totals, and a chart that is wrong is
    // worse than a chart that is slow.
    supabase
      .from("orders")
      .select("total, created_at, is_training, payment_method")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", windowStart.toISOString())
      .lt("created_at", dayEnd.toISOString()),

    // The Service block says "N sales today" and means it, so when the scope
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

    supabase
      .from("orders")
      .select(orderSel)
      .eq("business_id", business.id)
      .neq("status", "voided")
      .order("created_at", { ascending: false })
      .limit(12),

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
          .select("id, label, opened_at, guest_count, check_dropped_at, cart, staff_id")
          .eq("business_id", business.id)
          .order("opened_at", { ascending: true })
      : NOT_ASKED,

    hasKitchen
      ? supabase
          .from("kitchen_tickets")
          .select("id, label, fired_at")
          .eq("business_id", business.id)
          .is("fulfilled_at", null)
          .order("fired_at", { ascending: true })
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

    // Readiness only needs to know whether a till has *ever* been opened, so
    // one row is enough — cheaper than a count over a year of sessions.
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

  // soft() returns the fallback on failure, which is indistinguishable from
  // "no rows" — so we keep the error flag alongside every list. That flag is
  // what lets a module say "couldn't load" instead of quietly showing a zero.
  const benchFailed = benchRes.error != null;
  const windowFailed = windowRes.error != null;
  const todayCountFailed = todayCountRes.error != null;
  const recentFailed = recentRes.error != null;
  const catalogFailed = catalogRes.error != null;
  const ticketsFailed = ticketsRes.error != null;
  const kitchenFailed = kitchenRes.error != null;
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
  const todayCountRows = soft("dashboard → today's sale count", todayCountRes, [] as Row[]);
  const recentRows = soft("dashboard → recent sales", recentRes, [] as Row[]);
  const items = soft("dashboard → menu & stock", catalogRes, [] as Row[]);
  const openChecks = soft("dashboard → open checks", ticketsRes, [] as Row[]);
  const kitchenTickets = soft("dashboard → kitchen tickets", kitchenRes, [] as Row[]);
  const approvals = soft("dashboard → pending approvals", approvalsRes, [] as Row[]);
  const openDrawers = soft("dashboard → open drawer", drawerRes, [] as Row[]);
  const everDrawers = soft("dashboard → drawer history", everDrawerRes, [] as Row[]);
  const onClock = soft("dashboard → time clock", clockRes, [] as Row[]);
  const staff = soft("dashboard → staff", staffRes, [] as Row[]);

  // --- 1 · Today, with pace ------------------------------------------------
  //
  // A sale counts as refunded when the *order* carries that status, which means
  // it is attributed to the day the sale was rung, not the day the money went
  // back. That is the right attribution for "how much of today did we give
  // back", and the wrong one for a cash-flow report — which is why this stays a
  // dashboard signal and /app/reports keeps its own refund figures.
  const isRefunded = (o: Row) =>
    o.status === "refunded" || o.status === "partially_refunded";

  let dayGross = 0;
  let dayCount = 0;
  let dayRefunds = 0;
  const dayPoints: CurvePoint[] = [];
  for (const o of dayRows) {
    if (o.is_training) continue;
    const t = num(o.total);
    dayGross += t;
    dayCount += 1;
    if (isRefunded(o)) dayRefunds += 1;
    dayPoints.push({ at: o.created_at, amount: t });
  }

  let benchSoFar = 0;
  let benchFull = 0;
  let benchCountSoFar = 0;
  let benchCountFull = 0;
  let benchRefundsSoFar = 0;
  const benchPoints: CurvePoint[] = [];
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
    benchPoints.push({ at: o.created_at, amount: t });
  }
  const pace = computePace(dayGross, benchSoFar, benchFull);

  // Named up here because every delta on the page ends "…vs last Wednesday".
  const weekday = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "long",
  }).format(new Date(benchStart.getTime() + benchLengthMs / 2));

  // --- 1b · The KPI strip --------------------------------------------------
  //
  // Every figure here comes out of the two queries above. The strip exists to
  // put four numbers where an owner's eye lands first; it does not get to cost
  // four more round trips to do it.
  const txPace = computePace(dayCount, benchCountSoFar, benchCountFull);
  const avgToday = dayCount > 0 ? dayGross / dayCount : 0;
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

  // Counts, not money, so a percentage is the wrong shape: "↑ 200%" off a base
  // of one refund is technically true and operationally meaningless. And the
  // good direction inverts — this is the only card on the strip where the
  // arrow going up is painted red.
  const refundDelta: KpiDelta | null =
    benchFailed || benchCountSoFar === 0
      ? null
      : dayRefunds === benchRefundsSoFar
        ? {
            direction: "flat",
            text: "Level",
            suffix: "with last " + weekday,
            good: "down",
          }
        : {
            direction: dayRefunds > benchRefundsSoFar ? "up" : "down",
            text:
              Math.abs(dayRefunds - benchRefundsSoFar) +
              (dayRefunds > benchRefundsSoFar ? " more" : " fewer"),
            suffix: "than last " + weekday,
            good: "down",
          };

  const scopeWordLower = scope === "today" ? "today" : "yesterday";
  const kpis: Kpi[] = [
    {
      id: "sales",
      label: "Sales " + scopeWordLower,
      value: money(dayGross, currency),
      icon: <Banknote />,
      hue: 1,
      delta: benchFailed ? null : paceDelta(pace, weekday),
      note: noBenchNote,
    },
    {
      id: "transactions",
      label: "Transactions",
      value: String(dayCount),
      icon: <Receipt />,
      hue: 2,
      delta: benchFailed ? null : paceDelta(txPace, weekday),
      note: noBenchNote,
    },
    {
      id: "average-check",
      label: "Average check",
      // The average of no sales is not zero, it is undefined, and "$0.00"
      // would read as a day where everything was comped.
      value: dayCount > 0 ? money(avgToday, currency) : "—",
      icon: <Calculator />,
      hue: 3,
      delta: dayCount === 0 || benchFailed ? null : paceDelta(avgPace, weekday),
      note: dayCount === 0 ? "No sales " + scopeWordLower + " to average." : noBenchNote,
    },
    {
      id: "refunds",
      label: "Refunds",
      value: String(dayRefunds),
      icon: <Undo2 />,
      hue: 6,
      delta: refundDelta,
      note: noBenchNote,
    },
  ];

  // --- 1c · The fortnight: daily bars and the payment mix ------------------
  //
  // Bucketed by the business's own local date rather than by UTC arithmetic:
  // a 9pm sale in Vancouver is the same calendar day as an 11am one, and only
  // the timezone formatter reliably knows that across a DST boundary.
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
  const mixInput: { method: unknown; amount: number }[] = [];
  for (const o of windowRows) {
    if (o.is_training) continue;
    const t = num(o.total);
    const k = dayKey.format(new Date(o.created_at));
    windowByDay.set(k, (windowByDay.get(k) ?? 0) + t);
    mixInput.push({ method: o.payment_method, amount: t });
  }

  // Built from the calendar, not from the rows, so a closed Monday is a bar of
  // zero rather than a day that silently isn't there. A gap in a bar chart
  // reads as "we lost the data"; an empty track reads as "we were shut".
  const dayBars: DayBar[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const at = new Date(dayNoonMs - i * 24 * 60 * 60 * 1000);
    const k = dayKey.format(at);
    dayBars.push({
      key: k,
      tick: tickOf.format(at),
      full: fullOf.format(at),
      amount: windowByDay.get(k) ?? 0,
      current: i === 0,
    });
  }

  const windowTotal = dayBars.reduce((s, b) => s + b.amount, 0);
  const lastSeven = dayBars.slice(7).reduce((s, b) => s + b.amount, 0);
  const priorSeven = dayBars.slice(0, 7).reduce((s, b) => s + b.amount, 0);
  // Week against week out of the fortnight already in hand — no third query,
  // and a comparison that survives one dead Tuesday in a way a day-on-day
  // figure never does.
  const windowTrend: KpiDelta | null =
    priorSeven <= 0
      ? null
      : (() => {
          const pct = ((lastSeven - priorSeven) / priorSeven) * 100;
          return {
            direction: pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat",
            text:
              (Math.abs(pct) < 10
                ? Math.abs(pct).toFixed(1)
                : String(Math.round(Math.abs(pct)))) + "%",
            suffix: "vs the 7 days before",
            good: "up",
          } as KpiDelta;
        })();

  const mix = paymentMix(mixInput);
  const mixTotal = mixInput.reduce((s, m) => s + m.amount, 0);

  // Sales today, whichever day the sales figures are pointed at.
  const salesTodayCount =
    scope === "yesterday"
      ? todayCountRows.filter((o: Row) => !o.is_training).length
      : dayCount;

  // Null once the day being shown is over: "at 2:15 p.m." would be describing
  // a truncation that no longer happens.
  const benchTimeLabel =
    scope === "today"
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(now))
      : null;

  // The chart is the pace comparison drawn, so it is built from exactly the
  // same rows. The benchmark series is withheld — not zeroed — when the query
  // failed or the day genuinely took nothing, because a line pinned to the
  // floor looks like a reading and a missing line does not.
  const elapsedFrac = dayLengthMs > 0 ? elapsedMs / dayLengthMs : 1;
  const curve: PaceCurve = {
    today: cumulativeCurve(dayPoints, dayStart.getTime(), dayLengthMs, CHART_STEPS).slice(
      0,
      Math.max(1, Math.min(CHART_STEPS, Math.ceil(elapsedFrac * CHART_STEPS)))
    ),
    benchmark:
      benchFailed || benchFull <= 0
        ? []
        : cumulativeCurve(benchPoints, benchStart.getTime(), benchLengthMs, CHART_STEPS),
    steps: CHART_STEPS,
    nowFrac: scope === "today" ? elapsedFrac : null,
    xLabels: [0.25, 0.5, 0.75].map((at) => ({
      at,
      text: new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        hour: "numeric",
      }).format(new Date(dayStart.getTime() + dayLengthMs * at)),
    })),
  };

  const liveRecent = recentRows.filter((o: Row) => !o.is_training);
  const lastSale = liveRecent[0];
  const lastSaleLabel = lastSale ? dayOf(lastSale.created_at) : null;
  // "Never sold anything" and "hasn't sold anything lately" want different
  // sentences, and we only get to tell them apart when the query succeeded.
  const everSold = recentFailed ? true : liveRecent.length > 0;

  // --- 0 · Launch readiness ------------------------------------------------
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
  const showReadiness =
    readiness != null &&
    !readiness.ready &&
    (business as { is_demo?: boolean }).is_demo !== true &&
    // Setup advice to someone who can't change any of it is just noise.
    (canEditMenu || canAccess(role, "manage_settings"));

  // --- 2 · The attention rail ---------------------------------------------
  //
  // Every `detail` below is a fragment, not a sentence. The rule the whole
  // page now follows: when there is a number, the number speaks. "Oldest fired
  // 31 min ago, past your 18-minute mark. Someone is waiting on food." said
  // three things — one of them a number, one of them the threshold, one of them
  // a feeling — and the row's own title had already said the first. The empty
  // states keep their sentences, because a blank screen is exactly when a
  // person needs telling what they are looking at.
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

  // Open checks that nobody has dropped a bill on. A dropped check is waiting
  // on the guest, not on the restaurant, so it is excluded — same rule the
  // floor plan uses to stop a paying table glowing red.
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
          title: stale.length + " check" + (stale.length === 1 ? "" : "s") + " open past " + aging.checkLateMin + " min",
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
          title: low.length + " item" + (low.length === 1 ? "" : "s") + " at or below reorder point",
          detail:
            displayItemName(low[0].name) +
            " down to " +
            num(low[0].stock_qty) +
            (low.length > 1 ? " · " + (low.length - 1) + " more" : ""),
          href: "/app/inventory",
          actionLabel: "Reorder",
          weight: low.length,
        });
      }
    }
  }

  // A till still open from a previous day means yesterday's cash was never
  // counted. That is money unaccounted for, not a stale UI state.
  const openDrawer = openDrawers.length > 0 ? openDrawers[0] : null;
  const drawerStale =
    openDrawer != null && new Date(openDrawer.opened_at).getTime() < todayStart.getTime();
  if (canCloseDay) {
    if (drawerFailed) {
      degraded.push("the cash drawer");
    } else if (drawerStale && openDrawer) {
      signals.push({
        id: "drawer-unreconciled",
        severity: "blocked",
        title: "A till from " + dayOf(openDrawer.opened_at) + " was never closed",
        detail: "open " + formatDuration(minutesSince(openDrawer.opened_at, now)) + " · cash uncounted",
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

  const rankedSignals = rankSignals(signals);

  // --- 3 · Operational blocks ---------------------------------------------
  const staffById: Record<string, string> = {};
  for (const s of staff) staffById[s.id as string] = (s.name as string) ?? "";

  const serviceStats: OpsStat[] = [];
  let serviceState: string;
  let serviceTone: "neutral" | "good" | "attention" = "neutral";

  if (runsChecks) {
    const covers = openChecks.reduce((sum: number, t: Row) => sum + num(t.guest_count), 0);
    serviceStats.push({ value: String(openChecks.length), label: "checks open" });
    serviceStats.push({ value: String(covers), label: "covers seated", muted: covers === 0 });
  } else if (hasKitchen) {
    serviceStats.push({ value: String(kitchenTickets.length), label: "tickets in the kitchen" });
    serviceStats.push({
      value: String(salesTodayCount),
      label: "sales today",
      muted: salesTodayCount === 0,
    });
  } else {
    serviceStats.push({
      value: String(salesTodayCount),
      label: "sales today",
      muted: salesTodayCount === 0,
    });
  }

  if (drawerStale && openDrawer) {
    serviceState = "The till from " + dayOf(openDrawer.opened_at) + " is still open.";
    serviceTone = "attention";
  } else if (openDrawer) {
    serviceState = "Till open since " + timeOf(openDrawer.opened_at) + ".";
    serviceTone = "good";
  } else {
    // Not an error and not a warning. Before opening, "no till open" is simply
    // where every restaurant starts its day.
    serviceState = "No till open yet. Open one to start tracking cash.";
  }

  const menuStats: OpsStat[] = [];
  let menuState: string;
  let menuTone: "neutral" | "good" | "attention" = "neutral";
  const eightySixedCount = items.filter((i: Row) => i.out_of_stock === true).length;
  const lowCount = items.filter(
    (i: Row) => i.track_inventory === true && num(i.stock_qty) <= num(i.reorder_point)
  ).length;
  menuStats.push({ value: String(items.length), label: "items on the menu", muted: items.length === 0 });
  menuStats.push({ value: String(eightySixedCount), label: "86'd", muted: eightySixedCount === 0 });
  if (items.length === 0) {
    menuState = "Nothing to sell yet — add your first item.";
    menuTone = "attention";
  } else if (lowCount > 0) {
    menuState = lowCount + " item" + (lowCount === 1 ? "" : "s") + " at or below the reorder point.";
    menuTone = "attention";
  } else {
    menuState = "Everything available and above its reorder point.";
    menuTone = "good";
  }

  const teamStats: OpsStat[] = [];
  let teamState: string;
  let teamTone: "neutral" | "good" | "attention" = "neutral";
  const activeStaff = staff.filter((s: Row) => s.is_active !== false).length;
  if (runsChecks) {
    teamStats.push({ value: String(onClock.length), label: "on the clock", muted: onClock.length === 0 });
  }
  teamStats.push({ value: String(activeStaff), label: "active staff", muted: activeStaff === 0 });
  if (activeStaff === 0) {
    teamState = "No staff on file yet. Add people so sales are attributed.";
    teamTone = "attention";
  } else if (missedPunches.length > 0 && runsChecks) {
    teamState =
      missedPunches.length +
      " punch" +
      (missedPunches.length === 1 ? "" : "es") +
      " still open past 16 hours.";
    teamTone = "attention";
  } else if (runsChecks && onClock.length === 0) {
    teamState = "Nobody is clocked in right now.";
  } else if (runsChecks) {
    teamState = "Everyone on shift is clocked in cleanly.";
    teamTone = "good";
  } else {
    teamState = activeStaff + " " + (activeStaff === 1 ? "person" : "people") + " can ring sales.";
  }

  // --- 4 · The check register ---------------------------------------------
  //
  // Three tints, one meaning each: amber is still moving, green is finished and
  // right, red is money that went backwards. Deliberately coarser than the
  // status chip beside it — the chip already distinguishes "open 12m" from
  // "open 2h", and a register with five shades of amber in it is a register you
  // have to decode rather than scan.
  const checkRows: CheckRow[] = [];

  // Open checks first — they're live money, and unlike a settled sale they can
  // still be acted on.
  if (runsChecks && !ticketsFailed) {
    for (const t of openChecks) {
      const mins = minutesSince(t.opened_at, now);
      const cart = (t.cart ?? {}) as { items?: unknown[] };
      const lines = Array.isArray(cart.items) ? cart.items.length : 0;
      const tone =
        mins >= aging.checkLateMin
          ? "danger"
          : mins >= aging.checkWarnMin
            ? "warning"
            : "info";
      checkRows.push({
        id: "check-" + t.id,
        label: (t.label as string) || "Open check",
        time: timeOf(t.opened_at),
        channel: num(t.guest_count) > 0 ? num(t.guest_count) + " guests" : null,
        who: t.staff_id ? staffById[t.staff_id as string] ?? null : null,
        status: {
          text: t.check_dropped_at ? "Check dropped" : "Open " + formatDuration(mins),
          tone: t.check_dropped_at ? "success" : tone,
        },
        // Deliberately no dollar figure. The running total of an open cart is
        // computed by the register (modifiers, seat splits, comps, service
        // charge) and this page has no business re-deriving money it can't
        // verify. Line count is the honest number here.
        amount: lines > 0 ? lines + (lines === 1 ? " line" : " lines") : "—",
        href: "/app/pos",
        open: true,
        tint: "amber" as RowTint,
      });
    }
  }

  for (const o of liveRecent.slice(0, 8)) {
    const refunded = o.status === "refunded";
    const partial = o.status === "partially_refunded";
    const snap = (o.snapshot ?? null) as { staff?: { name?: string } } | null;
    checkRows.push({
      id: "order-" + o.id,
      label: o.sale_number != null ? "Sale #" + o.sale_number : "Sale",
      time: timeOf(o.created_at),
      channel: channelLabel(o.channel, o.snapshot),
      who:
        snap?.staff?.name ??
        (o.staff_id ? staffById[o.staff_id as string] ?? null : null),
      status: refunded
        ? { text: "Refunded", tone: "danger" }
        : partial
          ? { text: "Partial refund", tone: "warning" }
          : { text: "Paid", tone: "success" },
      amount: money(num(o.total), currency),
      href: "/app/pos/sales",
      open: false,
      tint: (refunded || partial ? "red" : "green") as RowTint,
    });
  }

  // The heading names the day the sales figures cover, so it follows the scope
  // control rather than the wall clock.
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(dayNoonMs));

  // A server-rendered link pair, the same shape as /app/reports' range presets.
  // Client state buys nothing here: there are two destinations and both are
  // real URLs an owner can bookmark or hand to a manager.
  const scopes: { key: "today" | "yesterday"; label: string; href: string }[] = [
    { key: "today", label: "Today", href: "/app" },
    { key: "yesterday", label: "Yesterday", href: "/app?day=yesterday" },
  ];

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* No "Welcome back". The heading's job is to say which day's numbers
              these are, because that is the only thing on this page that can
              be silently stale. */}
          <h1 className="text-xl font-semibold tracking-tight">{business.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{dateLabel}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {runsChecks && canApprove && (
            <Link
              href="/app/live-ops"
              className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
            >
              Live ops
            </Link>
          )}
          <Link
            href="/app/pos"
            className="px-3 py-1.5 text-sm rounded-md border border-foreground bg-accent font-medium"
          >
            New sale
          </Link>
        </div>
      </div>

      {/* Every back office in the category puts a scope control right here, and
          a page without one reads as unfinished even to someone who can't say
          why. Ours is narrow on purpose — it moves the sales figures and says
          so, rather than pretending to scope alerts that are only ever live. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* The explanation used to be a paragraph beside this control. It was
            true — the alerts and the register really are always live — and it
            was a sentence of prose sitting above the numbers, which is the
            trade this page keeps losing. It survives as a tooltip. */}
        <div
          className="inline-flex items-center rounded-lg bg-raised ring-1 ring-line p-0.5"
          title="Sets which day the sales figures cover. The alerts and the register below are always live."
        >
          {scopes.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              aria-current={s.key === scope ? "page" : undefined}
              className={
                "rounded-md px-3 py-1 text-[13px] transition-colors " +
                (s.key === scope
                  ? "bg-card font-medium text-foreground shadow-elevation-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {showReadiness && readiness && <ReadinessPanel report={readiness} />}

      {/* Four numbers where the eye lands. Above the columns rather than inside
          one, because the strip is the summary of the whole page and burying it
          in the left column would make it look like part of the sales module. */}
      <KpiStrip items={kpis} />

      {/* Two columns at desktop width, so the page has a silhouette instead of
          five identical full-width bands. The order utilities matter: collapsed
          to one column the reading order has to stay sales → alerts → ops →
          register, which is the priority order this page exists to express. */}
      <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr]">
        <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
          <TodayModule
            pace={pace}
            currency={currency}
            weekday={weekday}
            scope={scope}
            benchmarkTimeLabel={benchTimeLabel}
            lastSaleLabel={lastSaleLabel}
            everSold={everSold}
            failed={benchFailed}
            curve={curve}
          />
        </div>

        <div className="order-2 min-w-0 flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-3">
          <AttentionRail signals={rankedSignals} degraded={degraded} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <OpsBlock
              title="Service"
              icon={<ChefHat />}
              stats={serviceStats}
              state={serviceState}
              tone={serviceTone}
              action={
                canCloseDay
                  ? {
                      label: openDrawer ? "Close the day" : "Open the till",
                      href: "/app/pos/drawer",
                    }
                  : { label: "Go to the register", href: "/app/pos" }
              }
              failed={
                runsChecks
                  ? ticketsFailed
                  : hasKitchen
                    ? kitchenFailed || todayCountFailed
                    : todayCountFailed
              }
            />

            {hasCatalog && (
              <OpsBlock
                title="Menu & stock"
                icon={<Package />}
                stats={menuStats}
                state={menuState}
                tone={menuTone}
                // Read-only for everyone (staff have always been able to look at
                // the menu), but only the people who can change it get the way in.
                action={canEditMenu ? { label: "Manage menu", href: "/app/catalog" } : null}
                failed={catalogFailed}
              />
            )}

            {hasStaff && (
              <OpsBlock
                title="Team"
                icon={<Users />}
                stats={teamStats}
                state={teamState}
                tone={teamTone}
                action={
                  canEditStaff
                    ? runsChecks
                      ? { label: "Attendance", href: "/app/attendance" }
                      : { label: "Manage staff", href: "/app/staff" }
                    : null
                }
                failed={staffFailed || (runsChecks && clockFailed)}
              />
            )}
          </div>

          {/* The donut lands under the ops blocks, in the narrow column: it is
              a shape you glance at, and the legend beside it is four short
              rows, so it wants a column rather than a band. */}
          <PaymentMixCard
            slices={mix}
            total={mixTotal}
            currency={currency}
            failed={windowFailed}
          />
        </div>

        <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">
          <DailySalesCard
            bars={dayBars}
            total={windowTotal}
            trend={windowTrend}
            currency={currency}
            failed={windowFailed}
          />
        </div>

        <div className="order-4 min-w-0 lg:col-start-1 lg:row-start-3">
          <ChecksTable
            rows={checkRows}
            failed={recentFailed}
            title={runsChecks ? "Open & recent checks" : "Recent sales"}
            note="Live, not scoped"
            itemHeading={runsChecks ? "Check" : "Sale"}
            href="/app/orders"
            hrefLabel="All orders"
          />
        </div>
      </div>
    </div>
  );
}
