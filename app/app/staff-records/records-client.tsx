"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addWriteup, deleteWriteup } from "./actions";

export type Writeup = {
  id: string;
  staffId: string;
  staffName: string;
  type: string;
  body: string;
  occurredOn: string;
  authorName: string | null;
  createdAt: string;
};
type Staff = { id: string; name: string };

const TYPE_META: Record<string, { label: string; cls: string }> = {
  writeup: { label: "Write-up", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  commendation: { label: "Commendation", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  coaching: { label: "Coaching", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
};

export function RecordsClient({ staff, writeups, today }: { staff: Staff[]; writeups: Writeup[]; today: string }) {
  const [adding, setAdding] = useState(false);
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [type, setType] = useState("writeup");
  const [date, setDate] = useState(today);
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");

  function save() {
    setErr(null);
    start(async () => {
      const res = await addWriteup({ staffId, type, occurredOn: date, body });
      if ("error" in res) { setErr(res.error); return; }
      setBody(""); setAdding(false);
    });
  }

  const fmtDate = (d: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(d + "T00:00:00Z"));
  const shown = filter ? writeups.filter((w) => w.staffId === filter) : writeups;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {!adding && <Button onClick={() => { setErr(null); setAdding(true); }}>Add a record</Button>}
        <div className="ml-auto">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md border border-border bg-transparent px-2 text-sm">
            <option value="">All employees</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {adding && (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-5 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Employee</Label>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="h-9 w-44 rounded-md border border-border bg-transparent px-2 text-sm">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-40 rounded-md border border-border bg-transparent px-2 text-sm">
                <option value="writeup">Write-up</option>
                <option value="commendation">Commendation</option>
                <option value="coaching">Coaching</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" />
            </div>
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Details — what happened, expectations set, follow-up." className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm" />
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={pending || !body.trim() || !staffId}>{pending ? "Saving…" : "Save record"}</Button>
            <Button variant="outline" onClick={() => { setAdding(false); setBody(""); }} disabled={pending}>Cancel</Button>
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          No records yet. Log a write-up, commendation or coaching note above.
        </div>
      ) : (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl divide-y divide-border overflow-hidden">
          {shown.map((w) => {
            const m = TYPE_META[w.type] ?? TYPE_META.writeup;
            return (
              <div key={w.id} className="p-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm">{w.staffName}</span>
                  <span className={"inline-block rounded-full px-2 py-0.5 text-[12px] font-medium " + m.cls}>{m.label}</span>
                  <span className="text-[12px] text-muted-foreground">{fmtDate(w.occurredOn)}{w.authorName ? " · by " + w.authorName : ""}</span>
                  <button onClick={() => { if (confirm("Delete this record?")) start(async () => { await deleteWriteup(w.id); }); }} disabled={pending} className="ml-auto text-[12px] text-muted-foreground underline hover:text-red-600">delete</button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{w.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
