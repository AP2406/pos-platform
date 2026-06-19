"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

// Interpret a wall-clock date + time in the business timezone and return the UTC
// ISO instant. Standard offset-correction trick (DST edges aside).
function localToUtcIso(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, (mo || 1) - 1, d || 1, h || 0, mi || 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "UTC",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const hr = g("hour") === 24 ? 0 : g("hour");
  const tzWall = Date.UTC(g("year"), g("month") - 1, g("day"), hr, g("minute"));
  const offset = tzWall - guess;
  return new Date(guess - offset).toISOString();
}

export async function addShift(input: {
  staffId: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  roleLabel?: string;
  note?: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can edit the schedule." };
  if (!input.staffId) return { error: "Choose a staff member." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Pick a date." };
  if (!/^\d{1,2}:\d{2}$/.test(input.start) || !/^\d{1,2}:\d{2}$/.test(input.end)) {
    return { error: "Enter start and end times." };
  }
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const startIso = localToUtcIso(input.date, input.start, tz);
  let endIso = localToUtcIso(input.date, input.end, tz);
  // Overnight shift: end rolls to the next day.
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    const next = new Date(input.date + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    endIso = localToUtcIso(next.toISOString().slice(0, 10), input.end, tz);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("shifts").insert({
    business_id: business.id,
    staff_id: input.staffId,
    starts_at: startIso,
    ends_at: endIso,
    role_label: input.roleLabel ? input.roleLabel.slice(0, 40) : null,
    note: input.note ? input.note.slice(0, 200) : null,
    created_by: user ? user.id : null,
  });
  if (error) {
    console.error("addShift:", error);
    return { error: "Could not add the shift." };
  }
  revalidatePath("/app/schedule");
  return { ok: true };
}

export async function deleteShift(id: string): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing shift." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can edit the schedule." };
  const supabase = await createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", id).eq("business_id", business.id);
  if (error) {
    console.error("deleteShift:", error);
    return { error: "Could not remove the shift." };
  }
  revalidatePath("/app/schedule");
  return { ok: true };
}

export async function publishWeek(
  startIso: string,
  endIso: string
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can publish." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("shifts")
    .update({ published: true })
    .eq("business_id", business.id)
    .gte("starts_at", startIso)
    .lt("starts_at", endIso)
    .eq("published", false);
  if (error) {
    console.error("publishWeek:", error);
    return { error: "Could not publish." };
  }
  revalidatePath("/app/schedule");
  return { ok: true };
}

// ---- P1.3 shift templates -------------------------------------------------

export type ShiftTemplate = { id: string; name: string; count: number };
type TemplateItem = { dow: number; staff_id: string | null; start: string; end: string; role_label: string | null };

// Local day-of-week (Mon=0) and HH:MM in the business tz for an instant.
function localDowTime(iso: string, tz: string): { dow: number; time: string } {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(iso));
  const dow = (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) + 6) % 7; // Mon=0
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  return { dow, time };
}

export async function listShiftTemplates(): Promise<ShiftTemplate[]> {
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("shift_templates")
    .select("id, name, items")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    count: Array.isArray(t.items) ? (t.items as unknown[]).length : 0,
  }));
}

// Snapshot the given week's shifts into a reusable template.
export async function saveWeekAsTemplate(
  name: string,
  startIso: string,
  endIso: string
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can save templates." };
  const clean = (name || "").trim().slice(0, 60);
  if (!clean) return { error: "Name the template." };
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("shifts")
    .select("staff_id, starts_at, ends_at, role_label")
    .eq("business_id", business.id)
    .gte("starts_at", startIso)
    .lt("starts_at", endIso);
  if (!rows || rows.length === 0) return { error: "This week has no shifts to save." };
  const items: TemplateItem[] = rows.map((s) => {
    const st = localDowTime(s.starts_at as string, tz);
    const en = localDowTime(s.ends_at as string, tz);
    return { dow: st.dow, staff_id: (s.staff_id as string | null) ?? null, start: st.time, end: en.time, role_label: (s.role_label as string | null) ?? null };
  });
  const { error } = await supabase.from("shift_templates").insert({ business_id: business.id, name: clean, items });
  if (error) {
    console.error("saveWeekAsTemplate:", error);
    return { error: "Could not save the template." };
  }
  revalidatePath("/app/schedule");
  return { ok: true };
}

