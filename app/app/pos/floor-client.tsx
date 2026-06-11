"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegisterClient } from "./register-client";
import {
  openTableTicket,
  openTogoTicket,
  loadTableTicket,
  listOpenTableTickets,
  listOpenTogoTickets,
  type TableCart,
  type TableTicketSummary,
  type TogoTicketSummary,
} from "./ticket-actions";
import type { ActiveStaff } from "./staff-session";
import type { ReceiptSettings } from "./receipt-template";
import type { FloorElement, ElementKind } from "../floor/floor-actions";

type Variation = { id: string; name: string; price: number };
type Item = { id: string; name: string; price: number; category: string | null; taxable: boolean; taxFrac: number; image_url: string | null; out_of_stock: boolean; variations: Variation[]; modifiers: Variation[] };

type RegisterProps = {
  items: Item[];
  taxRate: number;
  businessName: string;
  hasStaff: boolean;
  activeStaff: ActiveStaff | null;
  receiptSettings: Partial<ReceiptSettings> | null;
  showItemPhotos: boolean;
  categoryColors: Record<string, string>;
};

type StaffMember = { id: string; name: string };
type Selected = { elementId: string; ticketId: string; tableLabel: string; cart: TableCart; serverName: string | null };

// Elements a server can ring up (open a ticket on). Walls/rooms/labels/chairs
// are visual only on the live floor.
const RINGABLE: ElementKind[] = ["table", "booth", "counter", "station"];
function isRingable(kind: ElementKind): boolean {
  return RINGABLE.indexOf(kind) !== -1;
}
function zFor(kind: ElementKind): number {
  if (kind === "room") return 0;
  if (kind === "wall") return 1;
  if (kind === "seat") return 2;
  if (kind === "label") return 4;
  return 3;
}

