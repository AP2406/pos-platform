import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { OrdersClient, type OrderRow } from "./orders-client";
import { must, soft } from "@/lib/supabase/query";

export const dynamic = "force-dynamic";

// Front-of-house Orders hub: every recent order segmented by fulfillment channel
// (dine-in / takeout / pickup / delivery / online …) with an Active vs Completed
// view and mark-ready / recall actions. Distinct from Tickets (/app/pos/sales),
// which is the settled-payment history, and from the KDS, which is the cook view.
export default async function OrdersHubPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  // BUG: this selected `dining_option` as a column. There is no such column —
  // it lives inside the order snapshot (see the same note in
  // lib/services/order-fulfill.ts). PostgREST rejected the whole select, the
  // error was discarded by `const { data }`, and this page silently rendered
  // ZERO orders while the table held hundreds.
  const ordersRes = await supabase
    .from("orders")
    .select("id, sale_number, total, created_at, channel, snapshot, fulfilled_at, customer_id, status")
    .eq("business_id", business.id)
    .neq("is_training", true)
    .neq("status", "voided")
    .order("created_at", { ascending: false })
    .limit(200);

  // The page IS this query — an empty hub must mean "no orders", never "the
  // query broke". must() throws so the error boundary shows it.
  const rows = must("the orders hub", ordersRes) as Record<string, unknown>[];
  const custIds = Array.from(new Set(rows.map((o) => o.customer_id as string | null).filter((x): x is string => !!x)));
  const nameById: Record<string, string> = {};
  if (custIds.length > 0) {
    // Enrichment: losing names should cost the names, not the page.
    const custs = soft<{ id: string; name: string }[]>(
      "orders hub → customer names",
      await supabase.from("customers").select("id, name").eq("business_id", business.id).in("id", custIds),
      []
    );
    for (const c of custs) nameById[c.id] = c.name;
  }

  const orders: OrderRow[] = rows.map((o) => ({
    id: o.id as string,
    saleNumber: o.sale_number != null ? Number(o.sale_number) : null,
    total: Number(o.total) || 0,
    createdAt: o.created_at as string,
    channel: (o.channel as string | null) ?? null,
    diningOption:
      ((o.snapshot ?? null) as { dining_option?: string | null } | null)?.dining_option ?? null,
    fulfilledAt: (o.fulfilled_at as string | null) ?? null,
    status: (o.status as string | null) ?? "paid",
    customerName: o.customer_id ? nameById[o.customer_id as string] ?? null : null,
  }));

  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Every order by channel — mark them ready as they go out.</p>
        </div>
        <Link href="/app/pos/sales" className="text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent shrink-0">Transaction history →</Link>
      </div>
      <OrdersClient initialOrders={orders} timezone={(business as { timezone?: string }).timezone || "America/Toronto"} />
    </div>
  );
}
