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
  minutesSince,
  rankSignals,
  type AttentionSignal,
} from "@/lib/services/dashboard-signals";
import {
  AttentionRail,
  ChecksTable,
  OpsBlock,
  ReadinessPanel,
  TodayModule,
  money,
  type CheckRow,
  type OpsStat,
} from "./dashboard-modules";
import Link from "next/link";
import { ChefHat, Package, Users } from "lucide-react";

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

export async function PosDashboard({
  business,
  role,
}: {
  business: Biz;
  role: string | null | undefined;
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
  const { start: todayStart, end: todayEnd } = getTodayBoundsUTC(tz);
  const dayLengthMs = todayEnd.getTime() - todayStart.getTime();
  const elapsedMs = Math.max(0, Math.min(now - todayStart.getTime(), dayLengthMs));

  // Same weekday last week, not yesterday: a Tuesday compared to a Monday is a
  // comparison that reads as a crisis every Monday. See computePace().
  const { start: benchStart, end: benchEnd } = getDayBoundsUTC(
    new Date(now - 7 * 24 * 60 * 60 * 1000),
    tz
  );
  const benchCutoff = benchStart.getTime() + elapsedMs;

  const orderSel =
    "id, sale_number, total, created_at, status, payment_method, is_training, channel, snapshot, staff_id";

  const [
    todayRes,
    benchRes,
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
    // shows the failure instead of a convincing $0.00.
    supabase
      .from("orders")
      .select("total, is_training")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", todayStart.toISOString())
      .lt("created_at", todayEnd.toISOString()),

    supabase
      .from("orders")
      .select("total, created_at, is_training")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", benchStart.toISOString())
      .lt("created_at", benchEnd.toISOString()),

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
  const recentFailed = recentRes.error != null;
  const catalogFailed = catalogRes.error != null;
  const ticketsFailed = ticketsRes.error != null;
  const kitchenFailed = kitchenRes.error != null;
  const approvalsFailed = approvalsRes.error != null;
  const drawerFailed = drawerRes.error != null;
  const clockFailed = clockRes.error != null;
  const staffFailed = staffRes.error != null;

  const todayRows = must("today's sales", todayRes) as Row[];
  const benchRows = soft("dashboard → same weekday last week", benchRes, [] as Row[]);
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
  let todayGross = 0;
  let todayCount = 0;
  for (const o of todayRows) {
    if (o.is_training) continue;
    todayGross += num(o.total);
    todayCount += 1;
  }

  let benchSoFar = 0;
  let benchFull = 0;
  for (const o of benchRows) {
    if (o.is_training) continue;
    const t = num(o.total);
    benchFull += t;
    if (new Date(o.created_at).getTime() < benchCutoff) benchSoFar += t;
  }
  const pace = computePace(todayGross, benchSoFar, benchFull);

  const weekday = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "long",
  }).format(new Date(benchStart.getTime() + dayLengthMs / 2));
  const benchTimeLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(now));

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
            "Oldest fired " +
            formatDuration(oldest) +
            " ago, past your " +
            aging.kdsLateMin +
            "-minute mark. Someone is waiting on food.",
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
            "Oldest fired " +
            formatDuration(oldest) +
            " ago. Not late yet — worth a look before it is.",
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
            (worst.t.label ? worst.t.label + " has" : "The oldest has") +
            " been open " +
            formatDuration(worst.mins) +
            " with no check dropped. That's a table you can't turn.",
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
        detail:
          "Oldest has been pending " +
          formatDuration(waited) +
          ". The check it belongs to can't close until someone decides.",
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
            (eightySixed.length > 3 ? " and " + (eightySixed.length - 3) + " more" : "") +
            ". Still hidden from every register until you put them back.",
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
            " is down to " +
            num(low[0].stock_qty) +
            ". Order before they 86 themselves mid-service.",
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
        detail:
          "It has been open " +
          formatDuration(minutesSince(openDrawer.opened_at, now)) +
          ". Count it and file the Z-report so the day's cash reconciles.",
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
          "Someone has been on the clock over 16 hours. Payroll will be wrong until it's corrected.",
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
    serviceStats.push({ value: String(todayCount), label: "sales today", muted: todayCount === 0 });
  } else {
    serviceStats.push({ value: String(todayCount), label: "sales today", muted: todayCount === 0 });
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
    });
  }

  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="max-w-5xl space-y-4">
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

      {showReadiness && readiness && <ReadinessPanel report={readiness} />}

      <TodayModule
        pace={pace}
        saleCount={todayCount}
        currency={currency}
        weekday={weekday}
        benchmarkTimeLabel={benchTimeLabel}
        lastSaleLabel={lastSaleLabel}
        everSold={everSold}
        failed={benchFailed}
      />

      <AttentionRail signals={rankedSignals} degraded={degraded} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          failed={runsChecks ? ticketsFailed : hasKitchen ? kitchenFailed : false}
        />

        {hasCatalog && (
          <OpsBlock
            title="Menu & stock"
            icon={<Package />}
            stats={menuStats}
            state={menuState}
            tone={menuTone}
            // Read-only for everyone (staff have always been able to look at the
            // menu), but only the people who can change it get the way in.
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

      <ChecksTable
        rows={checkRows}
        failed={recentFailed}
        title={runsChecks ? "Open & recent checks" : "Recent sales"}
        href="/app/orders"
        hrefLabel="All orders"
      />
    </div>
  );
}
