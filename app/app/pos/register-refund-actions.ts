"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";

export type RefundableSale = {
  id: string;
  sale_number: number | null;
  total: number;
  status: string;
  created_at: string;
};

// Read-only. Lists recent paid / partially-refunded sales so a cashier can
// find one to refund from the register. Refund authorization itself is still
// enforced inside refundItems (app role + manager-PIN approval).
export async function listRefundableSales(
  query?: string
): Promise<{ ok: true; sales: RefundableSale[] } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can refund a sale." };
  }
  const supabase = await createClient();

  let builder = supabase
    .from("orders")
    .select("id, sale_number, total, status, created_at")
    .eq("business_id", business.id)
    .neq("is_training", true)
    .in("status", ["paid", "partially_refunded"]);

  const term = (query || "").trim();
  if (term && /^[0-9]+$/.test(term)) {
    builder = builder.eq("sale_number", Number(term));
  }

  const { data } = await builder
    .order("created_at", { ascending: false })
    .limit(20);

  const sales = (data ?? []).map((o) => ({
    id: o.id as string,
    sale_number: o.sale_number != null ? Number(o.sale_number) : null,
    total: Number(o.total) || 0,
    status: (o.status as string) || "paid",
    created_at: o.created_at as string,
  }));

  return { ok: true, sales: sales };
}