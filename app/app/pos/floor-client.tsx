"use client";

import { useEffect, useState, useTransition } from "react";
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
import type { FloorArea, FloorTable } from "../floor/floor-actions";

type Variation = { id: string; name: string; price: number };
type Item = { id: string; name: string; price: number; category: string | null; taxable: boolean; taxFrac: number; image_url: string | null; variations: Variation[]; modifiers: Variation[] };

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

type Selected = { tableId: string; ticketId: string; tableLabel: string; cart: TableCart };

export function FloorClient({
  register,
  areas,
  tables,
  initialOpen,
}: {
  register: RegisterProps;
  areas: FloorArea[];
  tables: FloorTable[];
  initialOpen: TableTicketSummary[];
}) {
  const [openByTable, setOpenByTable] = useState<Record<string, TableTicketSummary>>(() => {
    const m: Record<string, TableTicketSummary> = {};
    for (const t of initialOpen) m[t.table_id] = t;
    return m;
  });
  const [selected, setSelected] = useState<Selected | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Guest-count prompt before opening an available table.
  const [promptTable, setPromptTable] = useState<FloorTable | null>(null);
  const [guests, setGuests] = useState("");

  // A ticking "now" so open-table timers stay live without reading the clock
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

  const activeTables = tables.filter((t) => t.is_active);

  async function refreshOpen() {
    const rows = await listOpenTableTickets();
    const m: Record<string, TableTicketSummary> = {};
    for (const t of rows) m[t.table_id] = t;
    setOpenByTable(m);
  }

  function enterTable(table: FloorTable, guestCount: number | null) {
    setError(null);
    setPromptTable(null);
    startTransition(async () => {
      const res = await openTableTicket(table.id, guestCount);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSelected({ tableId: table.id, ticketId: res.ticketId, tableLabel: table.label, cart: res.cart });
    });
  }

  function resumeTable(table: FloorTable, ticketId: string) {
    setError(null);
    startTransition(async () => {
      const res = await loadTableTicket(ticketId);
      if ("error" in res) {
        setError(res.error);
        await refreshOpen();
        return;
      }
      setSelected({ tableId: table.id, ticketId: ticketId, tableLabel: table.label, cart: res.cart });
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
        tableBinding={{ tableId: selected.tableId, ticketId: selected.ticketId, tableLabel: selected.tableLabel }}
        initialTableCart={selected.cart}
        onExitToFloor={exitToFloor}
      />
    );
  }

  // Group tables by area (areas in order, then any Unassigned).
  const groups: { key: string; name: string; tables: FloorTable[] }[] = [];
  for (const a of areas) {
    const inArea = activeTables.filter((t) => t.area_id === a.id);
    if (inArea.length > 0) groups.push({ key: a.id, name: a.name, tables: inArea });
  }
  const unassigned = activeTables.filter((t) => !t.area_id);
  if (unassigned.length > 0) groups.push({ key: "none", name: "Unassigned", tables: unassigned });

  function minutesOpen(openedAt: string): number {
    if (!nowMs) return 0;
    const ms = nowMs - new Date(openedAt).getTime();
    return Math.max(0, Math.floor(ms / 60000));
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-3 h-12 px-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <span className="font-semibold truncate">{register.businessName}</span>
        <span className="text-xs text-sidebar-foreground/70">Tables</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {activeTables.length === 0 ? (
          <div className="max-w-md mx-auto mt-10 text-center">
            <p className="text-sm text-muted-foreground">
              No tables yet. Add areas and tables in Settings &rarr; Floor, then
              they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key}>
                <h2 className="text-sm font-medium text-muted-foreground mb-2">{g.name}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {g.tables.map((t) => {
                    const open = openByTable[t.id];
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
                            <span className="font-semibold">{t.label}</span>
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
                          <span className="font-semibold">{t.label}</span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Open table</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{t.seats + " seats"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      </div>

      {/* Guest-count prompt */}
      {promptTable && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setPromptTable(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{"Open " + promptTable.label}</h3>
              <button type="button" onClick={() => setPromptTable(null)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <div className="space-y-1 mb-3">
              <Label className="text-xs">Guests (optional)</Label>
              <Input type="number" min="1" max="99" value={guests} onChange={(e) => setGuests(e.target.value)} placeholder={String(promptTable.seats)} className="h-11" />
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
