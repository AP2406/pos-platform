"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setClockEnforcement } from "./clock-actions";

export function ClockEnforcementCard({ enabled: initEnabled = false, graceMin: initGrace = 5 }: { enabled?: boolean; graceMin?: number }) {
  const [enabled, setEnabled] = useState(initEnabled);
  const [grace, setGrace] = useState(String(initGrace));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await setClockEnforcement({ enabled, graceMin: parseInt(grace) || 0 });
      if ("error" in res) { setErr(res.error); return; }
      setMsg("Saved.");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Require staff to be on the schedule to clock in. A clock-in that&apos;s off-schedule — or earlier than the grace window before the shift — is blocked unless a manager enters their PIN to override. A late clock-in is always allowed.
      </p>
      <label className="flex items-start gap-2 text-sm select-none mb-3">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 mt-0.5" />
        <span className="font-medium">Enforce the schedule at clock-in</span>
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Early grace (min)</Label>
          <Input value={grace} onChange={(e) => setGrace(e.target.value)} inputMode="numeric" className="h-9 w-28" />
          <p className="text-[12px] text-muted-foreground">How many minutes early they may clock in.</p>
        </div>
        <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </div>
  );
}
