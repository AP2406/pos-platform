"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pushMenu, type PushResult } from "../push-actions";

type Target = { id: string; name: string };
type MenuItem = { id: string; name: string; price: number; category: string | null };

export function PushClient({
  targets,
  items,
  currency,
}: {
  targets: Target[];
  items: MenuItem[];
  currency: string;
}) {
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set(targets.map((t) => t.id)));
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(items.map((i) => i.id)));
  const [overwritePrices, setOverwritePrices] = useState(false);
  const [filter, setFilter] = useState("");
  const [preview, setPreview] = useState<PushResult[] | null>(null);
  const [applied, setApplied] = useState<PushResult[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const fmt = useMemo(
    () => (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n),
    [currency]
  );

  const visibleItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, filter]);

  function toggleTarget(id: string) {
    setPreview(null);
    setApplied(null);
    setSelectedTargets((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleItem(id: string) {
    setPreview(null);
    setApplied(null);
    setSelectedItems((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function run(dryRun: boolean) {
    setErr(null);
    if (selectedTargets.size === 0) { setErr("Pick at least one location."); return; }
    if (selectedItems.size === 0) { setErr("Pick at least one item."); return; }
    startTransition(async () => {
      const res = await pushMenu({
        targetIds: [...selectedTargets],
        itemIds: [...selectedItems],
        overwritePrices,
        dryRun,
      });
      if ("error" in res) { setErr(res.error); return; }
      if (dryRun) { setPreview(res.results); setApplied(null); }
      else { setApplied(res.results); setPreview(null); }
    });
  }

  const allItemsSelected = selectedItems.size === items.length;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Targets */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-medium mb-3">Push to ({selectedTargets.size}/{targets.length})</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {targets.map((t) => (
            <label
              key={t.id}
              className={
                "flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors " +
                (selectedTargets.has(t.id) ? "border-foreground bg-accent" : "border-border hover:border-foreground/40")
              }
            >
              <input
                type="checkbox"
                checked={selectedTargets.has(t.id)}
                onChange={() => toggleTarget(t.id)}
              />
              <span className="text-sm font-medium truncate">{t.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="text-sm font-medium">Items ({selectedItems.size}/{items.length})</h2>
          <div className="flex items-center gap-2">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter"
              className="h-8 w-36"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPreview(null); setApplied(null);
                setSelectedItems(allItemsSelected ? new Set() : new Set(items.map((i) => i.id)));
              }}
            >
              {allItemsSelected ? "Select none" : "Select all"}
            </Button>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {visibleItems.map((it) => (
            <label key={it.id} className="flex items-center gap-2 py-2 cursor-pointer">
              <input type="checkbox" checked={selectedItems.has(it.id)} onChange={() => toggleItem(it.id)} />
              <span className="text-sm flex-1 truncate">{it.name}</span>
              {it.category && <span className="text-xs text-muted-foreground">{it.category}</span>}
              <span className="text-sm tabular-nums text-muted-foreground w-16 text-right">{fmt(it.price)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Options + actions */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={overwritePrices} onChange={(e) => { setOverwritePrices(e.target.checked); setPreview(null); setApplied(null); }} />
          <span className="text-sm">Overwrite prices at the target locations</span>
        </label>
        <p className="text-xs text-muted-foreground">
          {overwritePrices
            ? "Existing items will take this location's prices. New items are created with them."
            : "Existing items keep their own price (per-location override). New items are created with this location's price."}
        </p>

        {err && <p className="text-sm text-red-600">{err}</p>}

        {preview && (
          <div className="rounded-md border border-border p-3 text-sm space-y-1">
            <div className="font-medium mb-1">Preview</div>
            {preview.map((r) => (
              <div key={r.business_id} className="flex justify-between text-muted-foreground">
                <span className="truncate">{r.name}</span>
                <span className="tabular-nums">{r.created} new {"·"} {r.updated} updated</span>
              </div>
            ))}
          </div>
        )}
        {applied && (
          <div className="rounded-md border border-green-200 bg-green-50/40 p-3 text-sm space-y-1">
            <div className="font-medium mb-1 text-green-700">Menu pushed</div>
            {applied.map((r) => (
              <div key={r.business_id} className="flex justify-between text-muted-foreground">
                <span className="truncate">{r.name}</span>
                <span className="tabular-nums">{r.created} added {"·"} {r.updated} updated</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => run(true)} disabled={pending}>
            Preview
          </Button>
          <Button size="sm" onClick={() => run(false)} disabled={pending}>
            Push menu
          </Button>
        </div>
      </div>
    </div>
  );
}
