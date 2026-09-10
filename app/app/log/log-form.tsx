"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addShiftLog, deleteShiftLog } from "./actions";

const CATEGORIES = [
  { key: "note", label: "Note" },
  { key: "incident", label: "Incident" },
  { key: "maintenance", label: "Maintenance" },
  { key: "cash", label: "Cash" },
  { key: "weather", label: "Weather/Events" },
];

export function LogForm({ today }: { today: string }) {
  const [category, setCategory] = useState("note");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(today);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const res = await addShiftLog({ category, body, shiftDate: date });
      if ("error" in res) { setErr(res.error); return; }
      setBody("");
    });
  }

  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-5">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-40 rounded-md border border-border bg-transparent px-2 text-sm">
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" />
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="What happened this shift — handoff notes, incidents, 86s, maintenance, anything the next manager should know."
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-3 mt-2">
        <Button onClick={save} disabled={pending || !body.trim()}>{pending ? "Saving…" : "Add to log"}</Button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}

export function DeleteLogButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => { if (confirm("Delete this entry?")) start(async () => { await deleteShiftLog(id); }); }}
      disabled={pending}
      className="text-[12px] text-muted-foreground underline hover:text-red-600"
    >
      delete
    </button>
  );
}
