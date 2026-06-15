"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listFloor,
  saveFloorLayout,
  createFloorPlan,
  renameFloorPlan,
  deleteFloorPlan,
  type FloorElement,
  type FloorPlan,
  type ElementKind,
} from "../floor/floor-actions";
import { setFloorChairMode } from "./floor-chair-actions";
import { chairPositions, CHAIR_SIZE } from "../pos/floor-style";

const GRID = 20;

type El = {
  id: string;
  kind: ElementKind;
  label: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  shape: "rect" | "round";
  parent_id: string | null;
  seat_no: number | null;
};

type PaletteItem = { kind: ElementKind; label: string; shape: "rect" | "round"; w: number; h: number; seats?: boolean };
const PALETTE: PaletteItem[] = [
  { kind: "table", label: "Table", shape: "rect", w: 80, h: 80, seats: true },
  { kind: "table", label: "Round table", shape: "round", w: 84, h: 84, seats: true },
  { kind: "booth", label: "Booth", shape: "rect", w: 150, h: 72, seats: true },
  { kind: "counter", label: "Counter", shape: "rect", w: 220, h: 40 },
  { kind: "station", label: "Station", shape: "rect", w: 60, h: 60 },
  { kind: "wall", label: "Wall", shape: "rect", w: 180, h: 10 },
  { kind: "room", label: "Room", shape: "rect", w: 280, h: 200 },
  { kind: "label", label: "Text", shape: "rect", w: 120, h: 24 },
];

const NAMEABLE: ElementKind[] = ["table", "booth", "counter", "station", "room", "label"];
const SEATABLE: ElementKind[] = ["table", "booth"];

function snap(v: number) {
  return Math.round(v / GRID) * GRID;
}

function classesFor(kind: ElementKind, selected: boolean): string {
  const ring = selected ? " ring-2 ring-blue-500 ring-offset-1 ring-offset-zinc-100" : "";
  switch (kind) {
    case "table":
    case "booth":
      return "bg-white border border-zinc-300 text-zinc-800 shadow-sm" + ring;
    case "counter":
      return "bg-white border border-zinc-300 text-zinc-700 shadow-sm" + ring;
    case "station":
      return "bg-sky-50 border border-sky-300 text-sky-800" + ring;
    case "seat":
      return "bg-zinc-200 border border-zinc-400" + ring;
    case "wall":
      return "bg-zinc-500" + ring;
    case "room":
      return "bg-zinc-200/40 border-2 border-dashed border-zinc-400 text-zinc-500" + ring;
    case "label":
      return "bg-transparent text-zinc-700" + ring;
    default:
      return "bg-white border border-zinc-300" + ring;
  }
}

function zFor(kind: ElementKind): number {
  if (kind === "room") return 0;
  if (kind === "wall") return 1;
  if (kind === "seat") return 2;
  if (kind === "label") return 4;
  return 3;
}

