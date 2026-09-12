"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addUpsellPrompt, setUpsellActive, deleteUpsellPrompt, type UpsellPrompt } from "./actions";

type Row = UpsellPrompt & { active: boolean };
type Item = { id: string; name: string };

export function UpsellsClient({ prompts, items, categories }: { prompts: Row[]; items: Item[]; categories: string[] }) {
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [scope, setScope] = useState<"item" | "category">("item");
  const [triggerItem, setTriggerItem] = useState(items[0]?.id ?? "");
  const [triggerCat, setTriggerCat] = useState(categories[0] ?? "");
  const [suggest, setSuggest] = useState(items[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [discount, setDiscount] = useState("");

  const itemName = (id: string | null) => items.find((i) => i.id === id)?.name ?? "—";

  function save() {
    setErr(null);
    start(async () => {
      const res = await addUpsellPrompt({
        triggerScope: scope,
        triggerItemId: scope === "item" ? triggerItem : null,
        triggerCategory: scope === "category" ? triggerCat : null,
        suggestItemId: suggest,
        label, comboDiscount: Number(discount) || 0,
      });
      if ("error" in res) { setErr(res.error); return; }
      setAdding(false); setLabel(""); setDiscount("");
    });
  }

  return (
    <div>
      <div className="mb-5">
        {!adding ? (
          <Button onClick={() => { setErr(null); setAdding(true); }}>Add a prompt</Button>
        ) : (
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">When ringing</Label>
                <select value={scope} onChange={(e) => setScope(e.target.value as "item" | "category")} className="h-9 w-28 rounded-md border border-border bg-transparent px-2 text-sm">
                  <option value="item">an item</option>
                  <option value="category">a category</option>
                </select>
              </div>
              {scope === "item" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Trigger item</Label>
                  <select value={triggerItem} onChange={(e) => setTriggerItem(e.target.value)} className="h-9 w-48 rounded-md border border-border bg-transparent px-2 text-sm">
                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Trigger category</Label>
                  <select value={triggerCat} onChange={(e) => setTriggerCat(e.target.value)} className="h-9 w-40 rounded-md border border-border bg-transparent px-2 text-sm">
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Suggest adding</Label>
                <select value={suggest} onChange={(e) => setSuggest(e.target.value)} className="h-9 w-48 rounded-md border border-border bg-transparent px-2 text-sm">
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Combo discount $ <span className="text-muted-foreground">(0 = none)</span></Label>
                <Input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="0.00" className="h-9 w-28" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prompt text <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add fries to make it a combo?" className="h-9 max-w-md" />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={pending || !suggest}>{pending ? "Saving…" : "Save prompt"}</Button>
              <Button variant="outline" onClick={() => setAdding(false)} disabled={pending}>Cancel</Button>
              {err && <span className="text-sm text-red-600">{err}</span>}
            </div>
          </div>
        )}
      </div>

      {prompts.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          No prompts yet. Add one — e.g. after a burger, suggest fries at $1 off — and it pops up at ring-in.
        </div>
      ) : (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl divide-y divide-border overflow-hidden">
          {prompts.map((p) => (
            <div key={p.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {p.triggerScope === "item" ? itemName(p.triggerItemId) : "Any " + p.triggerCategory}
                  <span className="text-muted-foreground font-normal"> → suggest </span>
                  {itemName(p.suggestItemId)}
                  {!p.active && <span className="ml-2 text-[11px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground">off</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {p.label ? "“" + p.label + "”" : "no custom text"}{p.comboDiscount > 0 ? " · $" + p.comboDiscount.toFixed(2) + " combo off" : ""}
                </div>
              </div>
              <div className="flex gap-2 text-[11px] shrink-0">
                <button onClick={() => start(async () => { await setUpsellActive(p.id, !p.active); })} disabled={pending} className="underline text-muted-foreground">{p.active ? "disable" : "enable"}</button>
                <button onClick={() => { if (confirm("Delete this prompt?")) start(async () => { await deleteUpsellPrompt(p.id); }); }} disabled={pending} className="underline text-red-600">delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
