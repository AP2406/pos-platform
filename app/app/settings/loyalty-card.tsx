"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveLoyaltySettings, type LoyaltySettings } from "../pos/loyalty-actions";

export function LoyaltyCard({ initial }: { initial: LoyaltySettings }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [earn, setEarn] = useState(String(initial.earnPerDollar));
  const [redeem, setRedeem] = useState(String(initial.redeemPerDollar));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setErr(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveLoyaltySettings({
        enabled,
        earnPerDollar: Number(earn) || 0,
        redeemPerDollar: Number(redeem) || 0,
      });
      if ("error" in res) { setErr(res.error); return; }
      setSaved(true);
    });
  }

  const redeemNum = Number(redeem) || 0;
  const dollarPer100 = redeemNum > 0 ? (100 / redeemNum).toFixed(2) : "0.00";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reward repeat guests with points. Points earn automatically when a sale is rung up for a saved customer, and redeem as a discount at checkout.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} className="h-4 w-4" />
        Enable loyalty
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Points earned per $1 spent</Label>
          <Input value={earn} onChange={(e) => { setEarn(e.target.value); setSaved(false); }} inputMode="decimal" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Points to redeem $1</Label>
          <Input value={redeem} onChange={(e) => { setRedeem(e.target.value); setSaved(false); }} inputMode="numeric" className="h-9" />
          <p className="text-[11px] text-muted-foreground">100 points = ${dollarPer100} off</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>Save</Button>
        {saved && <span className="text-xs text-emerald-600">Saved.</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}
