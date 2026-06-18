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
