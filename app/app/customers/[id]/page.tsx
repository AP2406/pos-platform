import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CustomerControls } from "./customer-controls";
import { CustomerNotes } from "./customer-notes";
import { CustomerTags } from "./customer-tags";
import { StoreCreditCard } from "./store-credit-card";
import { HouseAccountCard } from "./house-account-card";
import { MarketingConsent } from "./marketing-consent";
import { MergeCustomer } from "./merge-customer";
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
  const { business, role } = await requireBusiness();
  const supabase = await createClient();

  const { data: scAcct } = await supabase
    .from("store_credit_accounts")
    .select("balance_cents")
    .eq("business_id", business.id)
    .eq("customer_id", id)
    .maybeSingle();
  const storeCreditBalance = scAcct ? (scAcct.balance_cents as number) / 100 : 0;

  const { data: haAcct } = await supabase
    .from("house_accounts")
    .select("enabled, balance_cents, limit_cents")
    .eq("business_id", business.id)
    .eq("customer_id", id)
    .maybeSingle();
  const houseAccount = {
    enabled: haAcct?.enabled === true,
    balance: haAcct ? (Number(haAcct.balance_cents) || 0) / 100 : 0,
    limit: haAcct?.limit_cents == null ? null : (Number(haAcct.limit_cents) || 0) / 100,
  };

  // P2-35: POS purchase history + spend (orders-based, for non-transportation
  // businesses). Net of refunds; also surfaces the loyalty balance on the
  // profile, feeding loyalty/marketing.
  const isTransport = business.industry === "transportation";
  let purchase = {
    visits: 0,
    spend: 0,
    avg: 0,
    lastVisit: null as string | null,
    loyaltyPoints: 0,
    recent: [] as { id: string; total: number; created_at: string; status: string }[],
  };
  if (!isTransport) {
    const [ordersRes, loyaltyRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, total, created_at, status")
        .eq("business_id", business.id)
        .eq("customer_id", id)
        .neq("status", "voided")
        .order("created_at", { ascending: false }),
      supabase
        .from("loyalty_accounts")
        .select("points")
        .eq("business_id", business.id)
        .eq("customer_id", id)
        .maybeSingle(),
    ]);
    const orders = ordersRes.data ?? [];
    const orderIds = orders.map((o) => o.id as string);
    let refundTotal = 0;
    if (orderIds.length > 0) {
      const { data: refs } = await supabase
        .from("refunds")
        .select("amount")
        .eq("business_id", business.id)
        .in("order_id", orderIds);
      for (const r of refs ?? []) refundTotal += Number(r.amount) || 0;
    }
    const gross = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const visits = orders.length;
    const spend = Math.round((gross - refundTotal) * 100) / 100;
    purchase = {
      visits,
      spend,
      avg: visits > 0 ? Math.round((spend / visits) * 100) / 100 : 0,
      lastVisit: (orders[0]?.created_at as string | undefined) ?? null,
      loyaltyPoints: loyaltyRes.data ? (loyaltyRes.data.points as number) : 0,
      recent: orders.slice(0, 10).map((o) => ({
        id: o.id as string,
        total: Number(o.total) || 0,
        created_at: o.created_at as string,
        status: (o.status as string | null) ?? "paid",
      })),
    };
  }

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
          <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mb-2">
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
      {isTransport ? (
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
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Visits" value={purchase.visits.toString()} hint="Paid sales" />
          <StatCard label="Lifetime spend" value={formatCurrency(purchase.spend)} hint="Net of refunds" />
          <StatCard label="Avg ticket" value={formatCurrency(purchase.avg)} hint="Per visit" />
          <StatCard
            label="Last visit"
            value={purchase.lastVisit ? new Date(purchase.lastVisit).toLocaleDateString() : "—"}
            hint={purchase.loyaltyPoints > 0 ? purchase.loyaltyPoints.toLocaleString() + " loyalty pts" : "No points yet"}
          />
        </div>
      )}

      {/* Store credit */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <SectionHeader>Store credit</SectionHeader>
        <StoreCreditCard
          customerId={customer.id}
          initialBalance={storeCreditBalance}
          canIssue={role === "owner" || role === "manager"}
        />
      </div>

      {/* House account (accounts receivable) */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <SectionHeader>House account</SectionHeader>
        <HouseAccountCard
          customerId={customer.id}
          initialEnabled={houseAccount.enabled}
          initialBalance={houseAccount.balance}
          initialLimit={houseAccount.limit}
          canManage={role === "owner" || role === "manager"}
        />
      </div>

      {/* Marketing consent (CASL) */}
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <SectionHeader>Marketing</SectionHeader>
        <MarketingConsent
          customerId={customer.id}
          initialConsent={(customer as { marketing_consent?: boolean }).marketing_consent === true}
          hasEmail={!!(customer.email as string | null)}
          canEdit={role === "owner" || role === "manager"}
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

      {(role === "owner" || role === "manager") && (
        <div className="mb-4">
          <MergeCustomer keepId={customer.id} keepName={customer.name} />
        </div>
      )}

      {/* Purchase history (POS businesses) */}
      {!isTransport && (
        <>
          <SectionHeader className="mt-6">Recent purchases</SectionHeader>
          {purchase.recent.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              No purchases yet for this customer.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
              {purchase.recent.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="text-sm text-foreground">{new Date(o.created_at).toLocaleString()}</div>
                    {o.status !== "paid" && (
                      <div className="text-xs text-amber-600 capitalize">{o.status.replace("_", " ")}</div>
                    )}
                  </div>
                  <div className="font-semibold tabular-nums shrink-0">{formatCurrency(o.total)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Trip history (transportation) */}
      {isTransport && (
        <>
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
        </>
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