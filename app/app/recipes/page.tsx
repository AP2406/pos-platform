import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { RecipesClient } from "./recipes-client";

export default async function RecipesPage() {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();

  const [{ data: ingRows }, { data: dishRows }, { data: lineRows }, { data: bizRow }] =
    await Promise.all([
      supabase
        .from("ingredients")
        .select("id, name, unit, cost, is_active")
        .eq("business_id", business.id)
        .order("name", { ascending: true }),
      supabase
        .from("catalog_items")
        .select("id, name, price, category, is_active")
        .eq("business_id", business.id)
        .order("name", { ascending: true }),
      supabase
        .from("recipe_ingredients")
        .select("catalog_item_id, ingredient_id, quantity")
        .eq("business_id", business.id),
      supabase
        .from("businesses")
        .select("currency")
        .eq("id", business.id)
        .maybeSingle(),
    ]);

  const ingredients = (ingRows ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    unit: (i.unit as string) || "unit",
    cost: Number(i.cost) || 0,
    is_active: i.is_active as boolean,
  }));

  const dishes = (dishRows ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    price: Number(d.price) || 0,
    category: (d.category as string | null) ?? null,
    is_active: d.is_active as boolean,
  }));

  const recipes: Record<string, { ingredient_id: string; quantity: number }[]> = {};
  for (const l of lineRows ?? []) {
    const dishId = l.catalog_item_id as string;
    (recipes[dishId] ||= []).push({
      ingredient_id: l.ingredient_id as string,
      quantity: Number(l.quantity) || 0,
    });
  }

  const currency = ((bizRow?.currency as string) || "USD").toUpperCase();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Recipes &amp; costing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define ingredients with a unit cost, build each dish&apos;s recipe, and see
          the per-plate cost and margin on every menu item.
        </p>
      </div>
      <RecipesClient
        initialIngredients={ingredients}
        dishes={dishes}
        initialRecipes={recipes}
        currency={currency}
        canManage={role === "owner" || role === "manager"}
      />
    </div>
  );
}
