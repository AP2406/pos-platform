"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setAccountingBasis } from "./basis-actions";

export function BasisCard({ basis: init = "accrual" }: { basis?: "accrual" | "cash" }) {
  const [basis, setBasis] = useState<"accrual" | "cash">(init);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(b: "accrual" | "cash") {
    setBasis(b); setMsg(null);
    start(async () => {
      const res = await setAccountingBasis(b);
      if (!("error" in res)) setMsg("Saved.");
    });
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
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </div>
  );
}
