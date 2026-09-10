"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { editTimeEntry, type TimeEntry } from "../clock/time-actions";

// ISO -> "YYYY-MM-DDTHH:mm" in the browser's local time (≈ the business tz), for
// a datetime-local input. On save the local string is parsed back to UTC.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}
function hoursOf(e: TimeEntry): number {
  if (!e.clockOut) return 0;
  const ms = new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime();
  return Math.max(0, ms / 3600000 - e.breakMinutes / 60);
}
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function timeLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function TimesheetEditor({ entries }: { entries: TimeEntry[] }) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [cin, setCin] = useState("");
  const [cout, setCout] = useState("");
  const [brk, setBrk] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(e: TimeEntry) {
    setEditId(e.id);
    setCin(toLocalInput(e.clockIn));
    setCout(toLocalInput(e.clockOut));
    setBrk(String(e.breakMinutes || 0));
    setNote(e.note ?? "");
    setErr(null);
  }
  function save() {
    setErr(null);
    start(async () => {
      const res = await editTimeEntry({
        entryId: editId!,
        clockIn: cin,
        clockOut: cout || null,
        breakMinutes: parseFloat(brk) || 0,
        note,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setEditId(null);
      router.refresh();
    });
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No time entries in the last two weeks.</p>;
  }

  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-3 py-2 font-medium">In</th>
              <th className="px-3 py-2 font-medium">Out</th>
              <th className="px-3 py-2 font-medium text-right">Break</th>
              <th className="px-3 py-2 font-medium text-right">Hours</th>
              <th className="px-3 py-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <Fragment key={e.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">
                    {e.name}
                    {e.missedPunch && <span className="ml-2 text-[11px] text-red-600 font-semibold">MISSED PUNCH</span>}
                    {e.edited && <span className="ml-2 text-[11px] text-muted-foreground">edited</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{dayLabel(e.clockIn)}</td>
                  <td className="px-3 py-2 tabular-nums">{timeLabel(e.clockIn)}</td>
                  <td className="px-3 py-2 tabular-nums">{timeLabel(e.clockOut)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.breakMinutes > 0 ? Math.round(e.breakMinutes) + "m" : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.clockOut ? hoursOf(e).toFixed(2) : "open"}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => (editId === e.id ? setEditId(null) : open(e))} className="text-xs underline text-muted-foreground hover:text-foreground">
                      {editId === e.id ? "Close" : "Edit"}
                    </button>
                  </td>
                </tr>
                {editId === e.id && (
                  <tr className="border-b border-border bg-muted/30">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-xs space-y-1">
                          <span className="block text-muted-foreground">Clock in</span>
                          <Input type="datetime-local" value={cin} onChange={(ev) => setCin(ev.target.value)} className="h-9" />
                        </label>
                        <label className="text-xs space-y-1">
                          <span className="block text-muted-foreground">Clock out</span>
                          <Input type="datetime-local" value={cout} onChange={(ev) => setCout(ev.target.value)} className="h-9" />
                        </label>
                        <label className="text-xs space-y-1">
                          <span className="block text-muted-foreground">Break (min)</span>
                          <Input type="number" min="0" value={brk} onChange={(ev) => setBrk(ev.target.value)} className="h-9 w-24" />
                        </label>
                        <label className="text-xs space-y-1 flex-1 min-w-[10rem]">
                          <span className="block text-muted-foreground">Reason / note</span>
                          <Input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Forgot to clock out" className="h-9" />
                        </label>
                        <Button onClick={save} disabled={pending} className="h-9">{pending ? "Saving…" : "Save"}</Button>
                      </div>
                      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
