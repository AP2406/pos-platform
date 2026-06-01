import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { RegisterClient } from "./register-client";

export default async function PosPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data } = await supabase
    .from("catalog_items")
    .select("id, name, price, category")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const items = (data ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    price: Number(i.price),
    category: (i.category as string | null) ?? null,
  }));

  let taxRate = Number(business.default_tax_rate) || 0;
  if (taxRate > 1) taxRate = taxRate / 100;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Register</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tap items to build a sale, then charge.
        </p>
      </div>
      <RegisterClient items={items} taxRate={taxRate} />
    </div>
  );
}