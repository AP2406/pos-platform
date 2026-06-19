"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export type OnShift = { staffId: string; name: string; since: string; onBreakSince: string | null };

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
    .select("id, on_break_since, break_minutes")
    .eq("business_id", business.id)
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();

  const now = new Date().toISOString();
  if (open) {
    // Clocking out while on break folds the open break into the total first.
    let breakMin = Number(open.break_minutes) || 0;
    if (open.on_break_since) {
      breakMin += Math.max(0, (Date.now() - new Date(open.on_break_since as string).getTime()) / 60000);
    }
    const { error: outErr } = await supabase
      .from("time_clock_entries")
      .update({ clock_out: now, on_break_since: null, break_minutes: Math.round(breakMin * 100) / 100 })
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

// Start or end an unpaid break for the staff member's open shift (PIN-identified).
export async function breakToggle(
  pin: string
): Promise<{ ok: true; action: "break_start" | "break_end"; name: string } | { error: string }> {
  if (!/^[0-9]{4,6}$/.test(pin)) return { error: "Enter your 4 to 6 digit PIN." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data } = await supabase.rpc("verify_staff_member_pin", { p_business_id: business.id, p_pin: pin });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "PIN not recognized." };
  const staffId = row.id as string;
  const name = row.name as string;

  const { data: open } = await supabase
    .from("time_clock_entries")
    .select("id, on_break_since, break_minutes")
    .eq("business_id", business.id)
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();
  if (!open) return { error: "Clock in before taking a break." };

  if (open.on_break_since) {
    const mins = Math.max(0, (Date.now() - new Date(open.on_break_since as string).getTime()) / 60000);
    const total = Math.round(((Number(open.break_minutes) || 0) + mins) * 100) / 100;
    const { error } = await supabase
      .from("time_clock_entries")
      .update({ on_break_since: null, break_minutes: total })
      .eq("id", open.id as string)
      .eq("business_id", business.id);
    if (error) return { error: "Could not end the break." };
    revalidatePath("/app/clock");
    return { ok: true, action: "break_end", name };
  }

  const { error } = await supabase
    .from("time_clock_entries")
    .update({ on_break_since: new Date().toISOString() })
    .eq("id", open.id as string)
    .eq("business_id", business.id);
  if (error) return { error: "Could not start the break." };
  revalidatePath("/app/clock");
  return { ok: true, action: "break_start", name };
}

// Who is currently on the clock.
export async function listOnShift(): Promise<OnShift[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_clock_entries")
    .select("staff_id, clock_in, on_break_since, staff:staff_members(name)")
    .eq("business_id", business.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: true });
  return (data ?? []).map((r) => {
    const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff;
    return {
      staffId: r.staff_id as string,
      name: (staff?.name as string | undefined) ?? "Staff",
      since: r.clock_in as string,
      onBreakSince: (r.on_break_since as string | null) ?? null,
    };
  });
}

export type TimeEntry = {
  id: string;
  staffId: string;
  name: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  edited: boolean;
  note: string | null;
  missedPunch: boolean; // open shift older than 16h — likely a forgotten clock-out
};

// Recent time entries for the manager timesheet (last `days`, default 14).
export async function listTimesheet(days = 14): Promise<TimeEntry[]> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return [];
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("time_clock_entries")
    .select("id, staff_id, clock_in, clock_out, break_minutes, edited_at, note, staff:staff_members(name)")
    .eq("business_id", business.id)
    .gte("clock_in", since)
    .order("clock_in", { ascending: false })
    .limit(200);
  const now = Date.now();
  return (data ?? []).map((r) => {
    const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff;
    const ci = r.clock_in as string;
    return {
      id: r.id as string,
      staffId: r.staff_id as string,
      name: (staff?.name as string | undefined) ?? "Staff",
      clockIn: ci,
      clockOut: (r.clock_out as string | null) ?? null,
      breakMinutes: Number(r.break_minutes) || 0,
      edited: r.edited_at != null,
      note: (r.note as string | null) ?? null,
      missedPunch: r.clock_out == null && now - new Date(ci).getTime() > 16 * 3600000,
    };
  });
}

// Manager edit of a time entry (missed-punch fix / correction). Writes the change
// to audit_events with before/after, and stamps edited_by/edited_at on the row.
export async function editTimeEntry(input: {
  entryId: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  note?: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can edit time entries." };
  }
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("time_clock_entries")
    .select("id, staff_id, clock_in, clock_out, break_minutes")
    .eq("id", input.entryId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!before) return { error: "Entry not found." };

  const ci = new Date(input.clockIn);
  if (isNaN(ci.getTime())) return { error: "Enter a valid clock-in time." };
  let co: string | null = null;
  if (input.clockOut) {
    const d = new Date(input.clockOut);
    if (isNaN(d.getTime())) return { error: "Enter a valid clock-out time." };
    if (d.getTime() < ci.getTime()) return { error: "Clock-out can't be before clock-in." };
    co = d.toISOString();
  }
  const brk = Math.max(0, Math.round((Number(input.breakMinutes) || 0) * 100) / 100);

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("time_clock_entries")
    .update({
      clock_in: ci.toISOString(),
      clock_out: co,
      break_minutes: brk,
      on_break_since: null,
      edited_by: user ? user.id : null,
      edited_at: new Date().toISOString(),
      note: input.note ? input.note.trim().slice(0, 300) : null,
    })
    .eq("id", input.entryId)
    .eq("business_id", business.id);
  if (error) {
    console.error("editTimeEntry:", error);
    return { error: "Could not save the edit." };
  }

  await supabase.from("audit_events").insert({
    business_id: business.id,
    actor_id: user ? user.id : null,
    actor_role: role,
    action: "time_edit",
    reason_code: "timesheet_edit",
    reason_note: input.note ? input.note.trim().slice(0, 300) : null,
    metadata: {
      entry_id: input.entryId,
      staff_id: before.staff_id,
      before: { clock_in: before.clock_in, clock_out: before.clock_out, break_minutes: Number(before.break_minutes) || 0 },
      after: { clock_in: ci.toISOString(), clock_out: co, break_minutes: brk },
    },
  });

  revalidatePath("/app/labor");
  revalidatePath("/app/clock");
  return { ok: true };
}
