"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logWaste, deleteWaste } from "./actions";

type Ingredient = { id: string; name: string; unit: string; stock_qty: number; track_stock: boolean };
type WasteRow = {
  id: string;
  ingredient_id: string;
  name: string;
  unit: string;
  quantity: number;
  reason: string;
  note: string | null;
  created_at: string;
};

const REASONS = [
  { value: "spoilage", label: "Spoilage" },
  { value: "prep", label: "Prep / trim" },
  { value: "spill", label: "Spill / drop" },
  { value: "expired", label: "Expired" },
  { value: "other", label: "Other" },
];

export function WasteClient({
  ingredients,
  recent: initialRecent,
  canManage,
}: {
  ingredients: Ingredient[];
  recent: WasteRow[];
  canManage: boolean;
}) {
  const [recent, setRecent] = useState<WasteRow[]>(initialRecent);
  const [ingId, setIngId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("spoilage");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const selected = ingredients.find((i) => i.id === ingId) ?? null;

  function submit() {
    setErr(null);
    setMsg(null);
    if (!ingId) { setErr("Pick an ingredient."); return; }
    const q = parseFloat(qty) || 0;
    if (q <= 0) { setErr("Enter a quantity greater than zero."); return; }
    startTransition(async () => {
      const res = await logWaste({ ingredient_id: ingId, quantity: q, reason, note });
      if ("error" in res) { setErr(res.error); return; }
      const ing = ingredients.find((i) => i.id === ingId);
      setRecent((prev) => [
        {
          id: "tmp-" + Date.now(),
          ingredient_id: ingId,
          name: ing?.name ?? "",
          unit: ing?.unit ?? "unit",
          quantity: q,
          reason,
          note: note.trim() || null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setQty("");
      setNote("");
      setMsg(`Logged. ${ing?.name ?? "Ingredient"} on hand: ${res.new_qty} ${ing?.unit ?? ""}.`);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {canManage && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-sm font-medium mb-4">Log waste</h2>
          {ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ingredients yet. Add them in Recipes &amp; costing first.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Ingredient</Label>
                  <select
                    value={ingId}
                    onChange={(e) => setIngId(e.target.value)}
                    className="h-9 rounded-md border border-border bg-transparent px-2 text-sm w-52"
                  >
                    <option value="">Select…</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}{i.track_stock ? ` (${i.stock_qty} ${i.unit})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantity{selected ? ` (${selected.unit})` : ""}</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="0"
                    className="h-9 w-28 text-right"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reason</Label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                  >
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <Button size="sm" onClick={submit} disabled={pending}>Log waste</Button>
              </div>
              <div className="mt-2">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="h-9 max-w-md"
                />
              </div>
              {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
              {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
            </>
          )}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-medium mb-3">Recent waste ({recent.length})</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No waste logged in this period.</p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((w) => (
              <div key={w.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {w.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      {"·"} {w.quantity} {w.unit}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {REASONS.find((r) => r.value === w.reason)?.label ?? w.reason}
                    {w.note ? ` · ${w.note}` : ""} {"·"} {dateLabel(w.created_at)}
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 shrink-0"
                    disabled={pending}
                    onClick={() => {
                      setErr(null);
                      setMsg(null);
                      startTransition(async () => {
                        const res = await deleteWaste(w.id);
                        if ("error" in res) { setErr(res.error); return; }
                        setRecent((prev) => prev.filter((x) => x.id !== w.id));
                      });
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function dateLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
}
