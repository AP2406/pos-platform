import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { getTodayBoundsUTC } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

// D1: clocked-in vs scheduled board for TODAY. Each scheduled shift is matched
// to the staff member's clock entries and resolved to a live status; no-shows,
// late arrivals and missed punches are flagged at the top.
type Status = "on_time" | "late" | "no_show" | "upcoming" | "done" | "left_early" | "missed_punch";
const STATUS_META: Record<Status, { label: string; cls: string }> = {
  on_time: { label: "On time", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  late: { label: "Late", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-500" },
  no_show: { label: "No-show", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  upcoming: { label: "Not in yet", cls: "bg-muted text-muted-foreground" },
  done: { label: "Done", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  left_early: { label: "Left early", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-500" },
  missed_punch: { label: "Missed punch", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
};
const LATE_MIN = 10;
const EARLY_LEAVE_MIN = 15;

export default async function AttendancePage() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const supabase = await createClient();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const bounds = getTodayBoundsUTC(tz);
  const dayStart = bounds.start.getTime();
  const dayEnd = bounds.end.getTime();
  const now = Date.now();

  const [{ data: staffRows }, { data: shiftRows }, { data: entryRows }] = await Promise.all([
    supabase.from("staff_members").select("id, name").eq("business_id", business.id),
    supabase
      .from("shifts")
      .select("id, staff_id, starts_at, ends_at, role_label, published")
      .eq("business_id", business.id)
      .gte("starts_at", bounds.start.toISOString())
      .lt("starts_at", bounds.end.toISOString())
      .order("starts_at", { ascending: true }),
    // Today's punches plus any still-open entry (to catch overnight / missed clock-outs).
    supabase
      .from("time_clock_entries")
      .select("staff_id, clock_in, clock_out, on_break_since")
      .eq("business_id", business.id)
      .or(`clock_in.gte.${new Date(dayStart - 18 * 3600000).toISOString()},clock_out.is.null`),
  ]);

  const nameById = new Map((staffRows ?? []).map((s) => [s.id as string, (s.name as string) || "Staff"]));
  const entries = (entryRows ?? []).map((e) => ({
    staffId: e.staff_id as string,
    inMs: new Date(e.clock_in as string).getTime(),
    outMs: e.clock_out ? new Date(e.clock_out as string).getTime() : null,
    onBreak: !!e.on_break_since,
  }));
  const fmtT = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(ms));

  type Row = { key: string; name: string; sched: string; role: string | null; status: Status; inAt: number | null; scheduledOnly: boolean };
  const rows: Row[] = [];
  const matchedEntryIdx = new Set<number>();

  for (const sh of shiftRows ?? []) {
    const staffId = sh.staff_id as string | null;
    const st = new Date(sh.starts_at as string).getTime();
    const en = new Date(sh.ends_at as string).getTime();
    const name = staffId ? nameById.get(staffId) ?? "Staff" : "—";
    // Match the clock entry overlapping this shift (±2h tolerance on the start).
    let match: { inMs: number; outMs: number | null; idx: number } | null = null;
    if (staffId) {
      entries.forEach((e, idx) => {
        if (e.staffId !== staffId) return;
        if (e.inMs >= st - 2 * 3600000 && e.inMs <= en + 2 * 3600000) {
          if (!match || Math.abs(e.inMs - st) < Math.abs(match.inMs - st)) match = { inMs: e.inMs, outMs: e.outMs, idx };
        }
      });
    }
    let status: Status;
    let inAt: number | null = null;
    if (match) {
      matchedEntryIdx.add((match as { idx: number }).idx);
      const m = match as { inMs: number; outMs: number | null };
      inAt = m.inMs;
      if (m.outMs == null) {
        // Still on the clock. Missed punch if the shift ended long ago.
        status = now - st > (en - st) + 18 * 3600000 ? "missed_punch" : m.inMs <= st + LATE_MIN * 60000 ? "on_time" : "late";
      } else {
        status = m.outMs < en - EARLY_LEAVE_MIN * 60000 ? "left_early" : "done";
      }
    } else if (now < st + LATE_MIN * 60000) {
      status = "upcoming";
    } else {
      status = "no_show";
    }
    rows.push({ key: sh.id as string, name, sched: fmtT(st) + " – " + fmtT(en), role: (sh.role_label as string | null) ?? null, status, inAt, scheduledOnly: false });
  }

  // Clocked-in but not on today's schedule (open or today's entries unmatched).
  entries.forEach((e, idx) => {
    if (matchedEntryIdx.has(idx)) return;
    if (e.outMs != null && e.outMs < dayStart) return; // ended before today
    if (e.inMs < dayStart - 18 * 3600000) return;
    const open = e.outMs == null;
    const missedPunch = open && now - e.inMs > 16 * 3600000;
    rows.push({
      key: "u" + idx,
      name: nameById.get(e.staffId) ?? "Staff",
      sched: "Unscheduled",
      role: null,
      status: missedPunch ? "missed_punch" : open ? "on_time" : "done",
      inAt: e.inMs,
      scheduledOnly: false,
    });
  });

  const order: Status[] = ["no_show", "missed_punch", "late", "left_early", "on_time", "upcoming", "done"];
  rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (b.inAt ?? 0) - (a.inAt ?? 0));

  const noShow = rows.filter((r) => r.status === "no_show").length;
  const missed = rows.filter((r) => r.status === "missed_punch").length;
  const late = rows.filter((r) => r.status === "late").length;
  const onClock = rows.filter((r) => (r.status === "on_time" || r.status === "late") && r.inAt != null).length;
  const todayLabel = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date(now));

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Today&apos;s schedule vs the clock — {todayLabel}.</p>
        </div>
        <Link href="/app/schedule" className="text-sm text-muted-foreground underline hover:text-foreground shrink-0">Schedule →</Link>
      </div>

      {(noShow > 0 || missed > 0) && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 mb-5 text-sm">
          <span className="font-semibold text-red-700 dark:text-red-400">Needs attention:</span>{" "}
          {noShow > 0 && <span>{noShow} no-show{noShow === 1 ? "" : "s"}</span>}
          {noShow > 0 && missed > 0 && <span> · </span>}
          {missed > 0 && <span>{missed} missed punch{missed === 1 ? "" : "es"} (fix in Labor → Timesheets)</span>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="On the clock" value={String(onClock)} />
        <Stat label="Late" value={String(late)} tone={late > 0 ? "warn" : undefined} />
        <Stat label="No-shows" value={String(noShow)} tone={noShow > 0 ? "bad" : undefined} />
        <Stat label="Scheduled" value={String((shiftRows ?? []).length)} />
      </div>

      {rows.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          No shifts scheduled today and no one clocked in. Build the week in <Link href="/app/schedule" className="underline">Schedule</Link>.
        </div>
      ) : (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Staff</th>
                <th className="px-3 py-2 font-medium">Scheduled</th>
                <th className="px-3 py-2 font-medium">Clocked in</th>
                <th className="px-3 py-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = STATUS_META[r.status];
                return (
                  <tr key={r.key} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{r.name}{r.role && <span className="block text-[11px] text-muted-foreground font-normal">{r.role}</span>}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{r.sched}</td>
                    <td className="px-3 py-2 tabular-nums">{r.inAt != null ? fmtT(r.inAt) : "—"}</td>
                    <td className="px-3 py-2 text-right"><span className={"inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " + m.cls}>{m.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "bad" }) {
  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"text-xl font-semibold tabular-nums mt-0.5 " + (tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "")}>{value}</div>
    </div>
  );
}