export function FloorClient({
  register,
  elements,
  initialOpen,
  initialTogo,
  staff,
}: {
  register: RegisterProps;
  elements: FloorElement[];
  initialOpen: TableTicketSummary[];
  initialTogo: TogoTicketSummary[];
  staff: StaffMember[];
}) {
  const [openByElement, setOpenByElement] = useState<Record<string, TableTicketSummary>>(() => {
    const m: Record<string, TableTicketSummary> = {};
    for (const t of initialOpen) m[t.element_id] = t;
    return m;
  });
  const [togo, setTogo] = useState<TogoTicketSummary[]>(initialTogo);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [promptTable, setPromptTable] = useState<FloorElement | null>(null);
  const [guests, setGuests] = useState("");
  const [togoOpen, setTogoOpen] = useState(false);
  const [togoName, setTogoName] = useState("");
  const [find, setFind] = useState("");

  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  async function refreshOpen() {
    const [rows, togoRows] = await Promise.all([listOpenTableTickets(), listOpenTogoTickets()]);
    const m: Record<string, TableTicketSummary> = {};
    for (const t of rows) m[t.element_id] = t;
    setOpenByElement(m);
    setTogo(togoRows);
  }

  function enterElement(el: FloorElement, guestCount: number | null) {
    setError(null);
    setPromptTable(null);
    startTransition(async () => {
      const res = await openTableTicket(el.id, guestCount);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSelected({ elementId: el.id, ticketId: res.ticketId, tableLabel: el.label ?? "Table", cart: res.cart, serverName: null });
    });
  }

  function resumeElement(el: FloorElement, ticketId: string, serverName: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await loadTableTicket(ticketId);
      if ("error" in res) {
        setError(res.error);
        await refreshOpen();
        return;
      }
      setSelected({ elementId: el.id, ticketId: ticketId, tableLabel: el.label ?? "Table", cart: res.cart, serverName: serverName });
    });
  }

  // Tap a floor element: resume if open, else open it (tables ask guest count).
  function tapElement(el: FloorElement) {
    if (!isRingable(el.kind)) return;
    const open = openByElement[el.id];
    if (open) {
      resumeElement(el, open.id, open.server_name);
    } else if (el.kind === "table" || el.kind === "booth") {
      setGuests("");
      setPromptTable(el);
    } else {
      enterElement(el, null);
    }
  }

  function startTogo() {
    setError(null);
    const name = togoName.trim();
    setTogoOpen(false);
    startTransition(async () => {
      const res = await openTogoTicket(name || null);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSelected({ elementId: "", ticketId: res.ticketId, tableLabel: "To-go" + (res.name ? " · " + res.name : ""), cart: { items: [] }, serverName: null });
      setTogoName("");
    });
  }

  function resumeTogo(t: TogoTicketSummary) {
    setError(null);
    startTransition(async () => {
      const res = await loadTableTicket(t.id);
      if ("error" in res) {
        setError(res.error);
        await refreshOpen();
        return;
      }
      setSelected({ elementId: "", ticketId: t.id, tableLabel: "To-go" + (t.name ? " · " + t.name : ""), cart: res.cart, serverName: t.server_name });
    });
  }

  function exitToFloor() {
    setSelected(null);
    refreshOpen();
  }

  if (selected) {
    return (
      <RegisterClient
        key={selected.ticketId}
        {...register}
        tableBinding={{ tableId: selected.elementId, ticketId: selected.ticketId, tableLabel: selected.tableLabel, serverName: selected.serverName }}
        initialTableCart={selected.cart}
        onExitToFloor={exitToFloor}
        staffList={staff}
      />
    );
  }

  function minutesOpen(openedAt: string): number {
    if (!nowMs) return 0;
    const ms = nowMs - new Date(openedAt).getTime();
    return Math.max(0, Math.floor(ms / 60000));
  }

  const q = find.trim().toLowerCase();
  function matchesFind(el: FloorElement): boolean {
    if (!q) return true;
    const open = openByElement[el.id];
    return (el.label ?? "").toLowerCase().includes(q) || (open?.server_name ?? "").toLowerCase().includes(q);
  }
  const visibleTogo = togo.filter(
    (t) => !q || (t.name ?? "").toLowerCase().includes(q) || (t.server_name ?? "").toLowerCase().includes(q)
  );

  // Canvas bounds — fit the designed layout (with a sensible minimum).
  let canvasW = 900;
  let canvasH = 560;
  for (const e of elements) {
    canvasW = Math.max(canvasW, e.x + e.w + 40);
    canvasH = Math.max(canvasH, e.y + e.h + 40);
  }
  const ordered = [...elements].sort((a, b) => zFor(a.kind) - zFor(b.kind));
  const ringableCount = elements.filter((e) => isRingable(e.kind)).length;

  function decorClass(kind: ElementKind): string {
    if (kind === "wall") return "bg-foreground/70";
    if (kind === "room") return "bg-muted/20 border-2 border-dashed border-foreground/25 text-muted-foreground";
    if (kind === "seat") return "bg-muted border border-foreground/30";
    return "bg-transparent text-foreground";
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-3 h-12 px-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="font-semibold truncate">{register.businessName}</span>
          <span className="text-xs text-sidebar-foreground/70 hidden sm:inline">Floor</span>
        </div>
        <Link href="/app" className="flex items-center gap-1.5 text-xs rounded-md border border-sidebar-border px-2.5 py-1.5 hover:bg-sidebar-accent shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          Exit
        </Link>
      </div>

      <div className="shrink-0 flex items-center gap-2 p-2 border-b border-border">
        <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a check (table, name, server)" className="h-10 flex-1" />
        <Button variant="outline" className="h-10 shrink-0" onClick={() => { setTogoName(""); setTogoOpen(true); }}>New to-go</Button>
      </div>

      {/* To-go rail */}
      {visibleTogo.length > 0 && (
        <div className="shrink-0 flex gap-2 overflow-x-auto p-2 border-b border-border bg-card/40">
          {visibleTogo.map((t) => (
            <button key={t.id} type="button" disabled={pending} onClick={() => resumeTogo(t)} className="shrink-0 w-40 text-left rounded-lg border border-amber-500/50 bg-amber-500/10 p-2.5 active:scale-[0.98] transition-transform">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-sm truncate">{t.name ?? "To-go"}</span>
                <span className="text-[10px] uppercase tracking-wide text-amber-600 font-medium shrink-0">To-go</span>
              </div>
              <div className="text-sm tabular-nums font-medium">{"$" + t.subtotal.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground truncate">{minutesOpen(t.opened_at) + " min" + (t.server_name ? "  ·  " + t.server_name : "")}</div>
            </button>
          ))}
        </div>
      )}

      {/* Visual floor map */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {ringableCount === 0 ? (
          <div className="max-w-md mx-auto mt-10 text-center">
            <p className="text-sm text-muted-foreground">
              Your floor is empty. Design it in Settings &rarr; Floor &mdash; add
              tables, booths, counters, walls and rooms &mdash; and it shows up
              here as your map.
            </p>
          </div>
        ) : (
          <div
            className="relative mx-auto rounded-lg border border-border bg-muted/10"
            style={{
              width: canvasW,
              height: canvasH,
              backgroundImage:
                "linear-gradient(to right, rgba(120,120,120,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,120,120,0.08) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          >
            {ordered.map((el) => {
              const ring = isRingable(el.kind);
              const open = ring ? openByElement[el.id] : undefined;
              const dim = q && ring && !matchesFind(el);
              const radius = el.shape === "round" ? 9999 : el.kind === "wall" ? 3 : 8;
              const baseStyle = {
                left: el.x,
                top: el.y,
                width: el.w,
                height: el.h,
                borderRadius: radius,
                transform: el.rotation ? "rotate(" + el.rotation + "deg)" : undefined,
                zIndex: zFor(el.kind),
                opacity: dim ? 0.3 : 1,
              } as const;

              if (!ring) {
                return (
                  <div
                    key={el.id}
                    className={"absolute flex items-center justify-center text-[10px] overflow-hidden " + decorClass(el.kind)}
                    style={baseStyle}
                  >
                    {el.label ? <span className="px-1 truncate">{el.label}</span> : null}
                  </div>
                );
              }

              const cls = open
                ? "border-emerald-500/60 bg-emerald-500/15 text-foreground"
                : "border-border bg-card hover:border-foreground/40 hover:bg-accent/50 text-foreground";
              return (
                <button
                  key={el.id}
                  type="button"
                  disabled={pending}
                  onClick={() => tapElement(el)}
                  className={"absolute border-2 p-1.5 flex flex-col items-center justify-center text-center leading-tight active:scale-[0.97] transition-transform " + cls}
                  style={baseStyle}
                >
                  <span className="text-xs font-semibold truncate max-w-full">{el.label ?? (el.kind === "counter" ? "Counter" : el.kind === "station" ? "Station" : "Table")}</span>
                  {open && (
                    <>
                      <span className="text-[11px] tabular-nums font-medium">{"$" + open.subtotal.toFixed(2)}</span>
                      <span className="text-[9px] text-muted-foreground truncate max-w-full">
                        {minutesOpen(open.opened_at) + "m" + (open.server_name ? " · " + open.server_name : "")}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      </div>

      {togoOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setTogoOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">New to-go order</h3>
              <button type="button" onClick={() => setTogoOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <div className="space-y-1 mb-3">
              <Label className="text-xs">Name (optional)</Label>
              <Input value={togoName} onChange={(e) => setTogoName(e.target.value)} placeholder="Customer or order name" className="h-11" />
            </div>
            <Button className="w-full h-12" disabled={pending} onClick={startTogo}>Start to-go</Button>
          </div>
        </div>
      )}

      {promptTable && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setPromptTable(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{"Open " + (promptTable.label ?? "table")}</h3>
              <button type="button" onClick={() => setPromptTable(null)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <div className="space-y-1 mb-3">
              <Label className="text-xs">Guests (optional)</Label>
              <Input type="number" min="1" max="99" value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="2" className="h-11" />
            </div>
            <Button className="w-full h-12" disabled={pending} onClick={() => enterElement(promptTable, guests ? parseInt(guests) : null)}>
              Open table
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
