import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CustomerControls } from "./customer-controls";

function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount ?? "0");
  if (isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function statusColor(status: string) {
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

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireBusiness();
  const supabase = await createClient();

  const [customerResult, tripsResult] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("trips")
      .select("*")
      .eq("customer_id", id)
      .order("scheduled_at", { ascending: false }),
  ]);

  if (!customerResult.data) notFound();
  const customer = customerResult.data;
  const trips: TripData[] = tripsResult.data ?? [];

  const completedTrips = trips.filter((t) => t.trip_status === "completed");
  const lifetimeValue = completedTrips.reduce(
    (sum, t) => sum + businessRevenue(t),
    0
  );
  const avgPerTrip =
    completedTrips.length > 0 ? lifetimeValue / completedTrips.length : 0;

  const outstanding = trips
    .filter(
      (t) =>
        t.handled_by === "self" &&
        !t.payment_collected &&
        t.trip_status !== "cancelled" &&
        t.trip_status !== "no_show"
    )
    .reduce((sum, t) => sum + parseFloat(t.price_total), 0);

  const firstTrip = trips.length > 0 ? trips[trips.length - 1] : null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/app/customers"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← All customers
        </Link>
        <CustomerControls customer={customer} />
      </div>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
        <h1 className="text-2xl font-semibold">{customer.name}</h1>
        <div className="text-sm text-slate-600 mt-2 space-y-1">
          {customer.phone && <div>{customer.phone}</div>}
          {customer.email && <div>{customer.email}</div>}
        </div>
        {firstTrip && (
          <div className="text-xs text-slate-500 mt-3">
            Customer since {formatDate(firstTrip.scheduled_at)}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total trips"
          value={trips.length.toString()}
          hint={`${completedTrips.length} completed`}
        />
        <StatCard
          label="Lifetime value"
          value={formatCurrency(lifetimeValue)}
          hint="Your revenue"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          hint="Unpaid"
          tone={outstanding > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Avg per trip"
          value={formatCurrency(avgPerTrip)}
          hint="When completed"
        />
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            Notes
          </h2>
          <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}

      {/* Trip history */}
      <h2 className="text-xs uppercase tracking-wider text-slate-500 mt-6 mb-3">
        Trip history
      </h2>
      {trips.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center text-sm text-slate-500">
          No trips yet for this customer.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/app/trips/${t.id}`}
              className="block p-4 hover:bg-slate-50 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded capitalize ${statusColor(
                        t.trip_status
                      )}`}
                    >
                      {t.trip_status.replace("_", " ")}
                    </span>
                    {t.handled_by === "partner" && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                        Farmed out
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-700 mt-1 truncate">
                    {t.pickup_address} → {t.dropoff_address}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatDate(t.scheduled_at)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">
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