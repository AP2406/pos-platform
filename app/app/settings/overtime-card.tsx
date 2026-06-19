"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setOvertime } from "./overtime-actions";

export function OvertimeCard({ weeklyHours, multiplier }: { weeklyHours: number; multiplier: number }) {
  const [weekly, setWeekly] = useState(String(weeklyHours));
  const [mult, setMult] = useState(String(multiplier));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await setOvertime({ weeklyHours: parseFloat(weekly) || 0, multiplier: parseFloat(mult) || 0 });
      if ("error" in res) { setErr(res.error); return; }
      setMsg("Saved.");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Hours over the weekly threshold are costed at the multiplier on the Labor report (Ontario ESA default: 44h/week at 1.5×).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Weekly OT threshold (hours)</Label>
          <Input value={weekly} onChange={(e) => setWeekly(e.target.value)} inputMode="numeric" className="h-9 w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">OT multiplier</Label>
          <Input value={mult} onChange={(e) => setMult(e.target.value)} inputMode="decimal" className="h-9 w-28" />
        </div>
        <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
      </div>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </div>
  );
}
