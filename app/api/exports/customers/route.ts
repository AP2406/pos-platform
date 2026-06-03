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

export async function GET() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return new Response("Not authorized", { status: 403 });
  }
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("name, phone, created_at")
    .eq("business_id", business.id)
    .order("name", { ascending: true })
    .limit(10000);

  const header = ["Name", "Phone", "Added"];
  const lines = [csvRow(header)];

  for (const c of customers ?? []) {
    lines.push(csvRow([c.name || "", c.phone || "", c.created_at || ""]));
  }

  const csv = lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="surge-customers-' + stamp + '.csv"',
      "Cache-Control": "no-store",
    },
  });
}