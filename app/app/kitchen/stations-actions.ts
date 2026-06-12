"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export type KitchenStation = { id: string; name: string; sort_order: number };

export async function listKitchenStations(): Promise<KitchenStation[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("kitchen_stations")
    .select("id, name, sort_order")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((s) => ({ id: s.id as string, name: s.name as string, sort_order: s.sort_order as number }));
}

async function requireManager() {
  const ctx = await requireBusiness();
  if (ctx.role !== "owner" && ctx.role !== "manager") return { error: "Only an owner or manager can change stations." as const };
  return ctx;
}

export async function createKitchenStation(name: string): Promise<{ ok: true; station: KitchenStation } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { error: "Enter a station name." };
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("kitchen_stations").select("sort_order").eq("business_id", ctx.business.id)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sort = maxRow ? (maxRow.sort_order as number) + 1 : 0;
  const { data, error } = await supabase
    .from("kitchen_stations")
    .insert({ business_id: ctx.business.id, name: clean, sort_order: sort })
    .select("id, name, sort_order").single();
  if (error || !data) return { error: "Could not add the station." };
  revalidatePath("/app/settings");
  return { ok: true, station: { id: data.id as string, name: data.name as string, sort_order: data.sort_order as number } };
}

export async function renameKitchenStation(id: string, name: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { error: "Enter a station name." };
  const supabase = await createClient();
  const { error } = await supabase.from("kitchen_stations").update({ name: clean }).eq("id", id).eq("business_id", ctx.business.id);
  if (error) return { error: "Could not rename the station." };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function deleteKitchenStation(id: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const supabase = await createClient();
  const { error } = await supabase.from("kitchen_stations").update({ is_active: false }).eq("id", id).eq("business_id", ctx.business.id);
  if (error) return { error: "Could not remove the station." };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function setCatalogItemStation(itemId: string, stationId: string | null): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const supabase = await createClient();
  if (stationId) {
    const { data: st } = await supabase.from("kitchen_stations").select("id").eq("id", stationId).eq("business_id", ctx.business.id).maybeSingle();
    if (!st) return { error: "Station not found." };
  }
  const { error } = await supabase.from("catalog_items").update({ station_id: stationId }).eq("id", itemId).eq("business_id", ctx.business.id);
  if (error) return { error: "Could not set the station." };
  revalidatePath("/app/catalog");
  return { ok: true };
}
