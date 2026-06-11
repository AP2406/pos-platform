"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { allocateEqual } from "./split-math";

export type SplitLine = {
  catalog_item_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  taxable: boolean;
  seat?: number | null;
};

export type SplitCheck = {
  lines: SplitLine[];
  payment_method: "cash" | "card" | "other";
};

type Props = {
  open: boolean;
  onClose: () => void;
  lines: SplitLine[];
  allowUnits: boolean;
  settlementMode: "separate" | "informational";
  pending: boolean;
  onConfirm: (checks: SplitCheck[]) => void;
};

const PAY_METHODS: { key: "cash" | "card" | "other"; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "other", label: "Other" },
];

const evenCents = allocateEqual;

export function SplitSheet(props: Props) {
  const { lines, allowUnits, settlementMode } = props;
  const unitCents = lines.map((l) => Math.round(l.unit_price * 100));
  const lineCents = lines.map((l, i) => unitCents[i] * l.quantity);
  const grandCents = lineCents.reduce((a, b) => a + b, 0);

  const [n, setN] = useState(2);
  // alloc[lineIndex][checkIndex] in cents; rows always sum to lineCents[i].
  const [alloc, setAlloc] = useState<number[][]>([]);
  const [pays, setPays] = useState<("cash" | "card" | "other")[]>(["cash", "cash"]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sharePicker, setSharePicker] = useState<number | null>(null);

  // Seats present on the lines (table checks). Enables the "By seat" shortcut.
  const occupiedSeats = Array.from(
    new Set(lines.map((l) => l.seat).filter((s): s is number => typeof s === "number" && s > 0))
  ).sort((a, b) => a - b);
  const hasSeats = occupiedSeats.length >= 2;

  // Initialise to "everything on seat 1" when the sheet opens.
  useEffect(() => {
    if (!props.open) return;
    setAlloc(lines.map((_, i) => {
      const row = new Array<number>(n).fill(0);
      row[0] = lineCents[i];
      return row;
    }));
    setPays((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? "cash"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  // Change the number of seats, preserving allocation (cents on removed seats
  // move back onto seat 1).
  function changeN(next: number) {
    const nn = Math.max(2, Math.min(8, next));
    setN(nn);
    setAlloc((prev) => lines.map((_, i) => {
      const row = new Array<number>(nn).fill(0);
      const old = prev[i] ?? [];
      for (let ci = 0; ci < old.length; ci++) row[ci < nn ? ci : 0] += old[ci];
      const sum = row.reduce((a, b) => a + b, 0);
      if (sum !== lineCents[i]) { row.fill(0); row[0] = lineCents[i]; }
      return row;
    }));
    setPays((prev) => Array.from({ length: nn }, (_, i) => prev[i] ?? "cash"));
  }

  // Auto-group by the seat each line was ordered for. Shared lines (no seat)
  // split evenly across all occupied seats.
  function bySeat() {
    if (!hasSeats) return;
    const idxOf = new Map(occupiedSeats.map((s, i) => [s, i]));
    const nn = occupiedSeats.length;
    setN(nn);
    setAlloc(lines.map((l, i) => {
      const row = new Array<number>(nn).fill(0);
      if (typeof l.seat === "number" && idxOf.has(l.seat)) {
        row[idxOf.get(l.seat) as number] = lineCents[i];
      } else {
        const shares = allocateEqual(lineCents[i], nn);
        for (let k = 0; k < nn; k++) row[k] = shares[k];
      }
      return row;
    }));
    setPays(Array.from({ length: nn }, () => "cash"));
  }

  if (!props.open) return null;

  const checkCents = Array.from({ length: n }, (_, ci) =>
    alloc.reduce((s, row) => s + (row[ci] ?? 0), 0)
  );
  const partitionOk = checkCents.reduce((a, b) => a + b, 0) === grandCents;
  const allChecksNonEmpty = checkCents.every((c) => c > 0);
  const canConfirm = partitionOk && allChecksNonEmpty && !props.pending;

  function assignWhole(i: number, ci: number) {
    setAlloc((prev) => {
      const next = prev.map((r) => r.slice());
      next[i] = new Array<number>(n).fill(0);
      next[i][ci] = lineCents[i];
      return next;
    });
  }
  function shareLine(i: number) {
    setAlloc((prev) => {
      const next = prev.map((r) => r.slice());
      next[i] = evenCents(lineCents[i], n);
      return next;
    });
  }
  // Split one item evenly among a chosen subset of checks ("who's sharing the
  // nachos?"). Distributes the line's cents across exactly the picked checks.
  function shareAmong(i: number, members: number[]) {
    setAlloc((prev) => {
      const next = prev.map((r) => r.slice());
      const row = new Array<number>(n).fill(0);
      if (members.length === 0) {
        row[0] = lineCents[i];
      } else {
        const shares = evenCents(lineCents[i], members.length);
        members.forEach((ci, k) => { row[ci] = shares[k]; });
      }
      next[i] = row;
      return next;
    });
  }
  function toggleShareMember(i: number, ci: number) {
    const members = (alloc[i] ?? []).map((cAmt, idx) => (cAmt > 0 ? idx : -1)).filter((x) => x >= 0);
    const has = members.includes(ci);
    const nextMembers = has ? members.filter((m) => m !== ci) : [...members, ci];
    if (nextMembers.length === 0) return; // keep at least one guest on the item
    shareAmong(i, nextMembers);
  }
  // Even split across all seats. Rotate each line's leftover penny by the line
  // index so the extra cents spread across seats instead of piling on seat 1 —
  // every seat's total ends up within a cent of the check total ÷ N.
  function evenAll() {
    setAlloc(lines.map((_, i) => {
      const shares = evenCents(lineCents[i], n);
      const off = i % n;
      const row = new Array<number>(n).fill(0);
      for (let j = 0; j < n; j++) row[(j + off) % n] = shares[j];
      return row;
    }));
  }
  // Re-merge: undo all assignments back to a single seat (before any payment).
  function resetSplit() {
    setAlloc(lines.map((_, i) => {
      const row = new Array<number>(n).fill(0);
      row[0] = lineCents[i];
      return row;
    }));
  }
  function setUnits(i: number, ci: number, units: number) {
    setAlloc((prev) => {
      const next = prev.map((r) => r.slice());
      const u = Math.max(0, Math.min(lines[i].quantity, Math.round(units)));
      // assign u units to ci, distribute the rest to other checks proportionally
      const row = new Array<number>(n).fill(0);
      row[ci] = u * unitCents[i];
      let remainingUnits = lines[i].quantity - u;
      // keep whatever other checks already had, scaled to remaining units
      const others: number[] = [];
      for (let k = 0; k < n; k++) if (k !== ci) others.push(k);
      // simple: dump remaining units on the first "other" check
      if (remainingUnits > 0 && others.length) {
        row[others[0]] += remainingUnits * unitCents[i];
        remainingUnits = 0;
      }
      const sum = row.reduce((a, b) => a + b, 0);
      if (sum !== lineCents[i]) {
        row.fill(0);
        row[0] = lineCents[i];
      }
      next[i] = row;
      return next;
    });
  }

  function buildChecks(): SplitCheck[] {
    const checks: SplitCheck[] = [];
    for (let ci = 0; ci < n; ci++) {
      const ckLines: SplitLine[] = [];
      for (let i = 0; i < lines.length; i++) {
        const cents = alloc[i]?.[ci] ?? 0;
        if (cents <= 0) continue;
        const u = unitCents[i];
        if (u > 0 && cents % u === 0) {
          ckLines.push({ catalog_item_id: lines[i].catalog_item_id, name: lines[i].name, unit_price: lines[i].unit_price, quantity: cents / u, taxable: lines[i].taxable });
        } else {
          // shared sub-unit portion: prorate as a single $X line
          ckLines.push({ catalog_item_id: lines[i].catalog_item_id, name: lines[i].name + " (shared)", unit_price: Math.round(cents) / 100, quantity: 1, taxable: lines[i].taxable });
        }
      }
      checks.push({ lines: ckLines, payment_method: pays[ci] ?? "cash" });
    }
    return checks;
  }

  function rowState(i: number): { whole: number | null; shared: boolean } {
    const row = alloc[i] ?? [];
    const nonzero = row.map((c, ci) => ({ c, ci })).filter((x) => x.c > 0);
    if (nonzero.length === 1) return { whole: nonzero[0].ci, shared: false };
    return { whole: null, shared: true };
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={props.onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg w-full sm:max-w-lg max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-medium">Split check</h3>
            <p className="text-xs text-muted-foreground">{settlementMode === "separate" ? "Each seat is paid separately." : "One payment, itemized per seat."}</p>
          </div>
          <button type="button" onClick={props.onClose} className="text-xs text-muted-foreground underline">Cancel</button>
        </div>

        <div className="flex items-center justify-between gap-2 p-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Seats</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => changeN(n - 1)} className="w-9 h-9 rounded-md border border-border hover:bg-accent text-lg leading-none">-</button>
              <span className="w-7 text-center tabular-nums">{n}</span>
              <button type="button" onClick={() => changeN(n + 1)} className="w-9 h-9 rounded-md border border-border hover:bg-accent text-lg leading-none">+</button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" className="h-9" onClick={resetSplit}>Reset</Button>
            {hasSeats && <Button type="button" variant="outline" className="h-9" onClick={bySeat}>By seat</Button>}
            <Button type="button" variant="outline" className="h-9" onClick={evenAll}>Even split</Button>
          </div>
        </div>

        <div className="overflow-y-auto p-3 space-y-2 flex-1">
          {lines.map((l, i) => {
            const st = rowState(i);
            return (
              <div key={i} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{l.name}{l.quantity > 1 ? " ×" + l.quantity : ""}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{"$" + (lineCents[i] / 100).toFixed(2)}</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {Array.from({ length: n }, (_, ci) => (
                      <button key={ci} type="button" onClick={() => assignWhole(i, ci)} className={"w-8 h-8 rounded-md border text-xs " + (st.whole === ci ? "border-foreground bg-accent font-medium" : "border-border hover:bg-accent/50")}>{ci + 1}</button>
                    ))}
                    {allowUnits && (
                      <button type="button" onClick={() => setSharePicker(sharePicker === i ? null : i)} className={"h-8 px-2 rounded-md border text-xs " + (st.shared ? "border-foreground bg-accent font-medium" : "border-border hover:bg-accent/50")}>Split…</button>
                    )}
                    {allowUnits && l.quantity > 1 && (
                      <button type="button" onClick={() => setExpanded(expanded === i ? null : i)} className="h-8 px-2 rounded-md border border-border text-xs hover:bg-accent/50">Units</button>
                    )}
                  </div>
                </div>
                {allowUnits && sharePicker === i && (
                  <div className="mt-2 rounded-md bg-accent/30 p-2">
                    <div className="text-[11px] text-muted-foreground mb-1.5">Which seats are sharing this item? Tap each seat splitting it.</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: n }, (_, ci) => {
                        const on = (alloc[i]?.[ci] ?? 0) > 0;
                        return (
                          <button key={ci} type="button" onClick={() => toggleShareMember(i, ci)} className={"h-8 min-w-8 px-2 rounded-md border text-xs " + (on ? "border-foreground bg-accent font-medium" : "border-border hover:bg-accent/50")}>{ci + 1}</button>
                        );
                      })}
                      <button type="button" onClick={() => shareLine(i)} className="h-8 px-2 rounded-md border border-border text-xs hover:bg-accent/50">All</button>
                    </div>
                  </div>
                )}
                {allowUnits && expanded === i && l.quantity > 1 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {Array.from({ length: n }, (_, ci) => (
                      <label key={ci} className="flex items-center justify-between gap-2 text-xs border border-border rounded px-2 py-1">
                        <span className="text-muted-foreground">Seat {ci + 1}</span>
                        <input type="number" min="0" max={l.quantity} value={Math.round((alloc[i]?.[ci] ?? 0) / Math.max(1, unitCents[i]))} onChange={(e) => setUnits(i, ci, parseInt(e.target.value) || 0)} className="w-14 h-8 text-right rounded border border-border bg-transparent px-1" />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border p-3 space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: n }, (_, ci) => (
              <div key={ci} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Seat {ci + 1}</span>
                  <span className={"text-sm tabular-nums " + (checkCents[ci] > 0 ? "" : "text-red-600")}>{"$" + (checkCents[ci] / 100).toFixed(2)}</span>
                </div>
                {settlementMode === "separate" && (
                  <div className="mt-1 flex rounded border border-border overflow-hidden text-[11px]">
                    {PAY_METHODS.map((m) => (
                      <button key={m.key} type="button" onClick={() => setPays((p) => { const x = p.slice(); x[ci] = m.key; return x; })} className={"flex-1 py-1 " + (pays[ci] === m.key ? "bg-accent font-medium" : "hover:bg-accent/50")}>{m.label}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Item subtotals shown. Tax{settlementMode === "separate" ? ", service charge and discounts" : " and charges"} are divided proportionally — exact amounts print on each seat, summing to ${(grandCents / 100).toFixed(2)} plus tax.</p>
          <Button className="w-full h-12" disabled={!canConfirm} onClick={() => props.onConfirm(buildChecks())}>
            {props.pending ? "Working..." : settlementMode === "separate" ? "Pay " + n + " seats" : "Charge together"}
          </Button>
          {!allChecksNonEmpty && <p className="text-xs text-red-600">Every seat needs at least one item.</p>}
        </div>
      </div>
    </div>
  );
}
