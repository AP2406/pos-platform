import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";

export const dynamic = "force-dynamic";

function csvField(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(arr: unknown[]): string {
  return arr.map(csvField).join(",");
}
function money(n: unknown): string {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

export async function GET() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return new Response("Not authorized", { status: 403 });
  }
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, sale_number, created_at, status, payment_method, subtotal, discount, tax, tip, total, customer:customers(name)"
    )
    .eq("business_id", business.id)
    .neq("is_training", true)
    .order("created_at", { ascending: false })
    .limit(10000);

  const list = orders ?? [];
  const ids = list.map((o) => o.id as string);

  const refundByOrder: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: refs } = await supabase
      .from("refunds")
      .select("order_id, amount")
      .eq("business_id", business.id)
      .in("order_id", ids);
    for (const r of refs ?? []) {
      const oid = r.order_id as string;
      refundByOrder[oid] = (refundByOrder[oid] || 0) + (Number(r.amount) || 0);
    }
  }

  const header = [
    "Sale #",
    "Date",
    "Status",
    "Payment method",
    "Subtotal",
    "Discount",
    "Tax",
    "Tip",
    "Total",
    "Refunded",
    "Customer",
  ];
  const lines = [csvRow(header)];

  for (const o of list) {
    const rawCustomer = (o as { customer?: unknown }).customer;
    let customerName = "";
    if (rawCustomer) {
      const c = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;
      customerName = (c && (c as { name?: string }).name) || "";
    }
    lines.push(
      csvRow([
        o.sale_number != null ? o.sale_number : "",
        o.created_at,
        o.status || "",
        o.payment_method || "",
        money(o.subtotal),
        money(o.discount),
        money(o.tax),
        money(o.tip),
        money(o.total),
        money(refundByOrder[o.id as string] || 0),
        customerName,
      ])
    );
  }

  const csv = lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="surge-sales-' + stamp + '.csv"',
      "Cache-Control": "no-store",
    },
  });
}