"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setKdsThresholds } from "./kds-actions";

export function KdsCard({ warnMin, lateMin }: { warnMin: number; lateMin: number }) {
  const [warn, setWarn] = useState(String(warnMin));
  const [late, setLate] = useState(String(lateMin));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await setKdsThresholds({ warnMin: parseInt(warn) || 0, lateMin: parseInt(late) || 0 });
      if ("error" in res) { setErr(res.error); return; }
      setMsg("Saved.");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        How long before a kitchen ticket turns amber, then red. An item&apos;s prep-time target (set in the Catalog) still overrides these per ticket.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Amber after (min)</Label>
          <Input value={warn} onChange={(e) => setWarn(e.target.value)} inputMode="numeric" className="h-9 w-28" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Red after (min)</Label>
          <Input value={late} onChange={(e) => setLate(e.target.value)} inputMode="numeric" className="h-9 w-28" />
        </div>
        <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
      </div>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </div>
  );
}
