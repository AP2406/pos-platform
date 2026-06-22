import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { listPriceWindows } from "./actions";
import { PricingClient } from "./pricing-client";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const supabase = await createClient();
  const [windows, { data: itemRows }] = await Promise.all([
    listPriceWindows(false),
    supabase.from("catalog_items").select("id, name, category").eq("business_id", business.id).eq("is_active", true).order("name"),
  ]);
  const items = (itemRows ?? []).map((i) => ({ id: i.id as string, name: (i.name as string) || "Item" }));
  const categories = Array.from(new Set((itemRows ?? []).map((i) => (i.category as string | null) || "").filter((c) => c))).sort();
  const currency = (business.currency || "USD").toUpperCase();

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Happy hour &amp; timed pricing</h1>
        <p className="text-muted-foreground text-sm mt-1">Set price windows per item or category. Prices switch automatically during the window and revert after — no manual discounting.</p>
      </div>
      <PricingClient windows={windows} items={items} categories={categories} currency={currency} />
    </div>
  );
}
