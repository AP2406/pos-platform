"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAvailabilityWindow, deleteAvailabilityWindow, type AvailabilityWindow } from "./availability-actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hhmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
function toMin(v: string): number {
  const [h, m] = v.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h)) return 0;
  return Math.max(0, Math.min(1440, h * 60 + (Number.isFinite(m) ? m : 0)));
}
function summarize(w: AvailabilityWindow): string {
  const days = w.days.length === 0 ? "Every day" : w.days.slice().sort().map((d) => DAYS[d]).join(", ");
  return days + " · " + hhmm(w.start_min) + "–" + hhmm(w.end_min);
}

export function AvailabilityCard({
  initialWindows,
  items,
  categories,
  canManage,
}: {
  initialWindows: AvailabilityWindow[];
  items: { id: string; name: string }[];
  categories: string[];
  canManage: boolean;
}) {
  const [windows, setWindows] = useState(initialWindows);
  const [scope, setScope] = useState<"item" | "category">("category");
  const [name, setName] = useState("");
  const [targetItem, setTargetItem] = useState("");
  const [targetCategory, setTargetCategory] = useState(categories[0] ?? "");
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("11:00");
  const [pending, startTr] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }
  function nameOfItem(id: string | null): string {
    return items.find((i) => i.id === id)?.name ?? "item";
  }

  function add() {
    setErr(null);
    startTr(async () => {
      const res = await createAvailabilityWindow({
        name: name.trim() || (scope === "category" ? targetCategory : nameOfItem(targetItem)) + " hours",
        scope,
        target_item_id: scope === "item" ? targetItem || null : null,
        target_category: scope === "category" ? targetCategory || null : null,
        days,
        start_min: toMin(start),
        end_min: toMin(end),
      });
      if ("error" in res) { setErr(res.error); return; }
      setWindows((prev) => [
        ...prev,
        { id: res.id, name: name.trim() || (scope === "category" ? targetCategory : nameOfItem(targetItem)) + " hours", scope, target_item_id: scope === "item" ? targetItem || null : null, target_category: scope === "category" ? targetCategory || null : null, days, start_min: toMin(start), end_min: toMin(end), active: true },
      ]);
      setName("");
    });
  }
  function remove(id: string) {
    startTr(async () => {
      const res = await deleteAvailabilityWindow(id);
      if ("error" in res) { setErr(res.error); return; }
      setWindows((prev) => prev.filter((w) => w.id !== id));
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Restrict an item or category to certain hours (e.g. breakfast 6:00–11:00). Anything without a window stays available all day. Customer menus (kiosk, online, QR) hide off-hours items automatically; the register shows an &ldquo;off hours&rdquo; badge but still lets staff ring it.
      </p>

      {windows.length > 0 && (
        <div className="divide-y divide-border mb-4">
          {windows.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {w.name} <span className="text-muted-foreground">· {w.scope === "category" ? w.target_category : nameOfItem(w.target_item_id)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{summarize(w)}{w.active ? "" : " · off"}</div>
              </div>
              {canManage && (
                <button type="button" onClick={() => remove(w.id)} disabled={pending} className="text-xs text-red-600 underline shrink-0">Remove</button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select value={scope} onChange={(e) => setScope(e.target.value as "item" | "category")} className="h-9 rounded-md border border-border bg-transparent px-2 text-sm">
              <option value="category">Category</option>
              <option value="item">Item</option>
            </select>
            {scope === "category" ? (
              <select value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)} className="h-9 rounded-md border border-border bg-transparent px-2 text-sm min-w-[8rem]">
                {categories.length === 0 && <option value="">No categories</option>}
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <select value={targetItem} onChange={(e) => setTargetItem(e.target.value)} className="h-9 rounded-md border border-border bg-transparent px-2 text-sm min-w-[8rem]">
                <option value="">Pick an item…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Label (e.g. Breakfast)" className="h-9 w-40" />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {DAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => toggleDay(i)} className={"px-2 py-1 rounded-md border text-xs " + (days.includes(i) ? "border-foreground bg-accent" : "border-border")}>{d}</button>
            ))}
            <span className="text-xs text-muted-foreground ml-1">{days.length === 0 ? "every day" : ""}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">From</span>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-32" />
            <span className="text-muted-foreground">to</span>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-32" />
            <Button className="h-9 ml-auto" disabled={pending} onClick={add}>Add window</Button>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
