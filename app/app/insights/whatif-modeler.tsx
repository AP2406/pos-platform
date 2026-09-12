"use client";

import { useMemo, useState } from "react";

// C11: break-even + price-elasticity what-if. All client-side math on the
// period figures handed down from the server — no writes, nothing persisted.
type Item = { name: string; units: number; price: number; unitCost: number };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n: number) => "$" + r2(n).toFixed(2);

export function WhatIfModeler({
  periodRevenue,
  periodCogs,
  avgCheck,
  rangeDays,
  items,
}: {
  periodRevenue: number;
  periodCogs: number;
  avgCheck: number;
  rangeDays: number;
  items: Item[];
}) {
  // Contribution-margin ratio from this period: variable cost = food (COGS).
  const cmRatio = periodRevenue > 0 ? Math.max(0, 1 - periodCogs / periodRevenue) : 0;

  // --- Break-even ---
  const [fixed, setFixed] = useState(""); // fixed costs for the period (rent, labor, etc.)
  const fixedNum = Math.max(0, Number(fixed) || 0);
  const beSales = cmRatio > 0 ? fixedNum / cmRatio : 0;
  const beCoversPerDay = avgCheck > 0 && rangeDays > 0 ? beSales / avgCheck / rangeDays : 0;
  const beDailySales = rangeDays > 0 ? beSales / rangeDays : 0;
  const headroom = periodRevenue - beSales;

  // --- Price elasticity ---
  const [itemName, setItemName] = useState(items[0]?.name ?? "");
  const [newPriceStr, setNewPriceStr] = useState(items[0] ? String(items[0].price) : "");
  const [elasticity, setElasticity] = useState("-1.0");
  const item = items.find((i) => i.name === itemName) ?? items[0];

  const sim = useMemo(() => {
    if (!item) return null;
    const newPrice = Math.max(0, Number(newPriceStr) || 0);
    const e = Number(elasticity); // typically negative
    const pctPrice = item.price > 0 ? (newPrice - item.price) / item.price : 0;
    const unitFactor = Math.max(0, 1 + e * pctPrice); // demand response
    const newUnits = item.units * unitFactor;
    const oldContrib = item.units * (item.price - item.unitCost);
    const newContrib = newUnits * (newPrice - item.unitCost);
    return {
      newPrice,
      pctPrice,
      newUnits,
      oldContrib: r2(oldContrib),
      newContrib: r2(newContrib),
      delta: r2(newContrib - oldContrib),
      oldRev: r2(item.units * item.price),
      newRev: r2(newUnits * newPrice),
    };
  }, [item, newPriceStr, elasticity]);

  function pickItem(name: string) {
    setItemName(name);
    const it = items.find((i) => i.name === name);
    if (it) setNewPriceStr(String(it.price));
  }

  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-4">
      <h2 className="font-semibold mb-1 text-sm">Break-even &amp; price what-if</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Based on this period&apos;s sales. Contribution margin is {Math.round(cmRatio * 1000) / 10}% (after food cost).
        Nothing here is saved.
      </p>

      {cmRatio <= 0 ? (
        <p className="text-xs text-muted-foreground">Add recipes so food cost is known — then break-even and margin math becomes meaningful.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Break-even */}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Break-even</div>
            <label className="block text-xs text-muted-foreground mb-1">Fixed costs for these {rangeDays} day{rangeDays === 1 ? "" : "s"} (rent, labor, utilities…)</label>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                value={fixed}
                onChange={(e) => setFixed(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="h-9 w-40 rounded-md border border-border bg-transparent px-2 text-sm"
              />
            </div>
            {fixedNum > 0 ? (
              <div className="space-y-1.5 text-sm">
                <Row label="Break-even sales" value={money(beSales)} />
                <Row label="Per day" value={money(beDailySales)} />
                {avgCheck > 0 && <Row label="Break-even covers / day" value={Math.ceil(beCoversPerDay).toLocaleString()} hint={"at " + money(avgCheck) + " avg check"} />}
                <Row label={headroom >= 0 ? "Above break-even" : "Below break-even"} value={money(Math.abs(headroom))} tone={headroom >= 0 ? "good" : "bad"} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Enter your fixed costs to see the break-even sales and covers.</p>
            )}
          </div>

          {/* Price elasticity */}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Price change simulator</div>
            {!item ? (
              <p className="text-xs text-muted-foreground">No costed items in this range to simulate.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-2">
                  <select value={itemName} onChange={(e) => pickItem(e.target.value)} className="h-9 flex-1 min-w-[140px] rounded-md border border-border bg-transparent px-2 text-sm">
                    {items.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    New price $
                    <input value={newPriceStr} onChange={(e) => setNewPriceStr(e.target.value)} inputMode="decimal" className="h-8 w-20 rounded-md border border-border bg-transparent px-2 text-sm" />
                  </label>
                  <label className="text-xs text-muted-foreground flex items-center gap-1" title="How much demand moves per 1% price change. −1 = proportional; closer to 0 = less sensitive.">
                    Elasticity
                    <input value={elasticity} onChange={(e) => setElasticity(e.target.value)} inputMode="decimal" className="h-8 w-16 rounded-md border border-border bg-transparent px-2 text-sm" />
                  </label>
                </div>
                {sim && (
                  <div className="space-y-1.5 text-sm">
                    <Row label="Price" value={money(item.price) + " → " + money(sim.newPrice)} hint={(sim.pctPrice >= 0 ? "+" : "") + Math.round(sim.pctPrice * 1000) / 10 + "%"} />
                    <Row label="Est. units" value={Math.round(item.units).toLocaleString() + " → " + Math.round(sim.newUnits).toLocaleString()} />
                    <Row label="Contribution" value={money(sim.oldContrib) + " → " + money(sim.newContrib)} />
                    <Row label="Net change" value={(sim.delta >= 0 ? "+" : "−") + money(Math.abs(sim.delta))} tone={sim.delta >= 0 ? "good" : "bad"} />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  Estimate only — real demand response varies. Units move by elasticity × price change.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={"tabular-nums font-medium " + (tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "")}>
        {value}
        {hint && <span className="ml-1 text-[11px] text-muted-foreground font-normal">{hint}</span>}
      </span>
    </div>
  );
}
