import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { listUpsellPrompts } from "./actions";
import { UpsellsClient } from "./upsells-client";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

export default async function UpsellsPage() {
  const { business, role } = await requireBusiness();
  requirePermission(role, "edit_menu");
  if (!hasFloorService(business)) redirect("/app/reports");

  const supabase = await createClient();
  const [prompts, { data: itemRows }] = await Promise.all([
    listUpsellPrompts(false),
    supabase.from("catalog_items").select("id, name, category").eq("business_id", business.id).eq("is_active", true).order("name"),
  ]);
  const items = (itemRows ?? []).map((i) => ({ id: i.id as string, name: (i.name as string) || "Item" }));
  const categories = Array.from(new Set((itemRows ?? []).map((i) => (i.category as string | null) || "").filter((c) => c))).sort();

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Upsell &amp; combo prompts</h1>
        <p className="text-muted-foreground text-sm mt-1">Suggestive selling at ring-in — when an item or category is added, prompt the server to add a pairing, optionally at a combo discount.</p>
      </div>
      <UpsellsClient prompts={prompts} items={items} categories={categories} />
    </div>
  );
}
