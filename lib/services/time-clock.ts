import type { SupabaseClient } from "@supabase/supabase-js";

// Self-service time clock — money-independent staff state. The acting staff (the
// verified X-Surge-Staff identity) clocks themselves in/out or toggles a break on
// their own device: no PIN re-entry and no schedule enforcement (that lives on the
// shared web terminal via clockToggle). Same table + one-open-shift invariant.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, "public", any>;

export type ClockShiftState = { onShift: boolean; onBreak: boolean; since: string | null; onBreakSince: string | null };
export type ClockToggleResult = ClockShiftState & { action: "in" | "out"; name: string };
export type BreakToggleResult = ClockShiftState & { action: "break_start" | "break_end"; name: string };

async function openEntry(supabase: Sb, businessId: string, staffId: string) {
  const { data } = await supabase
    .from("time_clock_entries")
    .select("id, clock_in, on_break_since, break_minutes")
    .eq("business_id", businessId)
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();
  return data;
}

async function staffName(supabase: Sb, businessId: string, staffId: string): Promise<string> {
  const { data } = await supabase.from("staff_members").select("name").eq("id", staffId).eq("business_id", businessId).maybeSingle();
  return (data?.name as string | undefined) ?? "Staff";
}

// Clock the staff member in (no open shift) or out (fold any open break in first).
export async function clockToggleCore(supabase: Sb, businessId: string, staffId: string): Promise<ClockToggleResult | { error: string }> {
  const name = await staffName(supabase, businessId, staffId);
  const open = await openEntry(supabase, businessId, staffId);
  const now = new Date().toISOString();

  if (open) {
    let breakMin = Number(open.break_minutes) || 0;
    if (open.on_break_since) breakMin += Math.max(0, (Date.now() - new Date(open.on_break_since as string).getTime()) / 60000);
    const { error } = await supabase
      .from("time_clock_entries")
      .update({ clock_out: now, on_break_since: null, break_minutes: Math.round(breakMin * 100) / 100 })
      .eq("id", open.id as string)
      .eq("business_id", businessId);
    if (error) {
      console.error("clockToggleCore out:", error);
      return { error: "Could not clock out." };
    }
    return { action: "out", name, onShift: false, onBreak: false, since: null, onBreakSince: null };
  }

  const { data: created, error } = await supabase
    .from("time_clock_entries")
    .insert({ business_id: businessId, staff_id: staffId, clock_in: now })
    .select("clock_in")
    .single();
  if (error || !created) {
    console.error("clockToggleCore in:", error);
    return { error: "Could not clock in." };
  }
  return { action: "in", name, onShift: true, onBreak: false, since: created.clock_in as string, onBreakSince: null };
}

// Start or end an unpaid break on the staff member's open shift.
export async function breakToggleCore(supabase: Sb, businessId: string, staffId: string): Promise<BreakToggleResult | { error: string }> {
  const name = await staffName(supabase, businessId, staffId);
  const open = await openEntry(supabase, businessId, staffId);
  if (!open) return { error: "Clock in before taking a break." };
  const since = open.clock_in as string;

  if (open.on_break_since) {
    const mins = Math.max(0, (Date.now() - new Date(open.on_break_since as string).getTime()) / 60000);
    const total = Math.round(((Number(open.break_minutes) || 0) + mins) * 100) / 100;
    const { error } = await supabase
      .from("time_clock_entries")
      .update({ on_break_since: null, break_minutes: total })
      .eq("id", open.id as string)
      .eq("business_id", businessId);
    if (error) return { error: "Could not end the break." };
    return { action: "break_end", name, onShift: true, onBreak: false, since, onBreakSince: null };
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("time_clock_entries")
    .update({ on_break_since: nowIso })
    .eq("id", open.id as string)
    .eq("business_id", businessId);
  if (error) return { error: "Could not start the break." };
  return { action: "break_start", name, onShift: true, onBreak: true, since, onBreakSince: nowIso };
}
