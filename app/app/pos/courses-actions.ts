"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { revalidatePath } from "next/cache";

export type Course = { id: string; name: string; sort_order: number };

const DEFAULT_COURSES = ["Drinks", "Appetizers", "Entrées", "Dessert"];

// List a business's courses, ordered. For a full-service business with none yet,
// seed the standard four on first read (mirrors listFloorPlans auto-seeding).
export async function listCourses(): Promise<Course[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, name, sort_order")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  let rows = data ?? [];
  if (rows.length === 0 && hasFloorService(business)) {
    const seed = DEFAULT_COURSES.map((name, i) => ({ business_id: business.id, name, sort_order: i }));
    const { data: inserted } = await supabase
      .from("courses")
      .insert(seed)
      .select("id, name, sort_order");
    rows = (inserted ?? []).sort((a, b) => (a.sort_order as number) - (b.sort_order as number));
  }
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, sort_order: r.sort_order as number }));
}

async function requireManager() {
  const ctx = await requireBusiness();
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return { error: "Only an owner or manager can change courses." as const };
  }
  return ctx;
}

export async function createCourse(name: string): Promise<{ ok: true; course: Course } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { error: "Enter a course name." };
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("courses")
    .select("sort_order")
    .eq("business_id", ctx.business.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;
  const { data, error } = await supabase
    .from("courses")
    .insert({ business_id: ctx.business.id, name: clean, sort_order: nextOrder })
    .select("id, name, sort_order")
    .single();
  if (error || !data) return { error: "Could not add the course." };
  revalidatePath("/app/settings");
  return { ok: true, course: { id: data.id as string, name: data.name as string, sort_order: data.sort_order as number } };
}

export async function renameCourse(id: string, name: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { error: "Enter a course name." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ name: clean })
    .eq("id", id)
    .eq("business_id", ctx.business.id);
  if (error) return { error: "Could not rename the course." };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function deleteCourse(id: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const supabase = await createClient();
  // Soft-delete so any historical references stay intact.
  const { error } = await supabase
    .from("courses")
    .update({ is_active: false })
    .eq("id", id)
    .eq("business_id", ctx.business.id);
  if (error) return { error: "Could not remove the course." };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function reorderCourses(orderedIds: string[]): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from("courses")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("business_id", ctx.business.id);
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
