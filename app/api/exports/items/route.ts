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

  const { data: items } = await supabase
    .from("catalog_items")
    .select("name, category, price, taxable, track_inventory, stock_qty, is_active")
    .eq("business_id", business.id)
    .order("name", { ascending: true })
    .limit(10000);

  const header = [
    "Name",
    "Category",
    "Price",
    "Taxable",
    "Tracks inventory",
    "Stock on hand",
    "Active",
  ];
  const lines = [csvRow(header)];

  for (const it of items ?? []) {
    lines.push(
      csvRow([
        it.name || "",
        it.category || "",
        money(it.price),
        it.taxable ? "yes" : "no",
        it.track_inventory ? "yes" : "no",
        it.stock_qty != null ? it.stock_qty : "",
        it.is_active ? "yes" : "no",
      ])
    );
  }

  const csv = lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="surge-items-' + stamp + '.csv"',
      "Cache-Control": "no-store",
    },
  });
}