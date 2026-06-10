"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFloorLayout, type FloorElement, type ElementKind } from "../floor/floor-actions";

const GRID = 20;
const CANVAS_W = 1000;
const CANVAS_H = 700;

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

const PALETTE: { kind: ElementKind; label: string; shape: "rect" | "round"; w: number; h: number }[] = [
  { kind: "table", label: "Table", shape: "rect", w: 80, h: 80 },
  { kind: "table", label: "Round table", shape: "round", w: 80, h: 80 },
  { kind: "seat", label: "Chair", shape: "round", w: 28, h: 28 },
  { kind: "counter", label: "Counter", shape: "rect", w: 200, h: 40 },
  { kind: "station", label: "Station", shape: "rect", w: 60, h: 60 },
  { kind: "wall", label: "Wall", shape: "rect", w: 160, h: 12 },
  { kind: "room", label: "Room", shape: "rect", w: 260, h: 200 },
  { kind: "label", label: "Text", shape: "rect", w: 120, h: 24 },
];

const NAMEABLE: ElementKind[] = ["table", "counter", "station", "room", "label"];

function snap(v: number) {
  return Math.round(v / GRID) * GRID;
}

function classesFor(kind: ElementKind, selected: boolean): string {
  const ring = selected ? " ring-2 ring-foreground ring-offset-1 ring-offset-background" : "";
  switch (kind) {
    case "table":
      return "bg-card border-2 border-foreground/40 text-foreground" + ring;
    case "seat":
      return "bg-muted border border-foreground/40" + ring;
    case "counter":
      return "bg-accent border-2 border-foreground/40 text-foreground" + ring;
    case "station":
      return "bg-blue-500/15 border-2 border-blue-500/50 text-foreground" + ring;
    case "wall":
      return "bg-foreground/60" + ring;
    case "room":
      return "bg-muted/30 border-2 border-dashed border-foreground/30 text-muted-foreground" + ring;
    case "label":
      return "bg-transparent text-foreground" + ring;
    default:
      return "bg-card border" + ring;
  }
}

function zFor(kind: ElementKind): number {
  if (kind === "room") return 0;
  if (kind === "wall") return 1;
  if (kind === "table" || kind === "counter" || kind === "station") return 2;
  return 3; // seats, labels on top
}

