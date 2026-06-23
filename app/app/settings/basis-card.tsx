"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAccountingBasis, setLegalEntity } from "./basis-actions";

export function BasisCard({ basis: init = "accrual", legalEntity: initEntity = "" }: { basis?: "accrual" | "cash"; legalEntity?: string }) {
  const [basis, setBasis] = useState<"accrual" | "cash">(init);
  const [entity, setEntity] = useState(initEntity);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(b: "accrual" | "cash") {
    setBasis(b); setMsg(null);
    start(async () => {
      const res = await setAccountingBasis(b);
      if (!("error" in res)) setMsg("Saved.");
    });
  }
  function saveEntity() {
    setMsg(null);
    start(async () => { const res = await setLegalEntity(entity); if (!("error" in res)) setMsg("Saved."); });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        How the income statement and GST/HST input tax credits recognize expenses. <span className="font-medium">Accrual</span> counts a vendor bill on its invoice date; <span className="font-medium">cash</span> counts it when it&apos;s paid.
      </p>
      <div className="flex gap-2">
        {(["accrual", "cash"] as const).map((b) => (
          <button key={b} type="button" onClick={() => save(b)} disabled={pending} className={"text-sm rounded-md border px-3 py-2 capitalize " + (basis === b ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}>
            {b}
          </button>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border space-y-1">
        <Label className="text-xs">Legal entity name <span className="text-muted-foreground">(for consolidated books)</span></Label>
        <div className="flex gap-2">
          <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="e.g. 123456 Ontario Inc." className="h-9 max-w-xs" />
          <Button variant="outline" onClick={saveEntity} disabled={pending} className="h-9">Save</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Locations sharing a legal-entity name roll up together in Accounting → Consolidated.</p>
      </div>
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </div>
  );
}
