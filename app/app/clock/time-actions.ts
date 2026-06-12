"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export type OnShift = { staffId: string; name: string; since: string };

// P1-24: clock a staff member in or out. They're identified by their own PIN
// (same RPC as the register staff switch). If they have an open shift it's
// closed (clock out); otherwise a new shift opens (clock in).
export async function clockToggle(
  pin: string
): Promise<{ ok: true; action: "in" | "out"; name: string; at: string } | { error: string }> {
  if (!/^[0-9]{4,6}$/.test(pin)) return { error: "Enter your 4 to 6 digit PIN." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("verify_staff_member_pin", {
    p_business_id: business.id,
    p_pin: pin,
  });
  if (error) {
    console.error("clockToggle verify:", error);
    return { error: "Could not verify PIN. Please try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "PIN not recognized." };
  const staffId = row.id as string;
  const name = row.name as string;

  const { data: open } = await supabase
    .from("time_clock_entries")
    .select("id")
    .eq("business_id", business.id)
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();

  const now = new Date().toISOString();
  if (open) {
    const { error: outErr } = await supabase
      .from("time_clock_entries")
      .update({ clock_out: now })
      .eq("id", open.id as string)
      .eq("business_id", business.id);
    if (outErr) {
      console.error("clockToggle out:", outErr);
      return { error: "Could not clock out. Please try again." };
    }
    revalidatePath("/app/clock");
    return { ok: true, action: "out", name, at: now };
  }

  const { error: inErr } = await supabase
    .from("time_clock_entries")
    .insert({ business_id: business.id, staff_id: staffId, clock_in: now });
  if (inErr) {
    console.error("clockToggle in:", inErr);
    return { error: "Could not clock in. Please try again." };
  }
  revalidatePath("/app/clock");
  return { ok: true, action: "in", name, at: now };
}

// Who is currently on the clock.
export async function listOnShift(): Promise<OnShift[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_clock_entries")
    .select("staff_id, clock_in, staff:staff_members(name)")
    .eq("business_id", business.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: true });
  return (data ?? []).map((r) => {
    const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff;
    return {
      staffId: r.staff_id as string,
      name: (staff?.name as string | undefined) ?? "Staff",
      since: r.clock_in as string,
    };
  });
}
