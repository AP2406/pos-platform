"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegisterClient } from "./register-client";
import {
  openTableTicket,
  loadTableTicket,
  listOpenTableTickets,
  type TableCart,
  type TableTicketSummary,
} from "./ticket-actions";
import type { ActiveStaff } from "./staff-session";
import type { ReceiptSettings } from "./receipt-template";
import type { FloorElement } from "../floor/floor-actions";

type Variation = { id: string; name: string; price: number };
type Item = { id: string; name: string; price: number; category: string | null; taxable: boolean; taxFrac: number; image_url: string | null; out_of_stock: boolean; variations: Variation[]; modifiers: Variation[] };

// Everything RegisterClient needs, passed straight through when a table opens.
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

type Selected = { elementId: string; ticketId: string; tableLabel: string; cart: TableCart };

export function FloorClient({
  register,
  tables,
  initialOpen,
}: {
  register: RegisterProps;
  tables: FloorElement[];
  initialOpen: TableTicketSummary[];
}) {
  const [openByElement, setOpenByElement] = useState<Record<string, TableTicketSummary>>(() => {
    const m: Record<string, TableTicketSummary> = {};
    for (const t of initialOpen) m[t.element_id] = t;
    return m;
  });
  const [selected, setSelected] = useState<Selected | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [promptTable, setPromptTable] = useState<FloorElement | null>(null);
  const [guests, setGuests] = useState("");

  // Ticking "now" so open-table timers stay live without reading the clock
  // during render. Set from a timer callback (never synchronously in render).
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
    const rows = await listOpenTableTickets();
    const m: Record<string, TableTicketSummary> = {};
    for (const t of rows) m[t.element_id] = t;
    setOpenByElement(m);
  }

  function enterTable(table: FloorElement, guestCount: number | null) {
    setError(null);
    setPromptTable(null);
    startTransition(async () => {
      const res = await openTableTicket(table.id, guestCount);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSelected({ elementId: table.id, ticketId: res.ticketId, tableLabel: table.label ?? "Table", cart: res.cart });
    });
  }

  function resumeTable(table: FloorElement, ticketId: string) {
    setError(null);
    startTransition(async () => {
      const res = await loadTableTicket(ticketId);
      if ("error" in res) {
        setError(res.error);
        await refreshOpen();
        return;
      }
      setSelected({ elementId: table.id, ticketId: ticketId, tableLabel: table.label ?? "Table", cart: res.cart });
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
        tableBinding={{ tableId: selected.elementId, ticketId: selected.ticketId, tableLabel: selected.tableLabel }}
        initialTableCart={selected.cart}
        onExitToFloor={exitToFloor}
      />
    );
  }

  function minutesOpen(openedAt: string): number {
    if (!nowMs) return 0;
    const ms = nowMs - new Date(openedAt).getTime();
    return Math.max(0, Math.floor(ms / 60000));
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-3 h-12 px-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="font-semibold truncate">{register.businessName}</span>
          <span className="text-xs text-sidebar-foreground/70 hidden sm:inline">Tables</span>
        </div>
        <Link href="/app" className="flex items-center gap-1.5 text-xs rounded-md border border-sidebar-border px-2.5 py-1.5 hover:bg-sidebar-accent shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          Exit
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {tables.length === 0 ? (
          <div className="max-w-md mx-auto mt-10 text-center">
            <p className="text-sm text-muted-foreground">
              No tables yet. Design your floor in Settings &rarr; Floor, then your
              tables appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables.map((t) => {
              const open = openByElement[t.id];
              if (open) {
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={pending}
                    onClick={() => resumeTable(t, open.id)}
                    className="text-left min-h-[104px] rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 flex flex-col justify-between active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{t.label ?? "Table"}</span>
                      <span className="text-[10px] uppercase tracking-wide text-emerald-600 font-medium">Open</span>
                    </div>
                    <div className="text-sm tabular-nums font-medium">{"$" + open.subtotal.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">
                      {minutesOpen(open.opened_at) + " min" + (open.guest_count ? "  ·  " + open.guest_count + " guests" : "")}
                    </div>
                  </button>
                );
              }
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={pending}
                  onClick={() => { setGuests(""); setPromptTable(t); }}
                  className="text-left min-h-[104px] rounded-lg border border-border bg-card hover:border-foreground/40 hover:bg-accent/50 p-3 flex flex-col justify-between active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.label ?? "Table"}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Open table</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Available</div>
                </button>
              );
            })}
          </div>
        )}
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      </div>

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
            <Button className="w-full h-12" disabled={pending} onClick={() => enterTable(promptTable, guests ? parseInt(guests) : null)}>
              Open table
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
