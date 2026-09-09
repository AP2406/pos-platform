"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { canAccess } from "@/lib/services/route-access";

// Same matrix the pages and the sidebar use, so a role that can see this
// screen can act on it — and the two can never drift apart.
function canManage(role: string): boolean {
  return canAccess(role, "edit_staff");
}

// The granular role_id is the source of truth for permissions; we still set the
// legacy staff_members.role enum (the create RPC + PIN verify use it) by mapping
// each role's key to the closest enum value.
function legacyEnumForRoleKey(key: string | null): string {
  switch (key) {
    case "manager":
      return "manager";
    case "host":
      return "trainee";
    case "owner": // never assigned to staff; treated as manager-class if it slips through
    case "manager_legacy":
      return "manager";
    default:
      return "staff";
  }
}

type ResolvedRole = { id: string; key: string | null };

async function resolveRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  roleId: string
): Promise<ResolvedRole | null> {
  const { data } = await supabase
    .from("roles")
    .select("id, key")
    .eq("id", roleId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, key: (data.key as string | null) ?? null };
}

function pinError(msg: string): string {
  if (msg.includes("PIN already in use")) return "That PIN is already used by another staff member.";
  if (msg.includes("PIN too short")) return "PIN must be 4 to 6 digits.";
  return "";
}

export async function createStaff(
  name: string,
  roleId: string,
  pin: string
): Promise<{ ok: true; id: string } | { error: string }> {
  const clean = (name || "").trim();
  if (!clean) return { error: "Name is required." };
  if (!roleId) return { error: "Choose a role." };
  if (!/^[0-9]{4,6}$/.test(pin)) return { error: "PIN must be 4 to 6 digits." };

  const { business, role: myRole } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(myRole)) return { error: "Only an owner or manager can add staff." };

  const supabase = await createClient();
  const resolved = await resolveRole(supabase, business.id, roleId);
  if (!resolved) return { error: "Choose a role." };
  if (resolved.key === "owner") return { error: "The Owner role can't be assigned to staff." };

  const { data, error } = await supabase.rpc("create_staff_member", {
    p_business_id: business.id,
    p_name: clean.slice(0, 80),
    p_role: legacyEnumForRoleKey(resolved.key),
    p_pin: pin,
  });
  if (error) {
    console.error("createStaff:", error);
    const mapped = pinError((error as { message?: string }).message || "");
    return { error: mapped || "Could not add staff. Please try again." };
  }
  const newId = data as string;
  await supabase
    .from("staff_members")
    .update({ role_id: roleId })
    .eq("id", newId)
    .eq("business_id", business.id);
  revalidatePath("/app/settings");
  return { ok: true, id: newId };
}

export async function updateStaff(
  id: string,
  name: string,
  roleId: string
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing staff." };
  const clean = (name || "").trim();
  if (!clean) return { error: "Name is required." };
  if (!roleId) return { error: "Choose a role." };

  const { business, role: myRole } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(myRole)) return { error: "Only an owner or manager can edit staff." };

  const supabase = await createClient();
  const resolved = await resolveRole(supabase, business.id, roleId);
  if (!resolved) return { error: "Choose a role." };
  if (resolved.key === "owner") return { error: "The Owner role can't be assigned to staff." };

  const { error } = await supabase
    .from("staff_members")
    .update({
      name: clean.slice(0, 80),
      role: legacyEnumForRoleKey(resolved.key),
      role_id: roleId,
    })
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

  const { business, role: myRole } = await requireBusiness();
  assertConfigEditable(business);
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

export async function setStaffPayRate(
  id: string,
  rate: number | null
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing staff." };
  const { business, role: myRole } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(myRole)) return { error: "Only an owner or manager can set pay rates." };
  let v: number | null = null;
  if (rate != null && Number.isFinite(rate) && rate > 0) v = Math.min(10000, Math.round(rate * 100) / 100);
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_members")
    .update({ pay_rate: v })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setStaffPayRate:", error);
    return { error: "Could not save the pay rate." };
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
  assertConfigEditable(business);
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
// CUST-1: grant or revoke a single permission for one staff member, on top of
// their role (value true = grant, false = revoke, null = clear → inherit). Never
// changes the role; audited as a permission_override. Owner/manager only.
export async function setStaffPermissionOverride(
  staffId: string,
  key: string,
  value: boolean | null
): Promise<{ ok: true } | { error: string }> {
  const { PERMISSION_KEYS } = await import("@/lib/services/permissions");
  if (!staffId) return { error: "Missing staff member." };
  if (!(PERMISSION_KEYS as readonly string[]).includes(key)) return { error: "Unknown permission." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(role)) return { error: "Only an owner or manager can change access." };

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from("staff_members")
    .select("permission_overrides")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (readErr) return { error: "Per-user overrides need migration 0070 applied." };
  const overrides = { ...(((row?.permission_overrides ?? {}) as Record<string, boolean>)) };
  if (value === null) delete overrides[key];
  else overrides[key] = value;

  const { error } = await supabase
    .from("staff_members")
    .update({ permission_overrides: overrides })
    .eq("id", staffId)
    .eq("business_id", business.id);
  if (error) {
    console.error("setStaffPermissionOverride:", error);
    return { error: "Could not save the override." };
  }
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("audit_events").insert({
    business_id: business.id, actor_id: user ? user.id : null, actor_role: role,
    action: "permission_override", metadata: { staff_id: staffId, key, value },
  });
  revalidatePath("/app/settings");
  return { ok: true };
}
