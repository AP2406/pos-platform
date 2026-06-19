"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTaxRate, deleteTaxRate } from "./tax-rate-actions";

type Rate = { id: string; name: string; rate: number; jurisdiction?: string | null };

export function TaxRatesCard({ initialRates }: { initialRates: Rate[] }) {
  const [rates, setRates] = useState<Rate[]>(initialRates);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createTaxRate(name.trim(), parseFloat(rate) || 0, jurisdiction.trim() || undefined);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setRates((prev) => [
        ...prev,
        { id: res.id, name: name.trim(), rate: parseFloat(rate) || 0, jurisdiction: jurisdiction.trim() || null },
      ]);
      setName("");
      setRate("");
      setJurisdiction("");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteTaxRate(id);
      if (!("error" in res)) {
        setRates((prev) => prev.filter((r) => r.id !== id));
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Your default rate above applies to most items. Add extra rates here (e.g.
        a 0% zero-rated rate, or GST-only) and assign them to specific items in
        the Catalog. Items can also be marked Tax-free.
      </p>

      {rates.length > 0 && (
        <div className="divide-y divide-border border border-border rounded-md mb-3">
          {rates.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">{"  " + "\u00b7" + "  " + r.rate.toFixed(2) + "%"}</span>
                {r.jurisdiction && <span className="text-muted-foreground">{"  " + "\u00b7" + "  " + r.jurisdiction}</span>}
              </div>
              <button type="button" onClick={() => handleDelete(r.id)} disabled={pending} className="text-xs text-muted-foreground underline hover:text-red-600">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Rate name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="GST 5%" className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rate (%)</Label>
          <Input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" className="h-9 w-24 text-right" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Jurisdiction (optional)</Label>
          <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="Ontario" className="h-9 w-36" />
        </div>
        <Button onClick={handleAdd} disabled={pending || !name.trim()}>
          {pending ? "Saving..." : "Add rate"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}