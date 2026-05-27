import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PartnerControls } from "./partner-controls";

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

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireBusiness();
  const supabase = await createClient();

  const [partnerResult, tripsResult] = await Promise.all([
    supabase.from("partners").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("trips")
      .select("*, customer:customers(name)")
      .eq("partner_id", id)
      .eq("handled_by", "partner")
      .order("scheduled_at", { ascending: false }),
  ]);

  if (!partnerResult.data) notFound();
  const partner = partnerResult.data;
  const trips: TripData[] = tripsResult.data ?? [];

  const completedTrips = trips.filter((t) => t.trip_status === "completed");

  const cookiesEarned = completedTrips.reduce(
    (sum, t) => sum + parseFloat(t.cookie_amount ?? "0"),
    0
  );

  const cookiesOutstanding = trips
    .filter(
      (t) =>
        !t.cookie_collected &&
        t.trip_status !== "cancelled" &&
        t.trip_status !== "no_show" &&
        t.cookie_amount != null
    )
    .reduce((sum, t) => sum + parseFloat(t.cookie_amount), 0);

  const avgCookie =
    completedTrips.length > 0 ? cookiesEarned / completedTrips.length : 0;

  let defaultRate = "—";
  if (partner.default_cookie_percent != null) {
    defaultRate = `${partner.default_cookie_percent}%`;
  } else if (partner.default_cookie_flat != null) {
    defaultRate = `$${partner.default_cookie_flat}`;
  }

  const firstTrip = trips.length > 0 ? trips[trips.length - 1] : null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/app/partners"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← All partners
        </Link>
        <PartnerControls partner={partner} />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
        <h1 className="text-2xl font-semibold">{partner.name}</h1>
        {partner.contact_name && (
          <div className="text-sm text-slate-700 mt-1">
            Contact: {partner.contact_name}
          </div>
        )}
        <div className="text-sm text-slate-600 mt-2 space-y-1">
          {partner.phone && <div>{partner.phone}</div>}
          {partner.email && <div>{partner.email}</div>}
        </div>
        {firstTrip && (
          <div className="text-xs text-slate-500 mt-3">
            Partner since {formatDate(firstTrip.scheduled_at)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total trips"
          value={trips.length.toString()}
          hint={`${completedTrips.length} completed`}
        />
        <StatCard
          label="Cookies earned"
          value={formatCurrency(cookiesEarned)}
          hint="From completed trips"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(cookiesOutstanding)}
          hint="Uncollected cookies"
          tone={cookiesOutstanding > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Default rate"
          value={defaultRate}
          hint={
            avgCookie > 0
              ? `Avg: ${formatCurrency(avgCookie)}/trip`
              : "Auto-fills on new trips"
          }
        />
      </div>

      {partner.notes && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            Notes
          </h2>
          <p className="text-sm whitespace-pre-wrap">{partner.notes}</p>
        </div>
      )}

      <h2 className="text-xs uppercase tracking-wider text-slate-500 mt-6 mb-3">
        Trip history
      </h2>
      {trips.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center text-sm text-slate-500">
          No trips farmed out to this partner yet.
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
                    {t.cookie_collected && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">
                        ✓ Cookie collected
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
                  <div className="font-semibold text-purple-700">
                    🍪 {formatCurrency(t.cookie_amount)}
                  </div>
                  <div className="text-xs text-slate-400">
                    of {formatCurrency(t.price_total)}
                  </div>
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