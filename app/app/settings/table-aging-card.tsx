"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setTableAging } from "./table-aging-actions";

export function TableAgingCard({ initial }: { initial: { yellowMin: number; redMin: number } }) {
  const [yellow, setYellow] = useState(String(initial.yellowMin));
  const [red, setRed] = useState(String(initial.redMin));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setMsg(null); setErr(null);
    startTransition(async () => {
      const res = await setTableAging({ yellowMin: parseInt(yellow) || 30, redMin: parseInt(red) || 50 });
      if ("error" in res) { setErr(res.error); return; }
      setMsg("Saved.");
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A seated table turns <span className="text-amber-600">yellow</span> after the first time, then <span className="text-red-600">red</span> — so no table is forgotten. The timer resets when the check is paid.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Yellow after (min)</Label>
          <Input type="number" min="1" max="600" value={yellow} onChange={(e) => setYellow(e.target.value)} className="h-10 w-28" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Red after (min)</Label>
          <Input type="number" min="1" max="600" value={red} onChange={(e) => setRed(e.target.value)} className="h-10 w-28" />
        </div>
        <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}
