"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addShift, deleteShift, publishWeek } from "./actions";

type Staff = { id: string; name: string; active: boolean };
type Shift = {
  id: string; staffId: string; staffName: string; dayKey: string;
  timeLabel: string; roleLabel: string | null; note: string | null; published: boolean; hours: number;
};
type DayLabel = { key: string; label: string };
type Variance = { id: string; name: string; scheduled: number; actual: number };

export function ScheduleClient({
  staff, shifts, days, variance, monday, prevWeek, nextWeek, startIso, endIso, anyUnpublished,
}: {
  staff: Staff[]; shifts: Shift[]; days: DayLabel[]; variance: Variance[];
  monday: string; prevWeek: string; nextWeek: string; startIso: string; endIso: string; anyUnpublished: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const assignable = staff.filter((s) => s.active);
  const [staffId, setStaffId] = useState(assignable[0]?.id ?? "");
  const [date, setDate] = useState(days[0]?.key ?? monday);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [roleLabel, setRoleLabel] = useState("");

  function refresh() {
    router.refresh();
  }

  function add() {
    setErr(null);
    start(async () => {
      const res = await addShift({ staffId, date, start: from, end: to, roleLabel: roleLabel || undefined });
      if ("error" in res) { setErr(res.error); return; }
      setRoleLabel("");
      refresh();
    });
  }
  function remove(id: string) {
    setErr(null);
    start(async () => {
      const res = await deleteShift(id);
      if ("error" in res) { setErr(res.error); return; }
      refresh();
    });
  }
  function publish() {
    setErr(null);
    start(async () => {
      const res = await publishWeek(startIso, endIso);
      if ("error" in res) { setErr(res.error); return; }
      refresh();
    });
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">Week of {monday}. Add shifts, publish, and compare to actual hours.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={"/app/schedule?week=" + prevWeek} className="text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">←</Link>
          <Link href="/app/schedule" className="text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">This week</Link>
          <Link href={"/app/schedule?week=" + nextWeek} className="text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">→</Link>
          {anyUnpublished && (
            <Button size="sm" onClick={publish} disabled={pending}>Publish week</Button>
          )}
        </div>
      </div>

      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Staff</Label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
              {assignable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Day</Label>
            <select value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
              {days.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-28" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-28" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role (optional)</Label>
            <Input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder="Server" className="h-9 w-28" />
          </div>
          <Button onClick={add} disabled={pending || !staffId}>Add shift</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {days.map((d) => {
          const dayShifts = shifts.filter((s) => s.dayKey === d.key);
          return (
            <div key={d.key} className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{d.label}</div>
              {dayShifts.length === 0 ? (
                <div className="text-xs text-muted-foreground">—</div>
              ) : (
                <div className="space-y-1.5">
                  {dayShifts.map((s) => (
                    <div key={s.id} className="text-sm rounded-md border border-border px-2 py-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium truncate">{s.staffName}</span>
                        <button type="button" onClick={() => remove(s.id)} disabled={pending} className="text-xs text-muted-foreground hover:text-red-600">✕</button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.timeLabel}{s.roleLabel ? " · " + s.roleLabel : ""}
                        {!s.published && <span className="ml-1 text-amber-600">draft</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {variance.length > 0 && (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
            Scheduled vs actual (this week)
          </div>
          <table className="w-full text-sm">
            <tbody>
              {variance.map((v) => {
                const diff = Math.round((v.actual - v.scheduled) * 10) / 10;
                return (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{v.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{v.scheduled.toFixed(1)}h sched</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.actual.toFixed(1)}h actual</td>
                    <td className={"px-3 py-2 text-right tabular-nums " + (Math.abs(diff) >= 2 ? "text-amber-600 font-semibold" : "text-muted-foreground")}>
                      {(diff > 0 ? "+" : "") + diff.toFixed(1)}h
                    </td>
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
