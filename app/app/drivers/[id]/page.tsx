import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { requireModule } from "@/lib/modules/access";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DriverDialog } from "../driver-dialog";
import { StatusBadge, SectionHeader } from "../../_components/ui";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TripRow = any;

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();
  requireModule(business, "/app/drivers");
  const supabase = await createClient();

  const [driverResult, tripsResult] = await Promise.all([
    supabase.from("drivers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("trips")
      .select("*, customer:customers(name)")
      .eq("driver_id", id)
      .order("scheduled_at", { ascending: false }),
  ]);

  if (!driverResult.data) notFound();
  const driver = driverResult.data;
  const trips: TripRow[] = tripsResult.data ?? [];

  const now = new Date();
  const completed = trips.filter((t) => t.trip_status === "completed").length;
  const upcoming = trips.filter(
    (t) =>
      new Date(t.scheduled_at) >= now &&
      t.trip_status !== "completed" &&
      t.trip_status !== "lost" &&
      t.trip_status !== "cancelled"
  ).length;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/app/drivers"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          All drivers
        </Link>
        <DriverDialog mode="edit" driver={driver} redirectOnDelete="/app/drivers" />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold text-muted-foreground shrink-0">
            {(driver.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              {driver.name}
              {driver.status === "inactive" && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  Inactive
                </span>
              )}
            </h1>
            <div className="text-sm text-muted-foreground mt-1 space-x-3">
              {driver.phone && <span>{driver.phone}</span>}
              {driver.email && <span>{driver.email}</span>}
            </div>
            {driver.license_number && (
              <div className="text-xs text-muted-foreground mt-1">
                License: {driver.license_number}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard label="Total trips" value={trips.length.toString()} />
        <StatCard label="Completed" value={completed.toString()} />
        <StatCard label="Upcoming" value={upcoming.toString()} />
      </div>

      <div className="mb-6">
        <Link
          href={"/app/drivers/" + driver.id + "/schedule"}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-accent transition-colors"
        >
          Open driver&apos;s schedule →
        </Link>
      </div>

      {driver.notes && (
        <div className="bg-card border border-border rounded-lg p-6 mb-4">
          <SectionHeader>Notes</SectionHeader>
          <p className="text-sm whitespace-pre-wrap">{driver.notes}</p>
        </div>
      )}

      <SectionHeader className="mt-6">Trip history</SectionHeader>
      {trips.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No trips assigned to this driver yet.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {trips.map((t: TripRow) => (
            <Link
              key={t.id}
              href={"/app/trips/" + t.id}
              className="block p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {t.customer?.name ?? "One-off"}
                    </span>
                    <StatusBadge status={t.trip_status} />
                  </div>
                  <div className="text-sm text-foreground mt-1 truncate">
                    {t.pickup_address} → {t.dropoff_address}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDate(t.scheduled_at)}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-2 tabular-nums">{value}</div>
    </div>
  );
}