"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setSplitSettings, type SplitSettings } from "./split-actions";

export function SplitCard({ initial }: { initial: SplitSettings }) {
  const [mode, setMode] = useState<"separate" | "informational">(initial.settlementMode);
  const [allowUnits, setAllowUnits] = useState(initial.allowUnits);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await setSplitSettings({ settlementMode: mode, allowUnits });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setMsg("Saved.");
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Let servers split a check across several guests by item. Sub-checks always add up to the original to the cent.
      </p>

      <div className="space-y-1">
        <Label className="text-xs">How a split is settled</Label>
        <div className="flex rounded-md border border-border overflow-hidden text-sm w-fit">
          <button type="button" onClick={() => setMode("separate")} className={"px-3 py-2 " + (mode === "separate" ? "bg-accent font-medium" : "hover:bg-accent/50")}>Separate payments</button>
          <button type="button" onClick={() => setMode("informational")} className={"px-3 py-2 border-l border-border " + (mode === "informational" ? "bg-accent font-medium" : "hover:bg-accent/50")}>Informational</button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "separate"
            ? "Each guest pays their own sub-check — its own payment and receipt."
            : "Everyone pays together on one receipt that shows each guest's share."}
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={allowUnits} onChange={(e) => setAllowUnits(e.target.checked)} className="h-4 w-4 mt-0.5" />
        <span>
          Allow splitting item quantities &amp; sharing items
          <span className="block text-xs text-muted-foreground">In addition to assigning whole items and an even split, let a server divide a line&apos;s quantity or share one item evenly across guests.</span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}
