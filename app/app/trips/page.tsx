import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { requireModule } from "@/lib/modules/access";
import { getVocab } from "@/lib/modules/resolve";
import { BookTripSheet } from "./book-trip-sheet";
import { TripRowActions } from "./trip-row-actions";
import { LeadFromEmailSheet } from "./lead-from-email-sheet";
import { TripsFilter } from "./trips-filter";
import { PageHeader, EmptyState, StatusBadge } from "../_components/ui";
import { TripsTabs } from "./trips-tabs";

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

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ handled?: string; view?: string }>;
}) {
  const { business } = await requireBusiness();
  requireModule(business, "/app/trips");
  const vocab = getVocab(business.industry);
  const { handled, view } = await searchParams;
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

  const allTrips: TripRow[] = trips ?? [];
  const isLeadsView = view === "leads";
  const leadCount = allTrips.filter((t: TripRow) => t.is_lead === true).length;
  const tripCount = allTrips.length - leadCount;

  const tabTrips = allTrips.filter((t: TripRow) =>
    isLeadsView ? t.is_lead === true : t.is_lead !== true
  );
  const filteredTrips =
    handled === "self" || handled === "partner"
      ? tabTrips.filter((t: TripRow) => t.handled_by === handled)
      : tabTrips;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={vocab.job_plural}
        subtitle={"Every " + vocab.job_singular.toLowerCase() + " you've booked."}
        action={
          <>
            <LeadFromEmailSheet />
            <BookTripSheet
              customers={customers ?? []}
              vehicles={vehicles ?? []}
              partners={partners ?? []}
              jobSingular={vocab.job_singular}
            />
          </>
        }
      />

      {allTrips.length > 0 && (
        <TripsTabs tripCount={tripCount} leadCount={leadCount} />
      )}
      {allTrips.length > 0 && <TripsFilter />}

      {allTrips.length === 0 ? (
        <EmptyState
          title={"No " + vocab.job_plural.toLowerCase() + " yet"}
          message={"Book your first " + vocab.job_singular.toLowerCase() + " to start tracking the work."}
        />
      ) : filteredTrips.length === 0 ? (
        <EmptyState
          title={"No " + vocab.job_plural.toLowerCase() + " match this filter"}
          message="Try selecting a different filter above."
        />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {filteredTrips.map((t: TripRow) => (
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