// Apply a template's shifts onto the week starting at targetMonday (YYYY-MM-DD),
// as unpublished drafts. Reuses addShift's overnight handling.
export async function applyTemplate(
  templateId: string,
  targetMonday: string
): Promise<{ ok: true; added: number } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can apply templates." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetMonday)) return { error: "Bad week." };
  const supabase = await createClient();
  const { data: tpl } = await supabase
    .from("shift_templates")
    .select("items")
    .eq("id", templateId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!tpl) return { error: "Template not found." };
  const items = (Array.isArray(tpl.items) ? tpl.items : []) as TemplateItem[];
  if (items.length === 0) return { error: "Template is empty." };
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const { data: { user } } = await supabase.auth.getUser();

  const dayOffset = (dow: number) => {
    const [y, mo, d] = targetMonday.split("-").map(Number);
    const dt = new Date(Date.UTC(y, (mo || 1) - 1, d || 1));
    dt.setUTCDate(dt.getUTCDate() + dow);
    return dt.toISOString().slice(0, 10);
  };

  const inserts = items
    .filter((it) => it.staff_id) // unassigned template slots are skipped (no staff to attach)
    .map((it) => {
      const date = dayOffset(Math.max(0, Math.min(6, Number(it.dow) || 0)));
      const startIso = localToUtcIso(date, it.start, tz);
      let endIso = localToUtcIso(date, it.end, tz);
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        const next = new Date(date + "T00:00:00Z");
        next.setUTCDate(next.getUTCDate() + 1);
        endIso = localToUtcIso(next.toISOString().slice(0, 10), it.end, tz);
      }
      return {
        business_id: business.id,
        staff_id: it.staff_id,
        starts_at: startIso,
        ends_at: endIso,
        role_label: it.role_label ? it.role_label.slice(0, 40) : null,
        published: false,
        created_by: user ? user.id : null,
      };
    });
  if (inserts.length === 0) return { error: "Template has no assigned shifts to apply." };
  const { error } = await supabase.from("shifts").insert(inserts);
  if (error) {
    console.error("applyTemplate:", error);
    return { error: "Could not apply the template." };
  }
  revalidatePath("/app/schedule");
  return { ok: true, added: inserts.length };
}

export async function deleteShiftTemplate(id: string): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing template." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can delete templates." };
  const supabase = await createClient();
  const { error } = await supabase.from("shift_templates").delete().eq("id", id).eq("business_id", business.id);
  if (error) {
    console.error("deleteShiftTemplate:", error);
    return { error: "Could not delete the template." };
  }
  revalidatePath("/app/schedule");
  return { ok: true };
}

// Drag-to-move: keep the shift's local times, change its day. (Times are edited
// via delete + re-add; this is day reassignment only.)
export async function moveShift(id: string, newDate: string): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing shift." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { error: "Bad day." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can edit the schedule." };
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("shifts")
    .select("starts_at, ends_at")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!s) return { error: "Shift not found." };
  const hm = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const startTime = hm(s.starts_at as string);
  const endTime = hm(s.ends_at as string);
  const startIso = localToUtcIso(newDate, startTime, tz);
  let endIso = localToUtcIso(newDate, endTime, tz);
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    const next = new Date(newDate + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    endIso = localToUtcIso(next.toISOString().slice(0, 10), endTime, tz);
  }
  const { error } = await supabase
    .from("shifts")
    .update({ starts_at: startIso, ends_at: endIso, published: false })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("moveShift:", error);
    return { error: "Could not move the shift." };
  }
  revalidatePath("/app/schedule");
  return { ok: true };
}

// ---- P1.3 time-off / availability + swap requests -------------------------

export type TimeOff = { id: string; staffId: string; date: string; note: string | null };

export async function listTimeOff(startIso: string, endIso: string): Promise<TimeOff[]> {
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return [];
  const supabase = await createClient();
  const lo = startIso.slice(0, 10);
  const hi = endIso.slice(0, 10);
  const { data } = await supabase
    .from("staff_availability")
    .select("id, staff_id, date, note")
    .eq("business_id", business.id)
    .gte("date", lo)
    .lt("date", hi);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    staffId: r.staff_id as string,
    date: r.date as string,
    note: (r.note as string | null) ?? null,
  }));
}

export async function addTimeOff(staffId: string, date: string, note?: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can record time off." };
  if (!staffId) return { error: "Choose a staff member." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a date." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_availability")
    .upsert({ business_id: business.id, staff_id: staffId, date, kind: "time_off", note: note ? note.slice(0, 200) : null }, { onConflict: "business_id,staff_id,date" });
  if (error) {
    console.error("addTimeOff:", error);
    return { error: "Could not save the time off." };
  }
  revalidatePath("/app/schedule");
  return { ok: true };
}

export async function deleteTimeOff(id: string): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing entry." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can change this." };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_availability").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not remove the entry." };
  revalidatePath("/app/schedule");
  return { ok: true };
}

// Offer a shift to another staff member; a manager approves it in /app/approvals,
// which reassigns the shift (decideApproval handles kind 'shift_swap').
export async function requestShiftSwap(shiftId: string, toStaffId: string): Promise<{ ok: true } | { error: string }> {
  if (!shiftId || !toStaffId) return { error: "Pick a shift and a staff member." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can request a swap." };
  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("shifts").select("id, staff_id, starts_at").eq("id", shiftId).eq("business_id", business.id).maybeSingle();
  if (!shift) return { error: "Shift not found." };
  const { data: to } = await supabase
    .from("staff_members").select("name").eq("id", toStaffId).eq("business_id", business.id).maybeSingle();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("approval_requests").insert({
    business_id: business.id,
    kind: "shift_swap",
    order_id: null,
    requested_by: user ? user.id : null,
    status: "pending",
    payload: { source: "schedule", context: "Shift swap", shift_id: shiftId, to_staff_id: toStaffId, to_name: (to?.name as string | null) ?? null },
  });
  if (error) {
    console.error("requestShiftSwap:", error);
    return { error: "Could not send the swap request." };
  }
  revalidatePath("/app/approvals");
  return { ok: true };
}
