"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { staffPermissionsById } from "@/lib/services/permissions-server";
import { makeActiveStaffCookie } from "@/lib/services/active-staff-cookie";
import { cookies } from "next/headers";

const ACTIVE_STAFF_COOKIE = "surge_active_staff";
// Per-device PIN throttle. A wrong PIN doesn't identify a staff member, so
// lockout is enforced at the device level: after MAX_PIN_FAILS consecutive bad
// entries the pad is frozen for LOCKOUT_SECONDS. State lives in an httpOnly
// cookie so it survives reloads but stays scoped to this till.
const PIN_FAIL_COOKIE = "surge_pin_fails";
const MAX_PIN_FAILS = 5;
const LOCKOUT_SECONDS = 60;

export type ActiveStaff = {
  id: string;
  name: string;
  role: string;
  permissions: string[];
  compCap: number | null;
  discountCap: number | null;
};

export async function setActiveStaff(
  pin: string
): Promise<{ ok: true; staff: ActiveStaff } | { error: string }> {
  if (!/^[0-9]{4,6}$/.test(pin)) return { error: "Enter your 4 to 6 digit PIN." };
  const { business } = await requireBusiness();
  const cookieStore = await cookies();

  // Throttle check: cookie holds { n: failedCount, until: epochSeconds }.
  const now = Math.floor(Date.now() / 1000);
  let fails = 0;
  const raw = cookieStore.get(PIN_FAIL_COOKIE)?.value;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { n?: number; until?: number };
      if (parsed.until && parsed.until > now) {
        return { error: `Too many attempts. Try again in ${parsed.until - now}s.` };
      }
      fails = Number(parsed.n) || 0;
    } catch {
      fails = 0;
    }
  }

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
  if (!row) {
    const n = fails + 1;
    const locked = n >= MAX_PIN_FAILS;
    cookieStore.set(
      PIN_FAIL_COOKIE,
      JSON.stringify({ n: locked ? 0 : n, until: locked ? now + LOCKOUT_SECONDS : 0 }),
      { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 }
    );
    if (locked) return { error: `Too many attempts. Try again in ${LOCKOUT_SECONDS}s.` };
    return { error: `PIN not recognized. ${MAX_PIN_FAILS - n} attempt(s) left.` };
  }

  // Success — clear the throttle and sign the cashier in.
  cookieStore.delete(PIN_FAIL_COOKIE);
  const perms = await staffPermissionsById(supabase, business.id, row.id as string);
  const staff: ActiveStaff = {
    id: row.id as string,
    name: row.name as string,
    role: row.role as string,
    permissions: perms?.keys ?? [],
    compCap: perms?.compCap ?? null,
    discountCap: perms?.discountCap ?? null,
  };
  cookieStore.set(ACTIVE_STAFF_COOKIE, makeActiveStaffCookie(business.id, staff.id), {
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
  const perms = await staffPermissionsById(supabase, business.id, id);
  if (!perms) return null;
  return {
    id: perms.staffId,
    name: perms.name,
    role: perms.legacyRole,
    permissions: perms.keys,
    compCap: perms.compCap,
    discountCap: perms.discountCap,
  };
}