import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { BookTripSheet } from "./book-trip-sheet";
import { TripRowActions } from "./trip-row-actions";
import { LeadFromEmailSheet } from "./lead-from-email-sheet";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
type TripRow = any;

export default async function TripsPage() {
  await requireBusiness();
  const supabase = await createClient();

  const { data: trips } = await supabase
    .from("trips")
    .select(
      `*, customer:customers(name), vehicle:vehicles(name), partner:partners(name)`
    )
    .order("scheduled_at", { ascending: false });

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: partners } = await supabase
    .from("partners")
    .select("id, name, default_cookie_percent, default_cookie_flat")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Trips</h1>
          <p className="text-slate-500 text-sm mt-1">
            Every trip you&apos;ve booked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LeadFromEmailSheet />
          <BookTripSheet
            customers={customers ?? []}
            vehicles={vehicles ?? []}
            partners={partners ?? []}
          />
        </div>
      </div>

      {!trips || trips.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center">
          <h2 className="font-medium text-slate-900">No trips yet</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Book your first trip to start tracking the work.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {trips.map((t: TripRow) => (
            <div
              key={t.id}
              className="flex items-stretch hover:bg-slate-50 transition"
            >
              <Link
                href={`/app/trips/${t.id}`}
                className="flex-1 p-4 min-w-0"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {t.customer?.name ?? "One-off"}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${statusColor(
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
                  {formatDateTime(t.scheduled_at)}
                  {t.vehicle?.name && ` · ${t.vehicle.name}`}
                </div>
              </Link>
              <TripRowActions trip={t} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}