export function FloorCard({ initialElements }: { initialElements: FloorElement[] }) {
  const [els, setEls] = useState<El[]>(() =>
    initialElements.map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      x: e.x,
      y: e.y,
      w: e.w,
      h: e.h,
      rotation: e.rotation,
      shape: e.shape,
      parent_id: e.parent_id,
      seat_no: e.seat_no,
    }))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | { mode: "move" | "resize"; id: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number }
    | null
  >(null);

  const selected = els.find((e) => e.id === selectedId) || null;

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

  function addElement(p: (typeof PALETTE)[number]) {
    const id = crypto.randomUUID();
    const offset = (els.length % 8) * GRID;
    const el: El = {
      id,
      kind: p.kind,
      label: p.kind === "table" ? nextTableName() : NAMEABLE.includes(p.kind) ? "" : null,
      x: snap(60 + offset),
      y: snap(60 + offset),
      w: p.w,
      h: p.h,
      rotation: 0,
      shape: p.shape,
      parent_id: null,
      seat_no: null,
    };
    setEls((prev) => [...prev, el]);
    setSelectedId(id);
    setDirty(true);
  }

  function updateSelected(patch: Partial<El>) {
    if (!selectedId) return;
    setEls((prev) => prev.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)));
    setDirty(true);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setEls((prev) => prev.filter((e) => e.id !== selectedId));
    setSelectedId(null);
    setDirty(true);
  }

  function onElementPointerDown(e: React.PointerEvent, el: El, mode: "move" | "resize") {
    e.stopPropagation();
    setSelectedId(el.id);
    canvasRef.current?.setPointerCapture(e.pointerId);
    drag.current = { mode, id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    setEls((prev) =>
      prev.map((el) => {
        if (el.id !== d.id) return el;
        if (d.mode === "move") {
          return { ...el, x: Math.max(0, snap(d.ox + dx)), y: Math.max(0, snap(d.oy + dy)) };
        }
        return { ...el, w: Math.max(GRID, snap(d.ow + dx)), h: Math.max(GRID, snap(d.oh + dy)) };
      })
    );
  }

  function onCanvasPointerUp() {
    if (drag.current) {
      drag.current = null;
      setDirty(true);
    }
  }

  function handleSave() {
    setError(null);
    startSave(async () => {
      const res = await saveFloorLayout(
        els.map((e, i) => ({
          id: e.id,
          kind: e.kind,
          label: e.label,
          x: e.x,
          y: e.y,
          w: e.w,
          h: e.h,
          rotation: e.rotation,
          shape: e.shape,
          parent_id: e.parent_id,
          seat_no: e.seat_no,
          sort_order: i,
        }))
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      // Reflect any auto-applied "Table N" names locally.
      setEls((prev) => {
        let max = 0;
        for (const e of prev) {
          if (e.kind === "table" && e.label) {
            const m = /^Table\s+(\d+)$/i.exec(e.label.trim());
            if (m) max = Math.max(max, parseInt(m[1]));
          }
        }
        return prev.map((e) =>
          e.kind === "table" && (!e.label || !e.label.trim()) ? { ...e, label: "Table " + ++max } : e
        );
      });
      setDirty(false);
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Design your floor: add tables, chairs, counters, stations, walls, and
        rooms, then drag to position and resize. New tables are named
        automatically (Table 1, Table 2&hellip;) and names must be unique.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {PALETTE.map((p) => (
          <button
            key={p.kind + p.shape}
            type="button"
            onClick={() => addElement(p)}
            className="text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
          >
            {"+ " + p.label}
          </button>
        ))}
      </div>

      {/* Selected-element panel */}
      {selected && (
        <div className="flex flex-wrap items-end gap-2 mb-3 p-3 rounded-md border border-border bg-card">
          <span className="text-xs uppercase tracking-wide text-muted-foreground self-center capitalize">{selected.kind}</span>
          {NAMEABLE.includes(selected.kind) && (
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={selected.label ?? ""}
                onChange={(e) => updateSelected({ label: e.target.value })}
                placeholder={selected.kind === "table" ? "Table 1" : "Name"}
                className="h-9 w-40"
              />
            </div>
          )}
          {selected.kind === "table" && (
            <Button size="sm" variant="outline" onClick={() => updateSelected({ shape: selected.shape === "round" ? "rect" : "round" })}>
              {selected.shape === "round" ? "Make square" : "Make round"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => updateSelected({ rotation: (selected.rotation + 15) % 360 })}>
            Rotate
          </Button>
          <Button size="sm" variant="outline" className="text-red-600" onClick={deleteSelected}>
            Delete
          </Button>
        </div>
      )}

      {/* Canvas */}
      <div className="overflow-auto rounded-md border border-border bg-muted/10" style={{ maxHeight: 520 }}>
        <div
          ref={canvasRef}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerDown={() => setSelectedId(null)}
          className="relative"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundImage:
              "linear-gradient(to right, rgba(120,120,120,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,120,120,0.12) 1px, transparent 1px)",
            backgroundSize: GRID + "px " + GRID + "px",
            touchAction: "none",
          }}
        >
          {els.map((el) => {
            const isSel = el.id === selectedId;
            return (
              <div
                key={el.id}
                onPointerDown={(e) => onElementPointerDown(e, el, "move")}
                className={"absolute flex items-center justify-center text-[10px] font-medium select-none cursor-move overflow-hidden " + classesFor(el.kind, isSel)}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.w,
                  height: el.h,
                  borderRadius: el.shape === "round" ? 9999 : 6,
                  transform: el.rotation ? "rotate(" + el.rotation + "deg)" : undefined,
                  zIndex: zFor(el.kind) + (isSel ? 10 : 0),
                }}
              >
                {el.label ? <span className="px-1 truncate">{el.label}</span> : null}
                {isSel && el.kind !== "seat" && (
                  <div
                    onPointerDown={(e) => onElementPointerDown(e, el, "resize")}
                    className="absolute right-0 bottom-0 w-3 h-3 bg-foreground rounded-sm cursor-nwse-resize"
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
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
