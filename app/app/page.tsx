import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import {
  getTodayBoundsUTC,
  getWeekBoundsUTC,
  getMonthBoundsUTC,
} from "@/lib/utils/dates";
import Link from "next/link";

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
    booked: "bg-slate-100 text-slate-700",
    confirmed: "bg-blue-50 text-blue-700",
    in_progress: "bg-amber-50 text-amber-700",
    completed: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
    no_show: "bg-red-50 text-red-700",
  };
  return map[status] ?? "bg-slate-100 text-slate-700";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TripData = any;

function businessRevenue(trip: TripData): number {
  if (trip.handled_by === "partner") {
    return parseFloat(trip.cookie_amount ?? "0");
  }
  return parseFloat(trip.price_total ?? "0");
}

export default async function DashboardPage() {
  const { business } = await requireBusiness();
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

  // TODAY
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

  // WEEK
  const weekTrips: TripData[] = weekTripsResult.data ?? [];
  const weekGross = weekTrips.reduce((sum, t) => sum + businessRevenue(t), 0);

  // MONTH
  const monthTrips: TripData[] = monthTripsResult.data ?? [];
  const monthGross = monthTrips.reduce((sum, t) => sum + businessRevenue(t), 0);
  const monthTripCount = monthTrips.length;
  const avgPerTrip = monthTripCount > 0 ? monthGross / monthTripCount : 0;

  // SELF vs PARTNER
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

  // TOP CUSTOMERS (by business revenue this month)
  const customerMap = new Map<
    string,
    { id: string; name: string; revenue: number; tripCount: number }
  >();
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

  // TOP PARTNERS (by cookies earned this month)
  const partnerMap = new Map<
    string,
    { id: string; name: string; cookies: number; tripCount: number }
  >();
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

  // NEEDS ATTENTION
  const needsAttention = (needsAttentionResult.data ?? [])
    .filter((t: TripData) => {
      if (t.handled_by === "self" && !t.payment_collected) return true;
      if (t.handled_by === "partner" && !t.cookie_collected) return true;
      return false;
    })
    .slice(0, 5);

  // CHART (this week by day)
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
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-slate-500 mt-1">
        {new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date())}
      </p>

      {/* Today metrics */}
      <h2 className="text-xs uppercase tracking-wider text-slate-500 mt-6 mb-3">
        Today
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Today's gross"
          value={formatCurrency(todayGross)}
          hint="What you actually earn"
        />
        <StatCard
          label="Trips today"
          value={todayTrips.length.toString()}
          hint={`${todayCompleted.length} of ${todayTrips.length} done`}
        />
        <StatCard
          label="Customers owe me"
          value={formatCurrency(customerOwed)}
          hint="From self-driven trips"
          tone={customerOwed > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Cookies owed"
          value={formatCurrency(cookiesOwed)}
          hint="Partners owe you"
          tone={cookiesOwed > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* Period metrics */}
      <h2 className="text-xs uppercase tracking-wider text-slate-500 mt-6 mb-3">
        Period
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          label="Avg per trip"
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
              : "No completed trips this month"
          }
        />
      </div>

      {/* Revenue chart */}
      <h2 className="text-xs uppercase tracking-wider text-slate-500 mt-8 mb-3">
        Revenue this week
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg p-5">
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
                    day.revenue > 0 ? "fill-slate-800" : "fill-slate-200"
                  }
                  rx="4"
                />
                {day.revenue > 0 && (
                  <text
                    x={x + 40}
                    y={barY - 6}
                    textAnchor="middle"
                    className="fill-slate-700 text-xs font-medium"
                  >
                    ${day.revenue.toFixed(0)}
                  </text>
                )}
                <text
                  x={x + 40}
                  y="185"
                  textAnchor="middle"
                  className="fill-slate-500 text-xs"
                >
                  {day.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <>
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mt-8 mb-3">
            Needs attention
          </h2>
          <div className="bg-amber-50/30 border border-amber-200 rounded-lg divide-y divide-amber-100">
            {needsAttention.map((t: TripData) => {
              const isPaymentPending =
                t.handled_by === "self" && !t.payment_collected;
              const isCookiePending =
                t.handled_by === "partner" && !t.cookie_collected;
              return (
                <Link
                  key={t.id}
                  href={`/app/trips/${t.id}`}
                  className="block p-4 hover:bg-white/60 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {t.customer?.name ?? "One-off"}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Completed · {formatDate(t.scheduled_at, tz)}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {isPaymentPending && (
                        <div className="text-amber-700 font-medium">
                          {formatCurrency(t.price_total)} unpaid
                        </div>
                      )}
                      {isCookiePending && (
                        <div className="text-purple-700 font-medium">
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

      {/* Top customers + partners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-3">
            Top customers this month
          </h2>
          {topCustomers.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-6 text-center text-sm text-slate-500">
              No completed trips this month yet.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
              {topCustomers.map((c) => (
                <div
                  key={c.id}
                  className="p-3 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      {c.tripCount} trip{c.tripCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="font-semibold">
                    {formatCurrency(c.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-3">
            Top partners this month
          </h2>
          {topPartners.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-6 text-center text-sm text-slate-500">
              No farmed-out trips this month yet.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
              {topPartners.map((p) => (
                <div
                  key={p.id}
                  className="p-3 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.tripCount} trip{p.tripCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="font-semibold text-purple-700">
                    🍪 {formatCurrency(p.cookies)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's schedule */}
      <h2 className="text-xs uppercase tracking-wider text-slate-500 mt-8 mb-3">
        Today&apos;s schedule
      </h2>
      {todayTrips.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">No trips scheduled today.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {todayTrips.map((t) => (
            <Link
              key={t.id}
              href={`/app/trips/${t.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 w-16 shrink-0">
                  {formatTime(t.scheduled_at, tz)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {t.customer?.name ?? "One-off"}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
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
                  <div className="font-medium">
                    {formatCurrency(businessRevenue(t))}
                  </div>
                  {t.handled_by === "partner" && (
                    <div className="text-xs text-slate-400">
                      of {formatCurrency(t.price_total)}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Coming up */}
      <h2 className="text-xs uppercase tracking-wider text-slate-500 mt-8 mb-3">
        Coming up
      </h2>
      {upcomingTrips.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">
            No upcoming trips after today.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {upcomingTrips.map((t) => (
            <Link
              key={t.id}
              href={`/app/trips/${t.id}`}
              className="block p-4 hover:bg-slate-50 transition"
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
                  <div className="text-sm text-slate-700 mt-1 truncate">
                    {t.pickup_address} → {t.dropoff_address}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatDate(t.scheduled_at, tz)} at{" "}
                    {formatTime(t.scheduled_at, tz)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">
                    {formatCurrency(businessRevenue(t))}
                  </div>
                  {t.handled_by === "partner" && (
                    <div className="text-xs text-slate-400 mt-0.5">
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
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`text-2xl font-semibold mt-2 ${
          tone === "warning" ? "text-amber-700" : ""
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}