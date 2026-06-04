"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

const ROLES = ["manager", "staff", "trainee"];

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

function pinError(msg: string): string {
  if (msg.includes("PIN already in use")) return "That PIN is already used by another staff member.";
  if (msg.includes("PIN too short")) return "PIN must be 4 to 6 digits.";
  return "";
}

export async function createStaff(
  name: string,
  role: string,
  pin: string
): Promise<{ ok: true; id: string } | { error: string }> {
  const clean = (name || "").trim();
  if (!clean) return { error: "Name is required." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  if (!/^[0-9]{4,6}$/.test(pin)) return { error: "PIN must be 4 to 6 digits." };

  const { business, role: myRole } = await requireBusiness();
  if (!canManage(myRole)) return { error: "Only an owner or manager can add staff." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_staff_member", {
    p_business_id: business.id,
    p_name: clean.slice(0, 80),
    p_role: role,
    p_pin: pin,
  });
  if (error) {
    console.error("createStaff:", error);
    const mapped = pinError((error as { message?: string }).message || "");
    return { error: mapped || "Could not add staff. Please try again." };
  }
  revalidatePath("/app/settings");
  return { ok: true, id: data as string };
}

export async function updateStaff(
  id: string,
  name: string,
  role: string
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing staff." };
  const clean = (name || "").trim();
  if (!clean) return { error: "Name is required." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };

  const { business, role: myRole } = await requireBusiness();
  if (!canManage(myRole)) return { error: "Only an owner or manager can edit staff." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_members")
    .update({ name: clean.slice(0, 80), role: role })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("updateStaff:", error);
    return { error: "Could not update staff. Please try again." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function setStaffPin(
  id: string,
  pin: string
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing staff." };
  if (!/^[0-9]{4,6}$/.test(pin)) return { error: "PIN must be 4 to 6 digits." };

  const { role: myRole } = await requireBusiness();
  if (!canManage(myRole)) return { error: "Only an owner or manager can change PINs." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_member_pin", { p_staff_id: id, p_pin: pin });
  if (error) {
    console.error("setStaffPin:", error);
    const mapped = pinError((error as { message?: string }).message || "");
    return { error: mapped || "Could not update the PIN. Please try again." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function setStaffActive(
  id: string,
  active: boolean
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing staff." };
  const { business, role: myRole } = await requireBusiness();
  if (!canManage(myRole)) return { error: "Only an owner or manager can change staff." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_members")
    .update({ is_active: active })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setStaffActive:", error);
    return { error: "Could not update staff. Please try again." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}