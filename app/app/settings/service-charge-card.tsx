"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setServiceCharge, type ServiceChargeSettings } from "./service-charge-actions";

export function ServiceChargeCard({ initial }: { initial: ServiceChargeSettings }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [pct, setPct] = useState(String(initial.pct || ""));
  const [autoParty, setAutoParty] = useState(String(initial.autoParty || ""));
  const [postTax, setPostTax] = useState(initial.postTax);
  const [label, setLabel] = useState(initial.label || "Service charge");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await setServiceCharge({
        enabled,
        pct: parseFloat(pct) || 0,
        autoParty: parseInt(autoParty) || 0,
        postTax,
        label: label.trim() || "Service charge",
      });
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
        Add an automatic percentage charge (an auto-gratuity) to checks. The amount is calculated on the server when the sale is rung. Servers can waive it with a reason; waiving an automatic charge may require a manager.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
        <span>Enable a service charge</span>
      </label>

      {enabled && (
        <div className="space-y-4 pl-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Percentage</Label>
              <div className="flex items-center gap-1">
                <Input type="number" min="0" max="100" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} className="h-10" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Auto-apply for parties of</Label>
              <Input type="number" min="0" max="999" step="1" value={autoParty} onChange={(e) => setAutoParty(e.target.value)} placeholder="0 = never" className="h-10" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            A party at or above this guest count gets the charge automatically. Leave at 0 to only add it by hand.
          </p>

          <div className="space-y-1">
            <Label className="text-xs">Label on the check &amp; receipt</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Service charge" className="h-10" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Calculated on</Label>
            <div className="flex rounded-md border border-border overflow-hidden text-sm w-fit">
              <button type="button" onClick={() => setPostTax(false)} className={"px-3 py-2 " + (!postTax ? "bg-accent font-medium" : "hover:bg-accent/50")}>Pre-tax</button>
              <button type="button" onClick={() => setPostTax(true)} className={"px-3 py-2 border-l border-border " + (postTax ? "bg-accent font-medium" : "hover:bg-accent/50")}>Post-tax</button>
            </div>
            <p className="text-xs text-muted-foreground">
              Pre-tax applies the percentage to the item subtotal (after any discount or comp). Post-tax applies it after tax. The charge itself is not taxed.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}
