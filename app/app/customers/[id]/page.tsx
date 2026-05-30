import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CustomerControls } from "./customer-controls";
import { CustomerNotes } from "./customer-notes";
import { CustomerTags } from "./customer-tags";
import { StatusBadge, SectionHeader } from "../../_components/ui";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TripData = any;

type TagRow = {
  id: string;
  name: string;
  color: string;
};

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
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const [customerResult, tripsResult, attachedTagsResult, allTagsResult] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("trips")
        .select("*")
        .eq("customer_id", id)
        .order("scheduled_at", { ascending: false }),
      supabase
        .from("customer_tags")
        .select("tag:tags(id, name, color)")
        .eq("customer_id", id),
      supabase
        .from("tags")
        .select("id, name, color")
        .eq("business_id", business.id)
        .order("name"),
    ]);

  if (!customerResult.data) notFound();
  const customer = customerResult.data;
  const trips: TripData[] = tripsResult.data ?? [];

  // Flatten attached tags
  const attachedTags: TagRow[] = (attachedTagsResult.data ?? [])
    .map((row) => {
      const t = row.tag as unknown as TagRow | TagRow[] | null;
      if (!t) return null;
      return Array.isArray(t) ? t[0] : t;
    })
    .filter((t): t is TagRow => t != null);

  const allTags: TagRow[] = (allTagsResult.data ?? []) as TagRow[];

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
  const lastCompletedTrip = completedTrips[0] ?? null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/app/customers"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          All customers
        </Link>
        <CustomerControls customer={customer} />
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {customer.name}
        </h1>
        <div className="text-sm text-muted-foreground mt-2 space-y-1">
          {customer.phone && <div>{customer.phone}</div>}
          {customer.email && <div>{customer.email}</div>}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground mt-3">
          {firstTrip && (
            <div>Customer since {formatDate(firstTrip.scheduled_at)}</div>
          )}
          {lastCompletedTrip && (
            <div>Last seen {formatDate(lastCompletedTrip.scheduled_at)}</div>
          )}
        </div>

        {/* Tags */}
        <div className="mt-5 pt-5 border-t border-border">
          <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-2">
            Tags
          </div>
          <CustomerTags
            customerId={customer.id}
            attachedTags={attachedTags}
            allTags={allTags}
          />
        </div>
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

      {/* Notes (always editable) */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <SectionHeader>Notes</SectionHeader>
        <CustomerNotes
          customerId={customer.id}
          initialNotes={customer.notes ?? null}
        />
      </div>

      {/* Trip history */}
      <SectionHeader className="mt-6">Trip history</SectionHeader>
      {trips.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No trips yet for this customer.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/app/trips/${t.id}`}
              className="block p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={t.trip_status} />
                    {t.handled_by === "partner" && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium">
                        Farmed out
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-foreground mt-1 truncate">
                    {t.pickup_address} → {t.dropoff_address}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDate(t.scheduled_at)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold tabular-nums">
                    {formatCurrency(businessRevenue(t))}
                  </div>
                  {t.handled_by === "partner" && (
                    <div className="text-xs text-muted-foreground/60 tabular-nums">
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
    <div className="bg-card border border-border rounded-lg p-5 transition-all duration-200 hover:border-foreground/15 hover:shadow-[0_2px_8px_rgb(0_0_0_/_0.04)]">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={`text-2xl font-semibold mt-2 tabular-nums ${
          tone === "warning" ? "text-amber-700" : ""
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}