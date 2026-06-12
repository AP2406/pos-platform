"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSection,
  renameSection,
  setSectionColor,
  deleteSection,
  setElementSection,
  assignSectionServer,
  type Section,
  type AssignableTable,
} from "../pos/sections-actions";

const PALETTE = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#64748b"];

export function SectionsCard({
  initialSections,
  tables,
  staff,
}: {
  initialSections: Section[];
  tables: AssignableTable[];
  staff: { id: string; name: string }[];
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [tableSection, setTableSection] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};
    for (const t of tables) m[t.id] = t.section_id;
    return m;
  });
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function patch(id: string, f: Partial<Section>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...f } : s)));
  }

  function add() {
    const name = newName.trim();
    if (!name) return;
    setErr(null);
    startTransition(async () => {
      const res = await createSection(name);
      if ("error" in res) { setErr(res.error); return; }
      setSections((prev) => [...prev, res.section]);
      setNewName("");
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteSection(id);
      if ("error" in res) { setErr(res.error); return; }
      setSections((prev) => prev.filter((s) => s.id !== id));
      setTableSection((prev) => {
        const m = { ...prev };
        for (const k of Object.keys(m)) if (m[k] === id) m[k] = null;
        return m;
      });
    });
  }
  function rename(id: string, name: string) {
    patch(id, { name });
    startTransition(async () => { await renameSection(id, name); });
  }
  function pickColor(id: string, color: string) {
    patch(id, { color });
    startTransition(async () => { await setSectionColor(id, color); });
  }
  function assignServer(id: string, staffId: string) {
    const s = staff.find((x) => x.id === staffId) ?? null;
    patch(id, { server: s ? { id: s.id, name: s.name } : null });
    startTransition(async () => { await assignSectionServer(id, staffId || null); });
  }
  function toggleTable(tableId: string, sectionId: string) {
    const next = tableSection[tableId] === sectionId ? null : sectionId;
    setTableSection((prev) => ({ ...prev, [tableId]: next }));
    startTransition(async () => { await setElementSection(tableId, next); });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Group tables into sections, give each a color, and assign a server for today&apos;s shift. The live floor tints each table with its section color.
      </p>

      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.id} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: s.color ?? "#64748b" }} />
              <Input value={s.name} onChange={(e) => rename(s.id, e.target.value)} className="h-8 flex-1" />
              <button type="button" onClick={() => remove(s.id)} disabled={pending} className="text-xs text-muted-foreground underline hover:text-red-600">Remove</button>
            </div>
            <div className="flex items-center gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => pickColor(s.id, c)} className={"w-6 h-6 rounded-full border-2 " + (s.color === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} aria-label={"color " + c} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Server today</Label>
              <select value={s.server?.id ?? ""} onChange={(e) => assignServer(s.id, e.target.value)} className="h-8 rounded-md border border-border bg-transparent text-sm px-2 flex-1">
                <option value="">Unassigned</option>
                {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tables.map((t) => {
                const on = tableSection[t.id] === s.id;
                const elsewhere = tableSection[t.id] && tableSection[t.id] !== s.id;
                return (
                  <button key={t.id} type="button" onClick={() => toggleTable(t.id, s.id)} disabled={pending || !!elsewhere} className={"text-xs rounded-md border px-2 py-1 disabled:opacity-30 " + (on ? "border-foreground bg-accent font-medium" : "border-border hover:bg-accent/50")}>{t.label}</button>
                );
              })}
            </div>
          </div>
        ))}
        {sections.length === 0 && <p className="text-xs text-muted-foreground">No sections yet.</p>}
      </div>

      <div className="flex items-center gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a section (e.g. Patio)" className="h-9 flex-1" onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <Button onClick={add} disabled={pending || !newName.trim()}>Add</Button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
