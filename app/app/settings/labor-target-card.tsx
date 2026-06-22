"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setLaborTarget } from "./labor-target-actions";

export function LaborTargetCard({ enabled: initEnabled = false, targetPct: initTarget = 30 }: { enabled?: boolean; targetPct?: number }) {
  const [enabled, setEnabled] = useState(initEnabled);
  const [target, setTarget] = useState(String(initTarget));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await setLaborTarget({ enabled, targetPct: parseFloat(target) || 0 });
      if ("error" in res) { setErr(res.error); return; }
      setMsg("Saved.");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Get a push the moment today&apos;s labor cost crosses your target percentage of sales — the same way a large void alerts you. Managers with notifications on are pinged once a day.
      </p>
      <label className="flex items-start gap-2 text-sm select-none mb-3">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 mt-0.5" />
        <span className="font-medium">Alert when labor crosses the target</span>
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Target labor %</Label>
          <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" className="h-9 w-28" />
        </div>
        <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </div>
  );
}