export function FloorCard({
  initialPlans,
  initialElements,
  initialChairMode,
}: {
  initialPlans: FloorPlan[];
  initialElements: FloorElement[];
  initialChairMode: "follow" | "editable";
}) {
  const toEl = (e: FloorElement): El => ({
    id: e.id, kind: e.kind, label: e.label, x: e.x, y: e.y, w: e.w, h: e.h,
    rotation: e.rotation, shape: e.shape, parent_id: e.parent_id, seat_no: e.seat_no,
  });

  const [plans, setPlans] = useState<FloorPlan[]>(initialPlans);
  const [activePlan, setActivePlan] = useState<string>(initialPlans[0]?.id ?? "");
  const [els, setEls] = useState<El[]>(() => initialElements.map(toEl));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const [chairMode, setChairMode] = useState<"follow" | "editable">(initialChairMode);

  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [seatPrompt, setSeatPrompt] = useState<PaletteItem | null>(null);
  const [seatN, setSeatN] = useState("4");

  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | { mode: "move" | "resize"; id: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; kids: { id: string; ox: number; oy: number }[] }
    | null
  >(null);

  const selected = els.find((e) => e.id === selectedId) || null;

  let canvasW = 700;
  let canvasH = 460;
  for (const e of els) {
    canvasW = Math.max(canvasW, e.x + e.w + 60);
    canvasH = Math.max(canvasH, e.y + e.h + 60);
  }

  function seatsOf(tableId: string): number {
    return els.filter((e) => e.kind === "seat" && e.parent_id === tableId).length;
  }

  // ---- plans -------------------------------------------------------------
  async function persist(planId: string, elements: El[]): Promise<boolean> {
    const res = await saveFloorLayout(
      planId,
      elements.map((e, i) => ({
        id: e.id, kind: e.kind, label: e.label, x: e.x, y: e.y, w: e.w, h: e.h,
        rotation: e.rotation, shape: e.shape, parent_id: e.parent_id, seat_no: e.seat_no, sort_order: i,
      }))
    );
    if ("error" in res) {
      setError(res.error);
      return false;
    }
    return true;
  }

  function switchPlan(id: string) {
    if (id === activePlan) return;
    setError(null);
    startBusy(async () => {
      if (dirty) {
        const ok = await persist(activePlan, els);
        if (!ok) return;
      }
      const { elements } = await listFloor(id);
      setEls(elements.map(toEl));
      setActivePlan(id);
      setSelectedId(null);
      setDirty(false);
    });
  }

  function handleAddPlan() {
    const name = planName.trim();
    if (!name) return;
    setError(null);
    startBusy(async () => {
      if (dirty) await persist(activePlan, els);
      const res = await createFloorPlan(name);
      if ("error" in res) { setError(res.error); return; }
      setPlans((p) => [...p, res.plan]);
      setEls([]);
      setActivePlan(res.plan.id);
      setSelectedId(null);
      setDirty(false);
      setNewPlanOpen(false);
      setPlanName("");
    });
  }

  function handleRenamePlan() {
    const cur = plans.find((p) => p.id === activePlan);
    if (!cur) return;
    const name = window.prompt("Rename floor", cur.name);
    if (!name || !name.trim()) return;
    startBusy(async () => {
      const res = await renameFloorPlan(activePlan, name.trim());
      if ("error" in res) { setError(res.error); return; }
      setPlans((p) => p.map((x) => (x.id === activePlan ? { ...x, name: name.trim() } : x)));
    });
  }

  function handleDeletePlan() {
    if (plans.length <= 1) { setError("Keep at least one floor."); return; }
    if (!window.confirm("Delete this floor and everything on it?")) return;
    startBusy(async () => {
      const res = await deleteFloorPlan(activePlan);
      if ("error" in res) { setError(res.error); return; }
      const remaining = plans.filter((p) => p.id !== activePlan);
      setPlans(remaining);
      const next = remaining[0].id;
      const { elements } = await listFloor(next);
      setEls(elements.map(toEl));
      setActivePlan(next);
      setSelectedId(null);
      setDirty(false);
    });
  }

  // ---- elements ----------------------------------------------------------
  function nextTableName(): string {
    let max = 0;
    for (const e of els) {
      if (e.kind === "table" && e.label) {
        const m = /^Table\s+(\d+)$/i.exec(e.label.trim());
        if (m) max = Math.max(max, parseInt(m[1]));
      }
    }
    return "Table " + (max + 1);
  }

  function addPaletteItem(p: PaletteItem) {
    if (p.seats) {
      setSeatN("4");
      setSeatPrompt(p);
      return;
    }
    addElement(p, 0);
  }

  function addElement(p: PaletteItem, seats: number) {
    const id = crypto.randomUUID();
    const offset = (els.length % 6) * GRID;
    const table: El = {
      id,
      kind: p.kind,
      label: p.kind === "table" ? nextTableName() : NAMEABLE.includes(p.kind) ? "" : null,
      x: snap(60 + offset),
      y: snap(80 + offset),
      w: p.w, h: p.h, rotation: 0, shape: p.shape, parent_id: null, seat_no: null,
    };
    const chairs: El[] = chairPositions(table, seats).map((pos, i) => ({
      id: crypto.randomUUID(), kind: "seat", label: null, x: pos.x, y: pos.y,
      w: CHAIR_SIZE, h: CHAIR_SIZE, rotation: 0, shape: "round" as const, parent_id: id, seat_no: i + 1,
    }));
    setEls((prev) => [...prev, table, ...chairs]);
    setSelectedId(id);
    setDirty(true);
    setSeatPrompt(null);
  }

  // Rebuild a table's chairs for a new seat count (or after a resize).
  function regenChairs(tableId: string, seats: number) {
    setEls((prev) => {
      const table = prev.find((e) => e.id === tableId);
      if (!table) return prev;
      const without = prev.filter((e) => !(e.kind === "seat" && e.parent_id === tableId));
      const chairs: El[] = chairPositions(table, seats).map((pos, i) => ({
        id: crypto.randomUUID(), kind: "seat" as const, label: null, x: pos.x, y: pos.y,
        w: CHAIR_SIZE, h: CHAIR_SIZE, rotation: 0, shape: "round" as const, parent_id: tableId, seat_no: i + 1,
      }));
      return [...without, ...chairs];
    });
    setDirty(true);
  }

  function updateSelected(patch: Partial<El>) {
    if (!selectedId) return;
    setEls((prev) => prev.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)));
    setDirty(true);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setEls((prev) => prev.filter((e) => e.id !== selectedId && e.parent_id !== selectedId));
    setSelectedId(null);
    setDirty(true);
  }

  function onElementPointerDown(e: React.PointerEvent, el: El, mode: "move" | "resize") {
    e.stopPropagation();
    setSelectedId(el.id);
    canvasRef.current?.setPointerCapture(e.pointerId);
    const kids = els.filter((c) => c.parent_id === el.id).map((c) => ({ id: c.id, ox: c.x, oy: c.y }));
    drag.current = { mode, id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h, kids };
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    setEls((prev) =>
      prev.map((el) => {
        if (el.id === d.id) {
          if (d.mode === "move") return { ...el, x: Math.max(0, snap(d.ox + dx)), y: Math.max(0, snap(d.oy + dy)) };
          return { ...el, w: Math.max(GRID, snap(d.ow + dx)), h: Math.max(GRID, snap(d.oh + dy)) };
        }
        // Move child chairs with their table.
        if (d.mode === "move") {
          const kid = d.kids.find((k) => k.id === el.id);
          if (kid) return { ...el, x: Math.max(0, snap(kid.ox + dx)), y: Math.max(0, snap(kid.oy + dy)) };
        }
        return el;
      })
    );
  }

  function onCanvasPointerUp() {
    const d = drag.current;
    if (d) {
      // Re-fit chairs after resizing a seated element.
      if (d.mode === "resize") {
        const el = els.find((x) => x.id === d.id);
        if (el && SEATABLE.includes(el.kind)) {
          const n = seatsOf(el.id);
          if (n > 0) regenChairs(el.id, n);
        }
      }
      drag.current = null;
      setDirty(true);
    }
  }

  function handleSave() {
    setError(null);
    startSave(async () => {
      const ok = await persist(activePlan, els);
      if (ok) setDirty(false);
    });
  }

  function changeChairMode(mode: "follow" | "editable") {
    setChairMode(mode);
    startBusy(async () => {
      await setFloorChairMode(mode);
    });
  }

  const selectedSeats = selected && SEATABLE.includes(selected.kind) ? seatsOf(selected.id) : 0;

  return (
    <div>
      {/* Plan tabs */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => switchPlan(p.id)}
            disabled={busy}
            className={"text-sm rounded-md px-3 py-1.5 border transition-colors " + (p.id === activePlan ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}
          >
            {p.name}
          </button>
        ))}
        <button type="button" onClick={() => { setPlanName(""); setNewPlanOpen(true); }} disabled={busy} className="text-sm rounded-md px-2.5 py-1.5 border border-dashed border-border text-muted-foreground hover:bg-accent/50">+ Floor</button>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={handleRenamePlan} disabled={busy} className="text-xs text-muted-foreground underline hover:text-foreground">Rename</button>
          <button type="button" onClick={handleDeletePlan} disabled={busy || plans.length <= 1} className="text-xs text-muted-foreground underline hover:text-red-600 disabled:opacity-40">Delete floor</button>
        </div>
      </div>

      {newPlanOpen && (
        <div className="flex items-end gap-2 mb-3">
          <div className="space-y-1">
            <Label className="text-xs">New floor name</Label>
            <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Patio" className="h-9 w-44" />
          </div>
          <Button size="sm" onClick={handleAddPlan} disabled={busy || !planName.trim()}>Add</Button>
          <button type="button" onClick={() => setNewPlanOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-3">
        Design this floor: drag to position and resize. Adding a table asks for
        its seats and draws the chairs automatically. Table names auto-number and
        must be unique on a floor.
      </p>

      {/* Palette */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PALETTE.map((p) => (
          <button key={p.kind + p.shape} type="button" onClick={() => addPaletteItem(p)} className="text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">
            {"+ " + p.label}
          </button>
        ))}
      </div>

      {/* Selected-element panel */}
      {selected && (
        <div className="flex flex-wrap items-end gap-2 mb-3 p-3 rounded-md border border-border bg-card">
          <span className="text-xs text-muted-foreground self-center capitalize">{selected.kind}</span>
          {NAMEABLE.includes(selected.kind) && (
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={selected.label ?? ""} onChange={(e) => updateSelected({ label: e.target.value })} placeholder={selected.kind === "table" ? "Table 1" : "Name"} className="h-9 w-36" />
            </div>
          )}
          {SEATABLE.includes(selected.kind) && (
            <div className="space-y-1">
              <Label className="text-xs">Seats</Label>
              <Input type="number" min="0" max="20" value={selectedSeats} onChange={(e) => regenChairs(selected.id, Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))} className="h-9 w-20" />
            </div>
          )}
          {selected.kind === "table" && (
            <Button size="sm" variant="outline" onClick={() => updateSelected({ shape: selected.shape === "round" ? "rect" : "round" })}>
              {selected.shape === "round" ? "Make square" : "Make round"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => updateSelected({ rotation: (selected.rotation + 15) % 360 })}>Rotate</Button>
          <Button size="sm" variant="outline" className="text-red-600" onClick={deleteSelected}>Delete</Button>
        </div>
      )}

      {/* Canvas (light blueprint) */}
      <div className="overflow-auto rounded-lg border border-zinc-300" style={{ maxHeight: 520, background: "#f4f4f5" }}>
        <div
          ref={canvasRef}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerDown={() => setSelectedId(null)}
          className="relative"
          style={{
            width: canvasW,
            height: canvasH,
            minWidth: "100%",
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
            backgroundSize: GRID + "px " + GRID + "px",
            touchAction: "none",
          }}
        >
          {[...els].sort((a, b) => zFor(a.kind) - zFor(b.kind)).map((el) => {
            const isSel = el.id === selectedId;
            const isChair = el.kind === "seat";
            const interactive = !isChair || chairMode === "editable";
            return (
              <div
                key={el.id}
                onPointerDown={interactive ? (e) => onElementPointerDown(e, el, "move") : undefined}
                className={"absolute flex items-center justify-center text-[10px] font-medium select-none overflow-hidden " + (interactive ? "cursor-move " : "pointer-events-none ") + classesFor(el.kind, isSel)}
                style={{
                  left: el.x, top: el.y, width: el.w, height: el.h,
                  borderRadius: el.shape === "round" ? 9999 : el.kind === "wall" ? 2 : el.kind === "seat" ? 6 : 10,
                  transform: el.rotation ? "rotate(" + el.rotation + "deg)" : undefined,
                  zIndex: zFor(el.kind) + (isSel ? 10 : 0),
                }}
              >
                {el.label && el.kind !== "seat" ? <span className="px-1 truncate">{el.label}</span> : null}
                {isSel && !isChair && (
                  <div
                    onPointerDown={(e) => onElementPointerDown(e, el, "resize")}
                    className="absolute right-0 bottom-0 w-3 h-3 bg-blue-500 rounded-sm cursor-nwse-resize"
                    style={{ transform: "translate(30%, 30%)" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? "Saving..." : dirty ? "Save floor" : "Saved"}
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        {busy && <span className="text-xs text-muted-foreground">Working…</span>}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {/* Chair placement setting */}
      <div className="mt-5 pt-4 border-t border-border">
        <p className="font-medium text-sm">Chair placement</p>
        <p className="text-muted-foreground text-xs mb-2">
          How chairs behave when you build a floor. <span className="font-medium">Follow table</span> keeps
          chairs arranged around each table and moves them with it. <span className="font-medium">Individually editable</span> lets
          you also nudge or remove single chairs for odd layouts.
        </p>
        <div className="flex gap-2">
          {(["follow", "editable"] as const).map((m) => (
            <button key={m} type="button" onClick={() => changeChairMode(m)} className={"text-sm rounded-md border px-3 py-1.5 " + (chairMode === m ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}>
              {m === "follow" ? "Follow table" : "Individually editable"}
            </button>
          ))}
        </div>
      </div>

      {/* Seat-count prompt when adding a table/booth */}
      {seatPrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setSeatPrompt(null)}>
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{"Add " + seatPrompt.label.toLowerCase()}</h3>
              <button type="button" onClick={() => setSeatPrompt(null)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <div className="space-y-1 mb-3">
              <Label className="text-xs">How many seats?</Label>
              <Input type="number" min="0" max="20" value={seatN} onChange={(e) => setSeatN(e.target.value)} className="h-11" />
            </div>
            <Button className="w-full h-11" onClick={() => addElement(seatPrompt, Math.max(0, Math.min(20, parseInt(seatN) || 0)))}>Add</Button>
          </div>
        </div>
      )}
    </div>
  );
}
