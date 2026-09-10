import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { requireModule } from "@/lib/modules/access";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PartnerControls } from "./partner-controls";
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

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();
  requireModule(business, "/app/partners");
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
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          All partners
        </Link>
        <PartnerControls partner={partner} />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {partner.name}
        </h1>
        {partner.contact_name && (
          <div className="text-sm text-foreground mt-1">
            Contact: {partner.contact_name}
          </div>
        )}
        <div className="text-sm text-muted-foreground mt-2 space-y-1">
          {partner.phone && <div>{partner.phone}</div>}
          {partner.email && <div>{partner.email}</div>}
        </div>
        {firstTrip && (
          <div className="text-xs text-muted-foreground mt-3">
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
        <div className="bg-card border border-border rounded-lg p-6 mb-4">
          <SectionHeader>Notes</SectionHeader>
          <p className="text-sm whitespace-pre-wrap">{partner.notes}</p>
        </div>
      )}

      <SectionHeader className="mt-6">Trip history</SectionHeader>
      {trips.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No trips farmed out to this partner yet.
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
                    <span className="font-medium">
                      {t.customer?.name ?? "One-off"}
                    </span>
                    <StatusBadge status={t.trip_status} />
                    {t.cookie_collected && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-green-50 text-green-700 font-medium">
                        ✓ Cookie collected
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
                  <div className="font-semibold text-purple-700 tabular-nums">
                    🍪 {formatCurrency(t.cookie_amount)}
                  </div>
                  <div className="text-xs text-muted-foreground/60 tabular-nums">
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
    <div className="bg-card border border-border rounded-lg p-5 transition-all duration-200 hover:border-foreground/15 hover:shadow-[0_2px_8px_rgb(0_0_0_/_0.04)]">
      <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
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