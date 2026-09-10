import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import {
  getTodayBoundsUTC,
  getWeekBoundsUTC,
  getMonthBoundsUTC,
} from "@/lib/utils/dates";
import { getVocab } from "@/lib/modules/resolve";
import Link from "next/link";
import { MiniCalendar } from "./mini-calendar";
import { PosDashboard } from "./pos-dashboard";

function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount ?? "0");
  if (isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    booked: "bg-secondary text-secondary-foreground",
    confirmed: "bg-blue-50 text-blue-700",
    in_progress: "bg-amber-50 text-amber-700",
    completed: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
    no_show: "bg-red-50 text-red-700",
  };
  return map[status] ?? "bg-secondary text-secondary-foreground";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TripData = any;

function businessRevenue(trip: TripData): number {
  if (trip.handled_by === "partner") {
    return parseFloat(trip.cookie_amount ?? "0");
  }
  return parseFloat(trip.price_total ?? "0");
}

// /app is two different products sharing a URL, and the split is by VERTICAL,
// not by concern.
//
// Everything below this function is the original transportation dashboard —
// trips, partners, cookies owed — from before the platform grew a point of
// sale. Every other mode (restaurant, retail, service, mobile seller) gets
// PosDashboard, which lives in pos-dashboard.tsx and shares none of this file's
// data model. That is why the two files look like they were written by
// different people: they were, three years apart, for different businesses.
//
// The early return is load-bearing. A restaurant must never execute the trips
// queries below (there is no trips data and RLS would answer with nothing),
// and the transportation tenant must never see a KDS. Keeping them in one file
// under one `if` is not elegant, but merging them would mean teaching one
// dashboard two vocabularies — and the module registry already decided that
// verticals get separate screens.
export default async function DashboardPage({
  searchParams,
}: {
  // The POS dashboard's scope control lives in the URL, the same way the
  // reports page's range presets do.
  searchParams: Promise<{ day?: string }>;
}) {
  const { business, role } = await requireBusiness();

  if (business.industry !== "transportation") {
    const { day } = await searchParams;
    return <PosDashboard business={business} role={role} day={day} />;
  }

  const vocab = getVocab(business.industry);
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";

  const { start: todayStart, end: todayEnd } = getTodayBoundsUTC(tz);
  const { start: weekStart, end: weekEnd } = getWeekBoundsUTC(tz);
  const { start: monthStart, end: monthEnd } = getMonthBoundsUTC(tz);

  const [
    todayTripsResult,
    outstandingResult,
    cookiesResult,
    upcomingTripsResult,
    weekTripsResult,
    monthTripsResult,
    needsAttentionResult,
  ] = await Promise.all([
    supabase
      .from("trips")
      .select("*, customer:customers(name), partner:partners(name)")
      .gte("scheduled_at", todayStart.toISOString())
      .lt("scheduled_at", todayEnd.toISOString())
      .order("scheduled_at", { ascending: true }),

    supabase
      .from("trips")
      .select("price_total")
      .eq("handled_by", "self")
      .not("trip_status", "in", "(cancelled,no_show)")
      .eq("payment_collected", false),

    supabase
      .from("trips")
      .select("cookie_amount")
      .eq("handled_by", "partner")
      .not("trip_status", "in", "(cancelled,no_show)")
      .eq("cookie_collected", false)
      .not("cookie_amount", "is", null),

    supabase
      .from("trips")
      .select("*, customer:customers(name), partner:partners(name)")
      .gte("scheduled_at", todayEnd.toISOString())
      .not("trip_status", "in", "(cancelled,no_show)")
      .order("scheduled_at", { ascending: true })
      .limit(5),

    supabase
      .from("trips")
      .select("scheduled_at, price_total, cookie_amount, handled_by")
      .gte("scheduled_at", weekStart.toISOString())
      .lt("scheduled_at", weekEnd.toISOString())
      .eq("trip_status", "completed"),

    supabase
      .from("trips")
      .select(
        "price_total, cookie_amount, handled_by, customer:customers(id, name), partner:partners(id, name)"
      )
      .gte("scheduled_at", monthStart.toISOString())
      .lt("scheduled_at", monthEnd.toISOString())
      .eq("trip_status", "completed"),

    supabase
      .from("trips")
      .select("*, customer:customers(name), partner:partners(name)")
      .eq("trip_status", "completed")
      .order("scheduled_at", { ascending: false })
      .limit(50),
  ]);

  const todayTrips: TripData[] = todayTripsResult.data ?? [];
  const todayCompleted = todayTrips.filter(
    (t) => t.trip_status === "completed"
  );
  const todayGross = todayCompleted.reduce(
    (sum, t) => sum + businessRevenue(t),
    0
  );

  const customerOwed = (outstandingResult.data ?? []).reduce(
    (sum, t: TripData) => sum + parseFloat(t.price_total),
    0
  );

  const cookiesOwed = (cookiesResult.data ?? []).reduce(
    (sum, t: TripData) => sum + parseFloat(t.cookie_amount ?? "0"),
    0
  );

  const upcomingTrips: TripData[] = upcomingTripsResult.data ?? [];

  const weekTrips: TripData[] = weekTripsResult.data ?? [];
  const weekGross = weekTrips.reduce((sum, t) => sum + businessRevenue(t), 0);

  const monthTrips: TripData[] = monthTripsResult.data ?? [];
  const monthGross = monthTrips.reduce((sum, t) => sum + businessRevenue(t), 0);
  const monthTripCount = monthTrips.length;
  const avgPerTrip = monthTripCount > 0 ? monthGross / monthTripCount : 0;

  const monthSelfRevenue = monthTrips
    .filter((t) => t.handled_by === "self")
    .reduce((sum, t) => sum + parseFloat(t.price_total ?? "0"), 0);
  const monthPartnerRevenue = monthTrips
    .filter((t) => t.handled_by === "partner")
    .reduce((sum, t) => sum + parseFloat(t.cookie_amount ?? "0"), 0);
  const totalRevenue = monthSelfRevenue + monthPartnerRevenue;
  const selfPercent =
    totalRevenue > 0
      ? Math.round((monthSelfRevenue / totalRevenue) * 100)
      : 0;

  const customerMap = new Map<string, { id: string; name: string; revenue: number; tripCount: number }>();
  for (const t of monthTrips) {
    if (!t.customer?.id) continue;
    const key = t.customer.id;
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        id: t.customer.id,
        name: t.customer.name,
        revenue: 0,
        tripCount: 0,
      });
    }
    const entry = customerMap.get(key)!;
    entry.revenue += businessRevenue(t);
    entry.tripCount += 1;
  }
  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const partnerMap = new Map<string, { id: string; name: string; cookies: number; tripCount: number }>();
  for (const t of monthTrips) {
    if (t.handled_by !== "partner" || !t.partner?.id) continue;
    const key = t.partner.id;
    if (!partnerMap.has(key)) {
      partnerMap.set(key, {
        id: t.partner.id,
        name: t.partner.name,
        cookies: 0,
        tripCount: 0,
      });
    }
    const entry = partnerMap.get(key)!;
    entry.cookies += parseFloat(t.cookie_amount ?? "0");
    entry.tripCount += 1;
  }
  const topPartners = Array.from(partnerMap.values())
    .sort((a, b) => b.cookies - a.cookies)
    .slice(0, 5);

  const needsAttention = (needsAttentionResult.data ?? [])
    .filter((t: TripData) => {
      if (t.handled_by === "self" && !t.payment_collected) return true;
      if (t.handled_by === "partner" && !t.cookie_collected) return true;
      return false;
    })
    .slice(0, 5);

  const weekDays: { label: string; revenue: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStartMs = weekStart.getTime() + i * 24 * 60 * 60 * 1000;
    const dayEndMs = weekStart.getTime() + (i + 1) * 24 * 60 * 60 * 1000;
    const dayTrips = weekTrips.filter((t: TripData) => {
      const tripTime = new Date(t.scheduled_at).getTime();
      return tripTime >= dayStartMs && tripTime < dayEndMs;
    });
    const revenue = dayTrips.reduce((sum, t) => sum + businessRevenue(t), 0);
    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    }).format(new Date(dayStartMs));
    weekDays.push({ label, revenue });
  }
  const maxDayRevenue = Math.max(...weekDays.map((d) => d.revenue), 1);

  return (
    <div className="max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }).format(new Date())}
        </p>
      </div>

      <SectionHeader>Today</SectionHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Today's gross"
          value={formatCurrency(todayGross)}
          hint="What you actually earn"
        />
        <StatCard
            label={vocab.job_plural + " today"}
          value={todayTrips.length.toString()}
          hint={`${todayCompleted.length} of ${todayTrips.length} done`}
        />
        <StatCard
          label="Customers owe me"
          value={formatCurrency(customerOwed)}
          hint={"From self-driven " + vocab.job_plural.toLowerCase()}
          tone={customerOwed > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Cookies owed"
          value={formatCurrency(cookiesOwed)}
          hint="Partners owe you"
          tone={cookiesOwed > 0 ? "warning" : "neutral"}
        />
      </div>

      <SectionHeader>Period</SectionHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="This week"
          value={formatCurrency(weekGross)}
          hint={`Mon–Sun · ${weekTrips.length} trips`}
        />
        <StatCard
          label="This month"
          value={formatCurrency(monthGross)}
          hint={`${monthTripCount} completed`}
        />
        <StatCard
          label={"Avg per " + vocab.job_singular.toLowerCase()}
          value={formatCurrency(avgPerTrip)}
          hint="This month"
        />
        <StatCard
          label="Self vs partner"
          value={totalRevenue > 0 ? `${selfPercent}% self` : "—"}
          hint={
            totalRevenue > 0
              ? `${formatCurrency(monthSelfRevenue)} / ${formatCurrency(
                  monthPartnerRevenue
                )}`
                          : "No completed " + vocab.job_plural.toLowerCase() + " this month"
          }
        />
      </div>

      <SectionHeader>Calendar</SectionHeader>
      <MiniCalendar timezone={tz} />

      <SectionHeader>Revenue this week</SectionHeader>
      {weekGross > 0 ? (
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-5">
        <svg
          viewBox="0 0 700 200"
          className="w-full"
          style={{ maxHeight: "12rem" }}
        >
          {weekDays.map((day, i) => {
            const x = i * 100 + 10;
            const barHeight = Math.max((day.revenue / maxDayRevenue) * 130, 2);
            const barY = 160 - barHeight;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={barY}
                  width="80"
                  height={barHeight}
                  className={
                    day.revenue > 0
                      ? "fill-[oklch(0.62_0.215_254)]"
                      : "fill-muted"
                  }
                  rx="4"
                />
                {day.revenue > 0 && (
                  <text
                    x={x + 40}
                    y={barY - 6}
                    textAnchor="middle"
                    className="fill-foreground text-xs font-medium tabular-nums"
                  >
                    ${day.revenue.toFixed(0)}
                  </text>
                )}
                <text
                  x={x + 40}
                  y="185"
                  textAnchor="middle"
                  className="fill-muted-foreground text-xs"
                >
                  {day.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-card/40 px-6 py-10 text-center text-sm text-muted-foreground">
          No revenue logged this week yet.
        </div>
      )}

      {needsAttention.length > 0 && (
        <>
          <SectionHeader>Needs attention</SectionHeader>
          <div className="bg-amber-50/30 border border-amber-200 rounded-lg divide-y divide-amber-100 overflow-hidden">
            {needsAttention.map((t: TripData) => {
              const isPaymentPending =
                t.handled_by === "self" && !t.payment_collected;
              const isCookiePending =
                t.handled_by === "partner" && !t.cookie_collected;
              return (
                <Link
                  key={t.id}
                  href={`/app/trips/${t.id}`}
                  className="block p-4 hover:bg-white/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {t.customer?.name ?? "One-off"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Completed · {formatDate(t.scheduled_at, tz)}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {isPaymentPending && (
                        <div className="text-amber-700 font-medium tabular-nums">
                          {formatCurrency(t.price_total)} unpaid
                        </div>
                      )}
                      {isCookiePending && (
                        <div className="text-purple-700 font-medium tabular-nums">
                          🍪 {formatCurrency(t.cookie_amount)} pending
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
        <div>
          <SectionHeader noMargin>Top customers this month</SectionHeader>
          {topCustomers.length === 0 ? (
                  <EmptyState message={"No completed " + vocab.job_plural.toLowerCase() + " this month yet."} />
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
              {topCustomers.map((c) => (
                <div
                  key={c.id}
                  className="p-3 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.tripCount} {c.tripCount === 1 ? vocab.job_singular.toLowerCase() : vocab.job_plural.toLowerCase()}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">
                    {formatCurrency(c.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader noMargin>Top partners this month</SectionHeader>
          {topPartners.length === 0 ? (
            <EmptyState message={"No farmed-out " + vocab.job_plural.toLowerCase() + " this month yet."} />
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
              {topPartners.map((p) => (
                <div
                  key={p.id}
                  className="p-3 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.tripCount} {p.tripCount === 1 ? vocab.job_singular.toLowerCase() : vocab.job_plural.toLowerCase()}
                    </div>
                  </div>
                  <div className="font-semibold text-purple-700 tabular-nums">
                    🍪 {formatCurrency(p.cookies)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SectionHeader>Today&apos;s schedule</SectionHeader>
      {todayTrips.length === 0 ? (
        <EmptyState message={"No " + vocab.job_plural.toLowerCase() + " scheduled today."} />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {todayTrips.map((t) => (
            <Link
              key={t.id}
              href={`/app/trips/${t.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground w-16 shrink-0 tabular-nums">
                  {formatTime(t.scheduled_at, tz)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {t.customer?.name ?? "One-off"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.pickup_address} → {t.dropoff_address}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-xs px-2 py-0.5 rounded capitalize ${statusColor(
                    t.trip_status
                  )}`}
                >
                  {t.trip_status.replace("_", " ")}
                </span>
                <div className="text-right w-24">
                  <div className="font-medium tabular-nums">
                    {formatCurrency(businessRevenue(t))}
                  </div>
                  {t.handled_by === "partner" && (
                    <div className="text-xs text-muted-foreground tabular-nums">
                      of {formatCurrency(t.price_total)}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <SectionHeader>Coming up</SectionHeader>
      {upcomingTrips.length === 0 ? (
        <EmptyState message={"No upcoming " + vocab.job_plural.toLowerCase() + " after today."} />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {upcomingTrips.map((t) => (
            <Link
              key={t.id}
              href={`/app/trips/${t.id}`}
              className="block p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {t.customer?.name ?? "One-off"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded capitalize ${statusColor(
                        t.trip_status
                      )}`}
                    >
                      {t.trip_status.replace("_", " ")}
                    </span>
                    {t.handled_by === "partner" && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                        → {t.partner?.name ?? "Partner"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-foreground mt-1 truncate">
                    {t.pickup_address} → {t.dropoff_address}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDate(t.scheduled_at, tz)} at{" "}
                    {formatTime(t.scheduled_at, tz)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold tabular-nums">
                    {formatCurrency(businessRevenue(t))}
                  </div>
                  {t.handled_by === "partner" && (
                    <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                      of {formatCurrency(t.price_total)}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  children,
  noMargin,
}: {
  children: React.ReactNode;
  noMargin?: boolean;
}) {
  return (
    <h2
      className={`text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-3 ${
        noMargin ? "" : "mt-8"
      }`}
    >
      {children}
    </h2>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warning" | "neutral";
}) {
  return (
    <div className="group bg-card border border-border rounded-lg p-5 transition-all duration-200 hover:border-foreground/15 hover:shadow-[0_2px_8px_rgb(0_0_0_/_0.04)]">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={`text-2xl font-semibold mt-2 tabular-nums tracking-tight ${
          tone === "warning" ? "text-amber-600" : "text-foreground"
        }`}
      >
        {value}
      </div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      )}
    </div>
  );
}