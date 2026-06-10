"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createFloorArea,
  renameFloorArea,
  deleteFloorArea,
  reorderFloorAreas,
  createFloorTable,
  updateFloorTable,
  setFloorTableActive,
  reorderFloorTables,
  type FloorArea,
  type FloorTable,
} from "../floor/floor-actions";

export function FloorCard({
  initialAreas,
  initialTables,
}: {
  initialAreas: FloorArea[];
  initialTables: FloorTable[];
}) {
  const [areas, setAreas] = useState<FloorArea[]>(initialAreas);
  const [tables, setTables] = useState<FloorTable[]>(initialTables);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [newArea, setNewArea] = useState("");
  const [editAreaId, setEditAreaId] = useState<string | null>(null);
  const [editAreaName, setEditAreaName] = useState("");

  const [newLabel, setNewLabel] = useState("");
  const [newSeats, setNewSeats] = useState("2");
  const [newTableArea, setNewTableArea] = useState("");

  const [editTableId, setEditTableId] = useState<string | null>(null);
  const [etLabel, setEtLabel] = useState("");
  const [etSeats, setEtSeats] = useState("2");
  const [etArea, setEtArea] = useState("");

  const areaName = (id: string | null) =>
    id ? areas.find((a) => a.id === id)?.name ?? "Unassigned" : "Unassigned";

  function handleAddArea() {
    setError(null);
    const name = newArea.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createFloorArea(name);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setAreas((prev) => [...prev, res.area]);
      setNewArea("");
    });
  }

  function startEditArea(a: FloorArea) {
    setEditAreaName(a.name);
    setEditAreaId((prev) => (prev === a.id ? null : a.id));
  }

  function handleRenameArea(id: string) {
    setError(null);
    const name = editAreaName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await renameFloorArea(id, name);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, name } : a)));
      setEditAreaId(null);
    });
  }

  function handleDeleteArea(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteFloorArea(id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setAreas((prev) => prev.filter((a) => a.id !== id));
      // Tables in that area become Unassigned (FK on delete set null).
      setTables((prev) =>
        prev.map((t) => (t.area_id === id ? { ...t, area_id: null } : t))
      );
    });
  }

  function moveArea(id: string, dir: -1 | 1) {
    const idx = areas.findIndex((a) => a.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= areas.length) return;
    const reordered = areas.slice();
    const [item] = reordered.splice(idx, 1);
    reordered.splice(next, 0, item);
    setAreas(reordered);
    startTransition(async () => {
      await reorderFloorAreas(reordered.map((a) => a.id));
    });
  }

  function handleAddTable() {
    setError(null);
    const label = newLabel.trim();
    if (!label) return;
    startTransition(async () => {
      const res = await createFloorTable({
        label,
        seats: parseInt(newSeats) || 2,
        area_id: newTableArea || null,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setTables((prev) => [...prev, res.table]);
      setNewLabel("");
      setNewSeats("2");
    });
  }

  function startEditTable(t: FloorTable) {
    setEtLabel(t.label);
    setEtSeats(String(t.seats));
    setEtArea(t.area_id ?? "");
    setEditTableId((prev) => (prev === t.id ? null : t.id));
  }

  function handleSaveTable(id: string) {
    setError(null);
    const label = etLabel.trim();
    if (!label) return;
    startTransition(async () => {
      const res = await updateFloorTable(id, {
        label,
        seats: parseInt(etSeats) || 2,
        area_id: etArea || null,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setTables((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, label, seats: parseInt(etSeats) || 2, area_id: etArea || null }
            : t
        )
      );
      setEditTableId(null);
    });
  }

  function handleToggleTable(t: FloorTable) {
    startTransition(async () => {
      const res = await setFloorTableActive(t.id, !t.is_active);
      if (!("error" in res)) {
        setTables((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, is_active: !x.is_active } : x))
        );
      }
    });
  }

  function moveTable(id: string, dir: -1 | 1) {
    const idx = tables.findIndex((t) => t.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= tables.length) return;
    const reordered = tables.slice();
    const [item] = reordered.splice(idx, 1);
    reordered.splice(next, 0, item);
    setTables(reordered);
    startTransition(async () => {
      await reorderFloorTables(reordered.map((t) => t.id));
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Define your dining areas and the tables in each. Tables show up on the
        register floor so staff can open a ticket per table.
      </p>

      {/* Areas */}
      <h3 className="text-sm font-medium mb-2">Areas</h3>
      {areas.length > 0 && (
        <div className="divide-y divide-border border border-border rounded-md mb-3">
          {areas.map((a, i) => {
            const open = editAreaId === a.id;
            return (
              <div key={a.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{a.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => moveArea(a.id, -1)} disabled={pending || i === 0} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => moveArea(a.id, 1)} disabled={pending || i === areas.length - 1} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => startEditArea(a)} className="text-xs text-muted-foreground underline hover:text-foreground">{open ? "Close" : "Rename"}</button>
                    <button type="button" onClick={() => handleDeleteArea(a.id)} disabled={pending} className="text-xs text-muted-foreground underline hover:text-red-600">Delete</button>
                  </div>
                </div>
                {open && (
                  <div className="mt-2 flex items-end gap-2 border-l-2 border-border pl-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Area name</Label>
                      <Input value={editAreaName} onChange={(e) => setEditAreaName(e.target.value)} className="h-9 w-44" />
                    </div>
                    <Button size="sm" onClick={() => handleRenameArea(a.id)} disabled={pending}>Save</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-end gap-2 mb-6">
        <div className="space-y-1">
          <Label className="text-xs">New area</Label>
          <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Patio" className="h-9 w-44" />
        </div>
        <Button onClick={handleAddArea} disabled={pending || !newArea.trim()}>Add area</Button>
      </div>

      {/* Tables */}
      <h3 className="text-sm font-medium mb-2">Tables</h3>
      {tables.length > 0 && (
        <div className="divide-y divide-border border border-border rounded-md mb-3">
          {tables.map((t, i) => {
            const open = editTableId === t.id;
            return (
              <div key={t.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm min-w-0">
                    <span className={"font-medium " + (t.is_active ? "" : "text-muted-foreground line-through")}>{t.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{t.seats + " seats" + "  ·  " + areaName(t.area_id)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => moveTable(t.id, -1)} disabled={pending || i === 0} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => moveTable(t.id, 1)} disabled={pending || i === tables.length - 1} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => startEditTable(t)} className="text-xs text-muted-foreground underline hover:text-foreground">{open ? "Close" : "Edit"}</button>
                    <button type="button" onClick={() => handleToggleTable(t)} disabled={pending} className="text-xs text-muted-foreground underline hover:text-foreground">{t.is_active ? "Disable" : "Enable"}</button>
                  </div>
                </div>
                {open && (
                  <div className="mt-2 flex flex-wrap items-end gap-2 border-l-2 border-border pl-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input value={etLabel} onChange={(e) => setEtLabel(e.target.value)} className="h-9 w-28" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Seats</Label>
                      <Input type="number" min="1" max="99" value={etSeats} onChange={(e) => setEtSeats(e.target.value)} className="h-9 w-20" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Area</Label>
                      <select value={etArea} onChange={(e) => setEtArea(e.target.value)} className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                        <option value="">Unassigned</option>
                        {areas.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                      </select>
                    </div>
                    <Button size="sm" onClick={() => handleSaveTable(t.id)} disabled={pending}>Save</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">New table</Label>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="T1" className="h-9 w-24" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Seats</Label>
          <Input type="number" min="1" max="99" value={newSeats} onChange={(e) => setNewSeats(e.target.value)} className="h-9 w-20" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Area</Label>
          <select value={newTableArea} onChange={(e) => setNewTableArea(e.target.value)} className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
            <option value="">Unassigned</option>
            {areas.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </div>
        <Button onClick={handleAddTable} disabled={pending || !newLabel.trim()}>Add table</Button>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
