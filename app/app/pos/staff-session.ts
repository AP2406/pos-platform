"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { cookies } from "next/headers";

const ACTIVE_STAFF_COOKIE = "surge_active_staff";

export type ActiveStaff = { id: string; name: string; role: string };

export async function setActiveStaff(
  pin: string
): Promise<{ ok: true; staff: ActiveStaff } | { error: string }> {
  if (!/^[0-9]{4,6}$/.test(pin)) return { error: "Enter your 4 to 6 digit PIN." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_staff_member_pin", {
    p_business_id: business.id,
    p_pin: pin,
  });
  if (error) {
    console.error("setActiveStaff:", error);
    return { error: "Could not verify PIN. Please try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "PIN not recognized." };
  const staff: ActiveStaff = {
    id: row.id as string,
    name: row.name as string,
    role: row.role as string,
  };
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_STAFF_COOKIE, staff.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return { ok: true, staff: staff };
}

export async function clearActiveStaff(): Promise<{ ok: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_STAFF_COOKIE);
  return { ok: true };
}

export async function getActiveStaff(): Promise<ActiveStaff | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(ACTIVE_STAFF_COOKIE)?.value;
  if (!id) return null;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("id, name, role, is_active")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!data || data.is_active === false) return null;
  return { id: data.id as string, name: data.name as string, role: data.role as string };
}