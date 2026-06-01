import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { VoidButton } from "./void-button";

export default async function SalesPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("id, created_at, total, payment_method, status")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const orders = (data ?? []).map((o) => ({
    id: o.id as string,
    created_at: o.created_at as string,
    total: Number(o.total),
    payment_method: (o.payment_method as string | null) ?? "cash",
    status: (o.status as string | null) ?? "paid",
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Recent sales</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your last 50 sales. Void a sale to drop it from your totals.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">No sales yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {orders.map((o) => {
            const voided = o.status === "voided";
            const method =
              o.payment_method.charAt(0).toUpperCase() +
              o.payment_method.slice(1);
            return (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {"$" + o.total.toFixed(2)}
                    {voided && (
                      <span className="ml-2 text-xs text-red-600">Voided</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString() +
                      "  " +
                      "\u00b7" +
                      "  " +
                      method}
                  </div>
                </div>
                <div className="shrink-0">
                  {voided ? (
                    <span className="text-xs text-muted-foreground">
                      {"Ref: " + o.id.slice(0, 8)}
                    </span>
                  ) : (
                    <VoidButton orderId={o.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}