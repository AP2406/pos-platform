"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addPriceWindow, setPriceWindowActive, deletePriceWindow } from "./actions";
import type { PriceWindow } from "@/lib/services/price-windows";

type Win = PriceWindow & { active: boolean };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minToHHMM(m: number): string {
  const h = Math.floor(m / 60), mm = m % 60;
  return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}
function hhmmToMin(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return 0;
  return Math.min(1440, Number(m[1]) * 60 + Number(m[2]));
}

export function PricingClient({ windows, items, categories, currency }: { windows: Win[]; items: { id: string; name: string }[]; categories: string[]; currency: string }) {
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("Happy hour");
  const [scope, setScope] = useState<"item" | "category">("category");
  const [targetItem, setTargetItem] = useState(items[0]?.id ?? "");
  const [targetCat, setTargetCat] = useState(categories[0] ?? "");
  const [days, setDays] = useState<number[]>([]);
  const [startStr, setStartStr] = useState("15:00");
  const [endStr, setEndStr] = useState("18:00");
  const [mode, setMode] = useState<"price" | "percent">("percent");
  const [value, setValue] = useState("20");

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }
  function save() {
    setErr(null);
    start(async () => {
      const res = await addPriceWindow({
        name, scope,
        targetItemId: scope === "item" ? targetItem : null,
        targetCategory: scope === "category" ? targetCat : null,
        days, startMin: hhmmToMin(startStr), endMin: hhmmToMin(endStr),
        mode, value: Number(value) || 0,
      });
      if ("error" in res) { setErr(res.error); return; }
      setAdding(false);
    });
  }

  const itemName = (id: string | null) => items.find((i) => i.id === id)?.name ?? "—";
  const winLabel = (w: Win) => `${w.startMin === w.endMin ? "all day" : minToHHMM(w.startMin) + "–" + minToHHMM(w.endMin)} · ${w.days.length ? w.days.map((d) => DOW[d]).join(" ") : "every day"}`;

  return (
    <div>
      <div className="mb-5">
        {!adding ? (
          <Button onClick={() => { setErr(null); setAdding(true); }}>Add a price window</Button>
        ) : (
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Applies to</Label>
                <select value={scope} onChange={(e) => setScope(e.target.value as "item" | "category")} className="h-9 w-32 rounded-md border border-border bg-transparent px-2 text-sm">
                  <option value="category">Category</option>
                  <option value="item">Item</option>
                </select>
              </div>
              {scope === "category" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <select value={targetCat} onChange={(e) => setTargetCat(e.target.value)} className="h-9 w-40 rounded-md border border-border bg-transparent px-2 text-sm">
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Item</Label>
                  <select value={targetItem} onChange={(e) => setTargetItem(e.target.value)} className="h-9 w-48 rounded-md border border-border bg-transparent px-2 text-sm">
                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Days <span className="text-muted-foreground">(none = every day)</span></Label>
              <div className="flex gap-1">
                {DOW.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)} className={"text-xs rounded-md border px-2 py-1.5 " + (days.includes(i) ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground")}>{d}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="time" value={startStr} onChange={(e) => setStartStr(e.target.value)} className="h-9 w-32" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="time" value={endStr} onChange={(e) => setEndStr(e.target.value)} className="h-9 w-32" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select value={mode} onChange={(e) => setMode(e.target.value as "price" | "percent")} className="h-9 w-36 rounded-md border border-border bg-transparent px-2 text-sm">
                  <option value="percent">% off</option>
                  <option value="price">Set price</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{mode === "percent" ? "Percent off" : "Price ($)"}</Label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="h-9 w-28" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save window"}</Button>
              <Button variant="outline" onClick={() => setAdding(false)} disabled={pending}>Cancel</Button>
              {err && <span className="text-sm text-red-600">{err}</span>}
            </div>
          </div>
        )}
      </div>

      {windows.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          No price windows yet. Add one — e.g. 20% off Drinks from 3–6pm weekdays — and prices switch automatically during the window.
        </div>
      ) : (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl divide-y divide-border overflow-hidden">
          {windows.map((w) => (
            <div key={w.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {w.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{w.scope === "item" ? itemName(w.targetItemId) : w.targetCategory}</span>
                  {!w.active && <span className="ml-2 text-[11px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground">off</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {w.mode === "percent" ? w.value + "% off" : money(w.value)} · {winLabel(w)}
                </div>
              </div>
              <div className="flex gap-2 text-[11px] shrink-0">
                <button onClick={() => start(async () => { await setPriceWindowActive(w.id, !w.active); })} disabled={pending} className="underline text-muted-foreground">{w.active ? "disable" : "enable"}</button>
                <button onClick={() => { if (confirm("Delete this window?")) start(async () => { await deletePriceWindow(w.id); }); }} disabled={pending} className="underline text-red-600">delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
