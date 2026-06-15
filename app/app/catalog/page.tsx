import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { CatalogClient } from "./catalog-client";
import { ImportMenu } from "./import-menu";
import { MenuBoardLink } from "./menu-board-link";
import { CoursesCard } from "./courses-card";
import { hasFloorService } from "@/lib/modules/modes";
import { listCourses } from "../pos/courses-actions";
import { listKitchenStations } from "../kitchen/stations-actions";

export default async function CatalogPage() {
  const { business, role } = await requireBusiness();
  const canManage = role === "owner" || role === "manager";
  const supabase = await createClient();

  const { data: itemsData } = await supabase
    .from("catalog_items")
    .select("id, name, price, category, is_active, taxable, tax_rate_id, barcode, image_url, out_of_stock, default_course_id, station_id")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });

  const { data: bizRow } = await supabase
    .from("businesses")
    .select("category_colors")
    .eq("id", business.id)
    .maybeSingle();
  const categoryColors =
    (bizRow?.category_colors as Record<string, string> | null) ?? {};

  const { data: varsData } = await supabase
    .from("catalog_item_variations")
    .select("id, catalog_item_id, name, price")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const { data: modsData } = await supabase
    .from("catalog_item_modifiers")
    .select("id, catalog_item_id, name, price, group_id, sort_order, child_group_id")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: modGroupsData } = await supabase
    .from("catalog_modifier_groups")
    .select("id, catalog_item_id, name, required, min_select, max_select, sort_order")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true });

  const { data: ratesData } = await supabase
    .from("tax_rates")
    .select("id, name, rate")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const varsByItem: Record<string, { id: string; name: string; price: number }[]> = {};
  for (const v of varsData ?? []) {
    const itemId = v.catalog_item_id as string;
    if (!varsByItem[itemId]) varsByItem[itemId] = [];
    varsByItem[itemId].push({
      id: v.id as string,
      name: v.name as string,
      price: Number(v.price),
    });
  }

  const modsByItem: Record<string, { id: string; name: string; price: number }[]> = {};
  const modsByGroup: Record<string, { id: string; name: string; price: number; child_group_id: string | null }[]> = {};
  for (const m of modsData ?? []) {
    const itemId = m.catalog_item_id as string;
    const opt = { id: m.id as string, name: m.name as string, price: Number(m.price), child_group_id: (m.child_group_id as string | null) ?? null };
    if (!modsByItem[itemId]) modsByItem[itemId] = [];
    modsByItem[itemId].push({ id: opt.id, name: opt.name, price: opt.price });
    const gid = (m.group_id as string | null) ?? null;
    if (gid) {
      if (!modsByGroup[gid]) modsByGroup[gid] = [];
      modsByGroup[gid].push(opt);
    }
  }

  type CatModGroup = { id: string; name: string; required: boolean; min_select: number; max_select: number | null; options: { id: string; name: string; price: number; child_group_id: string | null }[] };
  const groupsByItem: Record<string, CatModGroup[]> = {};
  for (const g of modGroupsData ?? []) {
    const itemId = g.catalog_item_id as string;
    if (!groupsByItem[itemId]) groupsByItem[itemId] = [];
    groupsByItem[itemId].push({
      id: g.id as string,
      name: g.name as string,
      required: (g.required as boolean | null) ?? false,
      min_select: Number(g.min_select) || 0,
      max_select: g.max_select === null || g.max_select === undefined ? null : Number(g.max_select),
      options: modsByGroup[g.id as string] ?? [],
    });
  }

  const items = (itemsData ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    price: Number(i.price),
    category: (i.category as string | null) ?? null,
    is_active: i.is_active as boolean,
    taxable: (i.taxable as boolean | null) ?? true,
    tax_rate_id: (i.tax_rate_id as string | null) ?? null,
    barcode: (i.barcode as string | null) ?? null,
    image_url: (i.image_url as string | null) ?? null,
    out_of_stock: (i.out_of_stock as boolean | null) ?? false,
    default_course_id: (i.default_course_id as string | null) ?? null,
    station_id: (i.station_id as string | null) ?? null,
    variations: varsByItem[i.id as string] ?? [],
    modifiers: modsByItem[i.id as string] ?? [],
    modifierGroups: groupsByItem[i.id as string] ?? [],
  }));

  const taxRates = (ratesData ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    rate: Number(r.rate),
  }));

  // Courses (full-service only): drive both the per-item "default course" picker
  // and the Courses management card on this page.
  const courseRows = hasFloorService(business) ? await listCourses() : [];
  const courses = courseRows.map((c) => ({ id: c.id, name: c.name }));

  // Prep stations (full-service only): drive the per-item station picker.
  const stationRows = hasFloorService(business) ? await listKitchenStations() : [];
  const stations = stationRows.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">
            The products and services you sell at checkout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Link
              href="/app/recipes"
              className="text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
            >
              Recipes &amp; costing
            </Link>
          )}
          {canManage && (
            <Link
              href="/app/purchasing"
              className="text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
            >
              Purchasing
            </Link>
          )}
          <MenuBoardLink businessId={business.id} />
          <ImportMenu />
        </div>
      </div>
      {courseRows.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold mb-3">Courses</h2>
          <CoursesCard initial={courseRows} />
        </div>
      )}
      <CatalogClient
        initialItems={items}
        taxRates={taxRates}
        initialCategoryColors={categoryColors}
        courses={courses}
        stations={stations}
      />
    </div>
  );
}