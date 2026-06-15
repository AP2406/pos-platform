import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness, listBusinesses } from "@/lib/services/tenancy";
import { PushClient } from "./push-client";

export default async function MenuPushPage() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app/catalog");
  const supabase = await createClient();

  const all = await listBusinesses();
  const targets = all
    .filter((b) => (b.role === "owner" || b.role === "manager") && b.id !== business.id)
    .map((b) => ({ id: b.id, name: b.name }));

  const { data: itemRows } = await supabase
    .from("catalog_items")
    .select("id, name, price, category")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const { data: bizRow } = await supabase
    .from("businesses")
    .select("currency")
    .eq("id", business.id)
    .maybeSingle();

  const items = (itemRows ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    price: Number(i.price) || 0,
    category: (i.category as string | null) ?? null,
  }));
  const currency = ((bizRow?.currency as string) || "USD").toUpperCase();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Push menu to locations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Copy items from <span className="font-medium">{business.name}</span> to your other
            locations. Items are matched by name; existing items keep their own price unless you
            choose to overwrite.
          </p>
        </div>
        <Link
          href="/app/catalog"
          className="shrink-0 text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
        >
          Back to catalog
        </Link>
      </div>

      {targets.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-sm">
            You only manage this one location. Add another location to push menus between them.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-sm">No active items to push yet.</p>
        </div>
      ) : (
        <PushClient targets={targets} items={items} currency={currency} />
      )}
    </div>
  );
}
