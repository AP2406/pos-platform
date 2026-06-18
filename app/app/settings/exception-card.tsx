"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setExceptionThresholds } from "./exception-actions";

export function ExceptionCard({
  voidPct,
  compPct,
  discountPct,
  refundPct,
  alertVoidAmount,
}: {
  voidPct: number;
  compPct: number;
  discountPct: number;
  refundPct: number;
  alertVoidAmount: number;
}) {
  const [vd, setVd] = useState(String(voidPct));
  const [cp, setCp] = useState(String(compPct));
  const [ds, setDs] = useState(String(discountPct));
  const [rf, setRf] = useState(String(refundPct));
  const [al, setAl] = useState(String(alertVoidAmount));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await setExceptionThresholds({
        voidPct: Number(vd) || 0,
        compPct: Number(cp) || 0,
        discountPct: Number(ds) || 0,
        refundPct: Number(rf) || 0,
        alertVoidAmount: Number(al) || 0,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setMsg("Saved.");
    });
  }

  const field = (label: string, val: string, set: (v: string) => void, suffix: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input type="number" min="0" value={val} onChange={(e) => set(e.target.value)} className="h-9 w-20" />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        When an employee&apos;s voids/comps/discounts/refunds exceed these shares of
        their own sales, they&apos;re flagged on the Exceptions report. A void over the
        alert amount pushes a notification to managers.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {field("Void rate", vd, setVd, "%")}
        {field("Comp rate", cp, setCp, "%")}
        {field("Discount rate", ds, setDs, "%")}
        {field("Refund rate", rf, setRf, "%")}
        {field("Alert on void over", al, setAl, "$")}
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </div>
  );
}
