import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { requireModule } from "@/lib/modules/access";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

function formatWhen(iso: string) {
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

export default async function DriverSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();
  requireModule(business, "/app/drivers");
  const supabase = await createClient();

  const driverResult = await supabase
    .from("drivers")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!driverResult.data) notFound();
  const driver = driverResult.data;

  const nowIso = new Date().toISOString();
  const { data: trips } = await supabase
    .from("trips")
    .select("*, customer:customers(name)")
    .eq("driver_id", id)
    .gte("scheduled_at", nowIso)
    .not("trip_status", "in", "(completed,cancelled,lost)")
    .order("scheduled_at", { ascending: true });

  const list: TripRow[] = trips ?? [];

  return (
    <div className="max-w-md mx-auto">
      <Link
        href={"/app/drivers/" + driver.id}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-xl font-semibold tracking-tight">{driver.name}</h1>
      <p className="text-sm text-muted-foreground mb-5">Upcoming trips</p>

      {list.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No upcoming trips assigned.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((t: TripRow) => (
            <div key={t.id} className="bg-card border border-border rounded-xl p-4">
              <div className="text-sm font-semibold">
                {formatWhen(t.scheduled_at)}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Pickup
                  </div>
                  <div className="font-medium">{t.pickup_address}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Dropoff
                  </div>
                  <div className="font-medium">{t.dropoff_address}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {t.customer?.name && <span>{t.customer.name}</span>}
                {t.passenger_count != null && <span>{t.passenger_count} pax</span>}
                {t.flight_number && <span>Flight {t.flight_number}</span>}
                {t.terminal && <span>Terminal {t.terminal}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}