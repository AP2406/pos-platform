"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTaxAndCurrency } from "./actions";

const CURRENCIES = ["CAD", "USD"];

export function TaxCurrencyForm({ initialTaxPercent, initialCurrency }: { initialTaxPercent: number; initialCurrency: string }) {
  const [tax, setTax] = useState(String(initialTaxPercent));
  const [currency, setCurrency] = useState(initialCurrency);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const curOptions = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];

  function save() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const res = await updateTaxAndCurrency({ tax_percent: parseFloat(tax) || 0, currency });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setMsg("Saved.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="tax-rate" className="text-xs">Sales tax (%)</Label>
          <Input id="tax-rate" type="number" min="0" max="100" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="currency" className="text-xs">Currency</Label>
          <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm">
            {curOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Applied to point-of-sale checkout totals.</p>
      <div>
        <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
      </div>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}