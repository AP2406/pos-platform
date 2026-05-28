import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { BookTripSheet } from "./book-trip-sheet";
import { TripRowActions } from "./trip-row-actions";
import { LeadFromEmailSheet } from "./lead-from-email-sheet";
import { PageHeader, EmptyState, StatusBadge } from "../_components/ui";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
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
      <PageHeader
        title="Trips"
        subtitle="Every trip you've booked."
        action={
          <>
            <LeadFromEmailSheet />
            <BookTripSheet
              customers={customers ?? []}
              vehicles={vehicles ?? []}
              partners={partners ?? []}
            />
          </>
        }
      />

      {!trips || trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          message="Book your first trip to start tracking the work."
        />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {trips.map((t: TripRow) => (
            <div
              key={t.id}
              className="flex items-stretch hover:bg-accent transition-colors"
            >
              <Link href={`/app/trips/${t.id}`} className="flex-1 p-4 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {t.customer?.name ?? "One-off"}
                  </span>
                  <StatusBadge status={t.trip_status} />
                  {t.handled_by === "partner" && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium">
                      → {t.partner?.name ?? "Partner"}
                    </span>
                  )}
                </div>
                <div className="text-sm text-foreground mt-1 truncate">
                  {t.pickup_address} → {t.dropoff_address}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
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