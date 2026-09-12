"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createModifier,
  deleteModifier,
  createModifierGroup,
  updateModifierGroup,
  deleteModifierGroup,
  setModifierChildGroup,
} from "./actions";
import { describeGroup } from "./item-model";

export type ModOption = { id: string; name: string; price: number; child_group_id: string | null };
export type ModGroup = {
  id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number | null;
  allow_split: boolean;
  options: ModOption[];
};

// P0-2 catalog editor: manage an item's modifier groups (required / min / max)
// and their options. Existing flat add-ons appear as their backfilled "Add-ons"
// group; a brand-new item starts empty until a group is added.
export function ModifierGroupsEditor({ itemId, initial, catalogItems = [] }: { itemId: string; initial: ModGroup[]; catalogItems?: { id: string; name: string; price: number }[] }) {
  const [groups, setGroups] = useState<ModGroup[]>(initial);
  const [newGroup, setNewGroup] = useState("");
  const [optName, setOptName] = useState<Record<string, string>>({});
  const [optPrice, setOptPrice] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function patch(id: string, fields: Partial<ModGroup>) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...fields } : g)));
  }

  function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    setErr(null);
    startTransition(async () => {
      const res = await createModifierGroup(itemId, { name, required: false });
      if ("error" in res) { setErr(res.error); return; }
      setGroups((prev) => [...prev, { id: res.id, name, required: false, min_select: 0, max_select: null, allow_split: false, options: [] }]);
      setNewGroup("");
    });
  }

  function saveGroup(id: string, fields: Partial<ModGroup>) {
    patch(id, fields);
    startTransition(async () => {
      const res = await updateModifierGroup(id, {
        name: fields.name,
        required: fields.required,
        min_select: fields.min_select,
        max_select: fields.max_select,
        allow_split: fields.allow_split,
      });
      // Reflect the server's reconciled range (required⇒min≥1, max≥min) so the inputs
      // don't show an incoherent value the register won't honor.
      if ("ok" in res) patch(id, { required: res.required, min_select: res.min_select, max_select: res.max_select });
    });
  }

  function removeGroup(id: string) {
    setErr(null);
    startTransition(async () => {
      const res = await deleteModifierGroup(id);
      if ("error" in res) { setErr(res.error); return; }
      setGroups((prev) => prev.filter((g) => g.id !== id));
    });
  }

  function addOption(groupId: string) {
    const name = (optName[groupId] || "").trim();
    if (!name) return;
    const price = Math.round((parseFloat(optPrice[groupId] || "0") || 0) * 100) / 100;
    setErr(null);
    startTransition(async () => {
      const res = await createModifier(itemId, name, price, groupId);
      if ("error" in res) { setErr(res.error); return; }
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, options: [...g.options, { id: res.id, name, price, child_group_id: null }] } : g)));
      setOptName((p) => ({ ...p, [groupId]: "" }));
      setOptPrice((p) => ({ ...p, [groupId]: "" }));
    });
  }

  // Add another menu item as a modifier option (copies its name + price). Lets you
  // offer "add a side / add a scoop" from the real menu without retyping.
  function addFromItem(groupId: string, sourceId: string) {
    const src = catalogItems.find((i) => i.id === sourceId);
    if (!src) return;
    setErr(null);
    startTransition(async () => {
      const res = await createModifier(itemId, src.name, src.price, groupId);
      if ("error" in res) { setErr(res.error); return; }
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, options: [...g.options, { id: res.id, name: src.name, price: src.price, child_group_id: null }] } : g)));
    });
  }

  function setChild(groupId: string, optId: string, childId: string | null) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, options: g.options.map((o) => (o.id === optId ? { ...o, child_group_id: childId } : o)) } : g)));
    startTransition(async () => { await setModifierChildGroup(optId, childId); });
  }

  function removeOption(groupId: string, optId: string) {
    startTransition(async () => {
      const res = await deleteModifier(optId);
      if (!("error" in res)) {
        setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optId) } : g)));
      }
    });
  }

  return (
    <div className="space-y-3 border-t border-line-soft pt-4">
      <div>
        <h3 className="text-[13px] font-medium">Modifier groups</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A required &quot;Temperature&quot; (choose 1) or an optional &quot;Add-ons.&quot;
          Mark a group required and set how many a guest must pick; the register
          enforces it.
        </p>
      </div>

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-lg bg-raised p-3 space-y-2 ring-1 ring-line-soft">
            <div className="flex items-center gap-2">
              <Input value={g.name} onChange={(e) => patch(g.id, { name: e.target.value })} onBlur={(e) => saveGroup(g.id, { name: e.target.value })} className="h-8 flex-1" />
              <button type="button" onClick={() => removeGroup(g.id)} disabled={pending} className="text-xs text-muted-foreground underline hover:text-red-600">Remove group</button>
            </div>
            {/* The mockup's "Required · Select 1" line, generated from the real
                required / min_select / max_select columns rather than typed out. */}
            <p className="text-xs text-muted-foreground">{describeGroup(g)}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={g.required} onChange={(e) => saveGroup(g.id, { required: e.target.checked, min_select: e.target.checked ? Math.max(1, g.min_select) : g.min_select })} className="h-4 w-4" />
                Required
              </label>
              <label className="flex items-center gap-1">
                Min
                <Input type="number" min="0" max="50" value={g.min_select} onChange={(e) => patch(g.id, { min_select: parseInt(e.target.value) || 0 })} onBlur={(e) => saveGroup(g.id, { min_select: parseInt(e.target.value) || 0 })} className="h-8 w-16 text-right" />
              </label>
              <label className="flex items-center gap-1">
                Max
                <Input type="number" min="1" max="50" value={g.max_select ?? ""} placeholder="∞" onChange={(e) => patch(g.id, { max_select: e.target.value ? parseInt(e.target.value) : null })} onBlur={(e) => saveGroup(g.id, { max_select: e.target.value ? parseInt(e.target.value) : null })} className="h-8 w-16 text-right" />
              </label>
              <label className="flex items-center gap-1.5" title="Let staff place each choice on the whole item, left half, or right half (pizza-style).">
                <input type="checkbox" checked={g.allow_split} onChange={(e) => saveGroup(g.id, { allow_split: e.target.checked })} className="h-4 w-4" />
                Split ½ L/R
              </label>
            </div>

            {g.required && g.options.length === 0 && (
              <p className="text-xs text-amber-600">
                ⚠ This required group has no options yet — the register skips it until you add at least one, so nothing is actually enforced.
              </p>
            )}

            <div className="space-y-1">
              {g.options.length === 0 ? (
                <p className="text-xs text-muted-foreground">No options yet.</p>
              ) : (
                g.options.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{o.name}<span className="text-muted-foreground">{o.price > 0 ? "  ·  +$" + o.price.toFixed(2) : ""}</span></span>
                    <div className="flex items-center gap-2 shrink-0">
                      <select value={o.child_group_id ?? ""} onChange={(e) => setChild(g.id, o.id, e.target.value || null)} disabled={pending} className="h-7 rounded border border-border bg-transparent text-xs px-1" title="Follow-up group when this is chosen">
                        <option value="">No follow-up</option>
                        {groups.filter((x) => x.id !== g.id).map((x) => (
                          <option key={x.id} value={x.id}>→ {x.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeOption(g.id, o.id)} disabled={pending} className="text-xs text-muted-foreground underline hover:text-red-600">Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Option</Label>
                <Input value={optName[g.id] ?? ""} onChange={(e) => setOptName((p) => ({ ...p, [g.id]: e.target.value }))} placeholder="Medium" className="h-8 w-32" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Adds</Label>
                <Input type="number" min="0" step="0.01" value={optPrice[g.id] ?? ""} onChange={(e) => setOptPrice((p) => ({ ...p, [g.id]: e.target.value }))} placeholder="0.00" className="h-8 w-20 text-right" />
              </div>
              <Button size="sm" onClick={() => addOption(g.id)} disabled={pending || !(optName[g.id] || "").trim()}>Add</Button>
              {catalogItems.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">or add a menu item</Label>
                  <select
                    value=""
                    disabled={pending}
                    onChange={(e) => { if (e.target.value) addFromItem(g.id, e.target.value); e.target.value = ""; }}
                    className="h-8 rounded-md border border-border bg-transparent px-2 text-sm w-40"
                  >
                    <option value="">Pick an item…</option>
                    {catalogItems.filter((i) => i.id !== itemId).map((i) => (
                      <option key={i.id} value={i.id}>{i.name} (${i.price.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">New group</Label>
          <Input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Temperature" className="h-9 w-40" onKeyDown={(e) => { if (e.key === "Enter") addGroup(); }} />
        </div>
        <Button size="sm" onClick={addGroup} disabled={pending || !newGroup.trim()}>Add group</Button>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
    </div>
  );
}
