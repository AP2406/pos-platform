"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/lib/format";
import { RegisterClient } from "./register-client";
import {
  openTableTicket,
  openTogoTicket,
  openBarTab,
  loadTableTicket,
  listOpenTableTickets,
  listOpenTogoTickets,
  listOpenBarTabs,
  listChildTickets,
  unsplitTicket,
  mergeTickets,
  transferTables,
  type TableCart,
  type TableTicketSummary,
  type TogoTicketSummary,
  type BarTabSummary,
  type ChildTicket,
} from "./ticket-actions";
import { listFloor, type FloorElement, type ElementKind, type FloorPlan } from "../floor/floor-actions";
import type { ActiveStaff } from "./staff-session";
import type { ReceiptSettings } from "./receipt-template";

type Variation = { id: string; name: string; price: number };
type Item = { id: string; name: string; price: number; category: string | null; taxable: boolean; taxFrac: number; image_url: string | null; out_of_stock: boolean; variations: Variation[]; modifiers: Variation[] };

type RegisterProps = {
  items: Item[];
  taxRate: number;
  businessName: string;
  businessId?: string;
  hasStaff: boolean;
  activeStaff: ActiveStaff | null;
  receiptSettings: Partial<ReceiptSettings> | null;
  showItemPhotos: boolean;
  categoryColors: Record<string, string>;
  loyalty?: { enabled: boolean; redeemPerDollar: number };
};

type StaffMember = { id: string; name: string };
type Selected = { elementId: string; ticketId: string; tableLabel: string; cart: TableCart; serverName: string | null; seatCount: number | null; guestCount: number | null };

// Elements a server can ring up (open a ticket on). Walls/rooms/labels/chairs
// are visual only on the live floor.
const RINGABLE: ElementKind[] = ["table", "booth", "counter", "station"];
function isRingable(kind: ElementKind): boolean {
  return RINGABLE.indexOf(kind) !== -1;
}
function fmtClock(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return h + ":" + (m < 10 ? "0" + m : m) + " " + ampm;
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
  plans,
  initialElements,
  initialOpen,
  initialTogo,
  initialTabs,
  reservationSummary = { waitlist: 0, next: null },
  staff,
  sections = [],
  aging = { yellowMin: 45, redMin: 90 },
}: {
  register: RegisterProps;
  plans: FloorPlan[];
  initialElements: FloorElement[];
  initialOpen: TableTicketSummary[];
  initialTogo: TogoTicketSummary[];
  initialTabs: BarTabSummary[];
  reservationSummary?: { waitlist: number; next: { name: string; at: string; party: number } | null };
  staff: StaffMember[];
  sections?: { id: string; name: string; color: string | null; server: string | null }[];
  aging?: { yellowMin: number; redMin: number };
}) {
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const [elements, setElements] = useState<FloorElement[]>(initialElements);
  const [activePlan, setActivePlan] = useState<string>(plans[0]?.id ?? "");
  const [planLoading, setPlanLoading] = useState(false);
  const [openByElement, setOpenByElement] = useState<Record<string, TableTicketSummary>>(() => {
    const m: Record<string, TableTicketSummary> = {};
    for (const t of initialOpen) m[t.element_id] = t;
    return m;
  });
  const [togo, setTogo] = useState<TogoTicketSummary[]>(initialTogo);
  const [tabs, setTabs] = useState<BarTabSummary[]>(initialTabs);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [promptTable, setPromptTable] = useState<FloorElement | null>(null);
  const [guests, setGuests] = useState("");
  // P0-4: a split table's child-check chooser.
  const [splitView, setSplitView] = useState<{ parentId: string; label: string; children: ChildTicket[] } | null>(null);
  const [togoOpen, setTogoOpen] = useState(false);
  const [togoName, setTogoName] = useState("");
  const [togoPhone, setTogoPhone] = useState("");
  const [tabOpen, setTabOpen] = useState(false);
  const [tabName, setTabName] = useState("");
  // P1-21: handheld mode — a large-tap-target list of tables instead of the
  // scaled spatial map, which is hard to tap on a phone. Defaults to list on
  // small screens; the server can flip back to the map any time.
  const [view, setView] = useState<"map" | "list">("map");
  const [find, setFind] = useState("");

  // Server handoff (transfer all of one server's open tickets to another).
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffFrom, setHandoffFrom] = useState("");
  const [handoffTo, setHandoffTo] = useState("");
  const [handoffPin, setHandoffPin] = useState("");
  const [handoffNeedsPin, setHandoffNeedsPin] = useState(false);
  const [handoffErr, setHandoffErr] = useState<string | null>(null);
  const [handoffBusy, setHandoffBusy] = useState(false);
  // P0-5: merge two open checks into one.
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeInto, setMergeInto] = useState("");
  const [mergeErr, setMergeErr] = useState<string | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);

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

  // Phase A: live floor — subscribe to open_tickets changes so table state flips
  // on every device without a refresh (guest QR orders, another server firing,
  // dropping a check, paying out). A slow safety poll covers any missed event.
  useEffect(() => {
    const bid = register.businessId;
    if (!bid) {
      const id = setInterval(() => { refreshOpen(); }, 20000);
      return () => clearInterval(id);
    }
    const supabase = createBrowserClient();
    const channel = supabase
      .channel("floor-" + bid)
      .on("postgres_changes", { event: "*", schema: "public", table: "open_tickets", filter: "business_id=eq." + bid }, () => { refreshOpen(); })
      .subscribe();
    const id = setInterval(() => { refreshOpen(); }, 60000);
    return () => { supabase.removeChannel(channel); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Designed-layout bounds (the floor is scaled to fit its container).
  let canvasW = 600;
  let canvasH = 400;
  for (const e of elements) {
    canvasW = Math.max(canvasW, e.x + e.w + 60);
    canvasH = Math.max(canvasH, e.y + e.h + 60);
  }

  // Fit-to-container scale so the floor fills the space instead of floating
  // top-left. Set from a ResizeObserver (never synchronously in render).
  const mapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => {
      const cw = node.clientWidth;
      const ch = node.clientHeight;
      if (cw > 0 && ch > 0) {
        const s = Math.min(cw / canvasW, ch / canvasH);
        setScale(Math.max(0.4, Math.min(2, s)));
      }
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [canvasW, canvasH]);

  // Default to the handheld list view on phone-width screens (one-time, on mount).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) setView("list");
  }, []);

  async function refreshOpen() {
    const [rows, togoRows, tabRows] = await Promise.all([listOpenTableTickets(), listOpenTogoTickets(), listOpenBarTabs()]);
    const m: Record<string, TableTicketSummary> = {};
    for (const t of rows) m[t.element_id] = t;
    setOpenByElement(m);
    setTogo(togoRows);
    setTabs(tabRows);
  }

  function switchPlan(id: string) {
    if (id === activePlan || planLoading) return;
    setPlanLoading(true);
    startTransition(async () => {
      const { elements: els } = await listFloor(id);
      setElements(els);
      setActivePlan(id);
      setPlanLoading(false);
    });
  }

  // A table's seat count = how many chairs are drawn around it (fallback: guests).
  function seatsOf(elementId: string): number {
    return elements.filter((e) => e.kind === "seat" && e.parent_id === elementId).length;
  }

  function enterElement(el: FloorElement, guestCount: number | null) {
    setError(null);
    setPromptTable(null);
    const chairs = seatsOf(el.id);
    startTransition(async () => {
      const res = await openTableTicket(el.id, guestCount);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSelected({ elementId: el.id, ticketId: res.ticketId, tableLabel: el.label ?? "Table", cart: res.cart, serverName: null, seatCount: chairs > 0 ? chairs : guestCount, guestCount: guestCount });
    });
  }

  function resumeElement(el: FloorElement, ticketId: string, serverName: string | null) {
    setError(null);
    const chairs = seatsOf(el.id);
    startTransition(async () => {
      const res = await loadTableTicket(ticketId);
      if ("error" in res) {
        setError(res.error);
        await refreshOpen();
        return;
      }
      setSelected({ elementId: el.id, ticketId: ticketId, tableLabel: el.label ?? "Table", cart: res.cart, serverName: serverName, seatCount: chairs > 0 ? chairs : res.guestCount, guestCount: res.guestCount });
    });
  }

  // Tap a floor element: resume if open, else open it (tables ask guest count).
  function tapElement(el: FloorElement) {
    if (!isRingable(el.kind)) return;
    const open = openByElement[el.id];
    if (open && open.child_count > 0) {
      openSplitView(el, open);
    } else if (open) {
      resumeElement(el, open.id, open.server_name);
    } else if (el.kind === "table" || el.kind === "booth") {
      setGuests("");
      setPromptTable(el);
    } else {
      enterElement(el, null);
    }
  }

  // P0-4: open the split-check chooser for a table that's been split.
  function openSplitView(el: FloorElement, open: TableTicketSummary) {
    setError(null);
    startTransition(async () => {
      const children = await listChildTickets(open.id);
      setSplitView({ parentId: open.id, label: el.label ?? "Table", children });
    });
  }

  // Open one child check in the register to tender it (bound by ticket id, no
  // table element — so paying it closes just that check; the parent closes when
  // the last child is paid).
  function payChild(child: ChildTicket) {
    setSplitView(null);
    setSelected({ elementId: "", ticketId: child.id, tableLabel: child.label, cart: child.cart, serverName: null, seatCount: null, guestCount: null });
  }

  function handleUnsplit(parentId: string) {
    setError(null);
    startTransition(async () => {
      const res = await unsplitTicket(parentId);
      if ("error" in res) { setError(res.error); return; }
      setSplitView(null);
      await refreshOpen();
    });
  }

  function startTogo() {
    setError(null);
    const name = togoName.trim();
    const phone = togoPhone.trim();
    if (!name || !phone) {
      setError("Enter the customer's name and phone.");
      return;
    }
    setTogoOpen(false);
    startTransition(async () => {
      const res = await openTogoTicket(name, phone);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSelected({ elementId: "", ticketId: res.ticketId, tableLabel: "Takeout" + (res.name ? " · " + res.name : ""), cart: { items: [] }, serverName: null, seatCount: null, guestCount: null });
      setTogoName("");
      setTogoPhone("");
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
      setSelected({ elementId: "", ticketId: t.id, tableLabel: "Takeout" + (t.name ? " · " + t.name : ""), cart: res.cart, serverName: t.server_name, seatCount: null, guestCount: null });
    });
  }

  // P1-20: bar tabs — table-less checks identified by a name only.
  function startTab() {
    setError(null);
    const name = tabName.trim();
    if (!name) {
      setError("Enter a name for the tab.");
      return;
    }
    setTabOpen(false);
    startTransition(async () => {
      const res = await openBarTab(name);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSelected({ elementId: "", ticketId: res.ticketId, tableLabel: "Tab" + (res.name ? " · " + res.name : ""), cart: { items: [] }, serverName: null, seatCount: null, guestCount: null });
      setTabName("");
    });
  }

  function resumeTab(t: BarTabSummary) {
    setError(null);
    startTransition(async () => {
      const res = await loadTableTicket(t.id);
      if ("error" in res) {
        setError(res.error);
        await refreshOpen();
        return;
      }
      setSelected({ elementId: "", ticketId: t.id, tableLabel: "Tab" + (t.name ? " · " + t.name : ""), cart: res.cart, serverName: t.server_name, seatCount: null, guestCount: null });
    });
  }

  function exitToFloor() {
    setSelected(null);
    refreshOpen();
  }

  function openHandoff() {
    setHandoffFrom("");
    setHandoffTo("");
    setHandoffPin("");
    setHandoffNeedsPin(false);
    setHandoffErr(null);
    setHandoffOpen(true);
  }

  // Open checks eligible to merge (not split parents — those have child checks).
  const mergeableTables = elements
    .filter((e) => openByElement[e.id] && (openByElement[e.id].child_count ?? 0) === 0)
    .map((e) => ({ ticketId: openByElement[e.id].id, label: e.label ?? "Table" }));

  function openMerge() {
    setMergeFrom("");
    setMergeInto("");
    setMergeErr(null);
    setMergeOpen(true);
  }
  function submitMerge() {
    if (!mergeFrom || !mergeInto) { setMergeErr("Pick two checks."); return; }
    if (mergeFrom === mergeInto) { setMergeErr("Pick two different checks."); return; }
    setMergeErr(null);
    setMergeBusy(true);
    startTransition(async () => {
      const res = await mergeTickets(mergeFrom, mergeInto);
      setMergeBusy(false);
      if ("error" in res) { setMergeErr(res.error); return; }
      setMergeOpen(false);
      await refreshOpen();
    });
  }

  function submitHandoff() {
    if (!handoffFrom || !handoffTo) {
      setHandoffErr("Pick both servers.");
      return;
    }
    setHandoffErr(null);
    setHandoffBusy(true);
    startTransition(async () => {
      const res = await transferTables(handoffFrom, handoffTo, handoffNeedsPin ? handoffPin : undefined);
      setHandoffBusy(false);
      if ("needs_approval" in res) {
        setHandoffNeedsPin(true);
        setHandoffErr("A manager PIN is needed to hand off tables.");
        return;
      }
      if ("error" in res) {
        setHandoffErr(res.error);
        return;
      }
      setHandoffOpen(false);
      await refreshOpen();
    });
  }

  if (selected) {
    return (
      <RegisterClient
        key={selected.ticketId}
        {...register}
        tableBinding={{ tableId: selected.elementId, ticketId: selected.ticketId, tableLabel: selected.tableLabel, serverName: selected.serverName, seatCount: selected.seatCount, guestCount: selected.guestCount }}
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
    return (el.label ?? "").toLowerCase().includes(q)
      || (open?.server_name ?? "").toLowerCase().includes(q)
      || (open?.guests ?? "").toLowerCase().includes(q);
  }
  const visibleTogo = togo.filter(
    (t) => !q || (t.name ?? "").toLowerCase().includes(q) || (t.server_name ?? "").toLowerCase().includes(q)
  );
  const visibleTabs = tabs.filter(
    (t) => !q || (t.name ?? "").toLowerCase().includes(q) || (t.server_name ?? "").toLowerCase().includes(q)
  );

  // Open-ticket counts per server, for the handoff picker.
  const openCountByStaff: Record<string, number> = {};
  for (const t of Object.values(openByElement)) if (t.staff_id) openCountByStaff[t.staff_id] = (openCountByStaff[t.staff_id] || 0) + 1;
  for (const t of togo) if (t.staff_id) openCountByStaff[t.staff_id] = (openCountByStaff[t.staff_id] || 0) + 1;
  for (const t of tabs) if (t.staff_id) openCountByStaff[t.staff_id] = (openCountByStaff[t.staff_id] || 0) + 1;
  const serversWithOpen = staff.filter((s) => (openCountByStaff[s.id] || 0) > 0);

  const ordered = [...elements].sort((a, b) => zFor(a.kind) - zFor(b.kind));
  const ringableCount = elements.filter((e) => isRingable(e.kind)).length;

  function decorClass(kind: ElementKind): string {
    if (kind === "wall") return "bg-foreground/25";
    if (kind === "room") return "bg-muted/40 border-2 border-dashed border-border text-muted-foreground";
    if (kind === "seat") return "bg-muted border border-border";
    return "bg-transparent text-muted-foreground";
  }

  // Turn-time status: seated → warn (yellow) → late (red). Thresholds are
  // configurable in Settings (businesses.settings.table_aging).
  function tableStatus(open: TableTicketSummary | undefined): "available" | "noorder" | "seated" | "warn" | "late" {
    if (!open) return "available";
    const m = minutesOpen(open.opened_at);
    // Elapsed time wins: a genuinely stale check escalates to Warning/Late no
    // matter its order state, so a multi-hour/day-old check can never sit blue.
    if (m >= aging.redMin) return "late";
    if (m >= aging.yellowMin) return "warn";
    // Only a *fresh* check with nothing ordered yet stays neutral (not flagged).
    if (open.item_count <= 0 || open.subtotal <= 0) return "noorder";
    return "seated";
  }
  function statusClass(s: "available" | "noorder" | "seated" | "warn" | "late"): string {
    switch (s) {
      // Occupied, no order: neutral fill + teal outline — clearly seated, never critical.
      case "noorder": return "bg-table-available-bg border-table-seated-border text-foreground shadow-elevation-sm";
      case "seated": return "bg-table-seated-bg border-table-seated-border text-table-seated-fg shadow-elevation-sm";
      case "warn": return "bg-table-warn-bg border-table-warn-border text-table-warn-fg shadow-elevation-sm";
      case "late": return "bg-table-late-bg border-table-late-border text-table-late-fg shadow-elevation-sm";
      default: return "bg-table-available-bg border-table-available-border text-foreground shadow-elevation-sm hover:border-foreground/40 hover:shadow-elevation";
    }
  }

  // Phase A: explicit lifecycle state (seated → ordered → fired → check-dropped),
  // independent of the time-aged color. Shown as a small label on each table.
  function lifecycleState(open: TableTicketSummary | undefined): { label: string; cls: string } | null {
    if (!open) return null;
    if (open.check_dropped_at) return { label: "Check dropped", cls: "text-violet-600" };
    if (open.fired) return { label: "Fired", cls: "text-emerald-600" };
    if (open.item_count > 0) return { label: "Ordered", cls: "text-sky-600" };
    return { label: "Seated", cls: "text-muted-foreground" };
  }

  // Live summary for the toolbar.
  const ringEls = elements.filter((e) => isRingable(e.kind));
  const seatedCount = ringEls.filter((e) => openByElement[e.id]).length;
  const overdue = ringEls.filter((e) => {
    const o = openByElement[e.id];
    // Only count tables with an actual order as overdue (matches tableStatus).
    return o && o.item_count > 0 && minutesOpen(o.opened_at) >= aging.redMin;
  }).length;

  return (
    <div className="h-full flex flex-col">
      {/* One toolbar */}
      <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b border-border bg-card">
        <span className="font-semibold truncate">{register.businessName}</span>
        {plans.length > 1 && (
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {plans.map((pl) => (
              <button key={pl.id} type="button" onClick={() => switchPlan(pl.id)} disabled={planLoading} className={"text-xs rounded-md px-2.5 py-1 transition-colors " + (pl.id === activePlan ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
                {pl.name}
              </button>
            ))}
          </div>
        )}
        {ringEls.length > 0 && (
          <span className="text-xs text-muted-foreground hidden md:inline tabular-nums">
            {seatedCount + " of " + ringEls.length + " seated" + (overdue > 0 ? "  ·  " + overdue + " over " + aging.redMin + "m" : "")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {(["map", "list"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={"text-xs rounded-md px-2.5 py-1 capitalize transition-colors " + (view === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
                {v}
              </button>
            ))}
          </div>
          <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a check" className="h-9 w-40 sm:w-48" />
          {serversWithOpen.length > 0 && staff.length > 1 && (
            <Button variant="outline" className="h-9 hidden sm:inline-flex" onClick={openHandoff}>Handoff</Button>
          )}
          {mergeableTables.length >= 2 && (
            <Button variant="outline" className="h-9 hidden sm:inline-flex" onClick={openMerge}>Merge</Button>
          )}
          {(reservationSummary.waitlist > 0 || reservationSummary.next) && (
            <Link href="/app/reservations" className="flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-border text-sm hover:bg-accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              {reservationSummary.waitlist > 0 && (
                <span className="tabular-nums">Waitlist {reservationSummary.waitlist}</span>
              )}
              {reservationSummary.next && (
                <span className="hidden md:inline text-muted-foreground truncate max-w-[140px]">
                  {(reservationSummary.waitlist > 0 ? "· " : "") + "Next " + fmtClock(reservationSummary.next.at) + " " + reservationSummary.next.name}
                </span>
              )}
            </Link>
          )}
          <Button variant="outline" className="h-9" onClick={() => { setTogoName(""); setTogoPhone(""); setTogoOpen(true); }}>New to-go</Button>
          <Button variant="outline" className="h-9" onClick={() => { setTabName(""); setTabOpen(true); }}>New tab</Button>
          <Link href="/app" className="flex items-center gap-1.5 text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Exit
          </Link>
        </div>
      </div>

      {/* Floor + takeout column */}
      <div className="flex-1 min-h-0 flex">
        {view === "list" ? (
        <div className="flex-1 min-h-0 overflow-y-auto bg-background p-2">
          {ringableCount === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Your floor is empty. Design it in Settings &rarr; Floor.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {ordered
                .filter((el) => isRingable(el.kind) && matchesFind(el))
                .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "", undefined, { numeric: true }))
                .map((el) => {
                  const open = openByElement[el.id];
                  const status = tableStatus(open);
                  return (
                    <button
                      key={el.id}
                      type="button"
                      disabled={pending}
                      onClick={() => tapElement(el)}
                      className={"rounded-xl border p-3.5 min-h-[68px] text-left active:scale-[0.98] transition-transform disabled:opacity-60 " + statusClass(status)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-base truncate">{el.label ?? "Table"}</span>
                        {open && <span className="tabular-nums text-sm font-medium">{"$" + open.subtotal.toFixed(2)}</span>}
                      </div>
                      <div className="text-[11px] mt-0.5 truncate opacity-80">
                        {open
                          ? formatDuration(minutesOpen(open.opened_at)) + (open.server_name ? " · " + open.server_name : "") + (open.child_count && open.child_count > 0 ? " · split" : "")
                          : "Available"}
                      </div>
                      {open && (() => { const ls = lifecycleState(open); return ls ? <div className={"text-[10px] font-semibold mt-0.5 " + ls.cls}>{ls.label}</div> : null; })()}
                    </button>
                  );
                })}
            </div>
          )}
          {error && <p className="text-sm text-red-600 p-2">{error}</p>}
        </div>
        ) : (
        <div ref={mapRef} className="flex-1 min-h-0 relative overflow-hidden bg-background">
          {ringableCount === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="text-sm text-muted-foreground max-w-md text-center">
                Your floor is empty. Design it in Settings &rarr; Floor &mdash; add
                tables, booths, counters, walls and rooms &mdash; and it shows up
                here as your map.
              </p>
            </div>
          ) : (
            <div
              className="absolute"
              style={{
                width: canvasW, height: canvasH, left: "50%", top: "50%",
                transform: "translate(-50%, -50%) scale(" + scale + ")", transformOrigin: "center",
              }}
            >
              {/* Chairs are designed in Settings; the live floor stays clean. */}
              {ordered.filter((el) => el.kind !== "seat").map((el) => {
                const ring = isRingable(el.kind);
                const open = ring ? openByElement[el.id] : undefined;
                const dim = q && ring && !matchesFind(el);
                const radius = el.shape === "round" ? 9999 : el.kind === "wall" ? 2 : 12;
                const baseStyle = {
                  left: el.x, top: el.y, width: el.w, height: el.h, borderRadius: radius,
                  transform: el.rotation ? "rotate(" + el.rotation + "deg)" : undefined,
                  zIndex: zFor(el.kind), opacity: dim ? 0.3 : 1,
                } as const;

                if (!ring) {
                  return (
                    <div key={el.id} className={"absolute flex items-center justify-center text-[10px] overflow-hidden " + decorClass(el.kind)} style={baseStyle}>
                      {el.label ? <span className="px-1 truncate">{el.label}</span> : null}
                    </div>
                  );
                }

                const status = tableStatus(open);
                const seats = seatsOf(el.id);
                const isTable = el.kind === "table" || el.kind === "booth";
                const fallback = el.kind === "counter" ? "Counter" : el.kind === "station" ? "Station" : "Table";
                const displayLabel = el.label && el.label.trim() ? el.label : fallback;
                // Short nodes (wide bars / counters) can't stack name + status + extra
                // lines without colliding. On those, show just the name — the node's
                // colour already conveys the status — so labels never overlap or clip.
                const short = el.h < 56;
                // P0-11: the table's section is shown as a small CORNER DOT (not a
                // full-edge band, which read like a status colour) so section ≠ status.
                const sec = el.section_id ? sectionById.get(el.section_id) : null;
                const secColor = sec?.color ?? null;
                const tileStyle = baseStyle;
                return (
                  <button
                    key={el.id}
                    type="button"
                    disabled={pending}
                    onClick={() => tapElement(el)}
                    className={"absolute overflow-hidden border p-1.5 flex flex-col items-center text-center leading-tight gap-0.5 active:scale-[0.97] transition-all " + (isTable || short ? "justify-center " : "justify-start ") + statusClass(status)}
                    style={tileStyle}
                  >
                    {/* Section color = a corner dot (a tag), never a status edge. */}
                    {secColor && (
                      <span className="absolute top-1 left-1 w-2 h-2 rounded-full ring-1 ring-black/30" style={{ backgroundColor: secColor }} aria-hidden="true" />
                    )}
                    {/* P2-27: a guest placed a new order via QR awaiting the server.
                        Auto-expire the badge after a few minutes so it can't go stale
                        (there's no per-order timestamp; use the check's open time). */}
                    {open && open.new_guest_items && minutesOpen(open.opened_at) < 15 && (
                      <span className="absolute top-1 right-1 flex items-center gap-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-semibold px-1.5 py-0.5 leading-none">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        New
                      </span>
                    )}
                    {secColor && !open && sec?.server && <span className="text-[10px] truncate max-w-full" style={{ color: secColor }}>{sec.server}</span>}
                    <span className="text-sm font-medium truncate max-w-full">{displayLabel}</span>
                    {open ? (
                      <>
                        <span className="text-sm tabular-nums font-medium">{"$" + open.subtotal.toFixed(2)}</span>
                        {!short && <span className="text-[11px] opacity-80 truncate max-w-full">{formatDuration(minutesOpen(open.opened_at)) + (open.server_name ? " · " + open.server_name : "")}</span>}
                      </>
                    ) : (
                      !short && (
                        <>
                          {isTable && <span className="text-[11px] rounded-full bg-background/60 border border-border px-2 py-0.5 text-muted-foreground">{(seats > 0 ? seats : 2) + " seats"}</span>}
                          <span className="text-[11px] text-muted-foreground">Available</span>
                        </>
                      )
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {error && <p className="text-sm text-red-600 absolute bottom-2 left-3 z-10">{error}</p>}
          {/* Status-color legend key — one unambiguous mapping; section is a dot. */}
          <div className="absolute bottom-2 right-2 z-10 hidden sm:flex items-center gap-3 rounded-lg border border-border bg-card/90 backdrop-blur px-3 py-1.5 text-[10px] text-muted-foreground shadow-elevation-sm">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm border bg-table-available-bg border-table-available-border" />Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm border bg-table-seated-bg border-table-seated-border" />Occupied</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm border bg-table-warn-bg border-table-warn-border" />Warning</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm border bg-table-late-bg border-table-late-border" />Late</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-foreground/40" />Section</span>
          </div>
        </div>
        )}

        {/* Takeout side column */}
        {(visibleTogo.length > 0 || visibleTabs.length > 0) && (
          <aside className="shrink-0 w-52 border-l border-border bg-card overflow-y-auto p-2 space-y-2">
            {visibleTabs.length > 0 && (
              <>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 pt-1">Bar tabs</div>
                {visibleTabs.map((t) => (
                  <button key={t.id} type="button" disabled={pending} onClick={() => resumeTab(t)} className="w-full text-left rounded-lg border border-border bg-accent/40 p-2.5 active:scale-[0.98] transition-transform">
                    <div className="font-medium text-sm truncate">{t.name ?? "Tab"}</div>
                    <div className="text-sm tabular-nums font-medium">{"$" + t.subtotal.toFixed(2)}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{(t.server_name ? t.server_name + "  ·  " : "") + formatDuration(minutesOpen(t.opened_at))}</div>
                  </button>
                ))}
              </>
            )}
            {visibleTogo.length > 0 && (
              <>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 pt-1">Takeout</div>
                {visibleTogo.map((t) => (
                  <button key={t.id} type="button" disabled={pending} onClick={() => resumeTogo(t)} className="w-full text-left rounded-lg border border-table-warn-border bg-table-warn-bg p-2.5 active:scale-[0.98] transition-transform">
                    <div className="font-medium text-sm truncate text-table-warn-fg">{t.name ?? "Takeout"}</div>
                    <div className="text-sm tabular-nums font-medium">{"$" + t.subtotal.toFixed(2)}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{(t.phone ? t.phone + "  ·  " : "") + formatDuration(minutesOpen(t.opened_at))}</div>
                  </button>
                ))}
              </>
            )}
          </aside>
        )}
      </div>

      {handoffOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setHandoffOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Hand off tables</h3>
              <button type="button" onClick={() => setHandoffOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Move every open table and to-go owned by one server to another.</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">From server</Label>
                <select value={handoffFrom} onChange={(e) => setHandoffFrom(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                  <option value="">Select…</option>
                  {serversWithOpen.map((s) => (
                    <option key={s.id} value={s.id}>{s.name + " (" + (openCountByStaff[s.id] || 0) + ")"}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To server</Label>
                <select value={handoffTo} onChange={(e) => setHandoffTo(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                  <option value="">Select…</option>
                  {staff.filter((s) => s.id !== handoffFrom).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              {handoffNeedsPin && (
                <div className="space-y-1">
                  <Label className="text-xs">Manager PIN</Label>
                  <Input type="password" inputMode="numeric" value={handoffPin} onChange={(e) => setHandoffPin(e.target.value)} placeholder="4-6 digits" className="h-10" />
                </div>
              )}
              <Button className="w-full h-11 mt-1" onClick={submitHandoff} disabled={handoffBusy || !handoffFrom || !handoffTo}>
                {handoffBusy ? "Transferring…" : "Transfer tables"}
              </Button>
              {handoffErr && <p className="text-sm text-red-600">{handoffErr}</p>}
            </div>
          </div>
        </div>
      )}

      {/* P0-5: merge two open checks */}
      {mergeOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setMergeOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Merge checks</h3>
              <button type="button" onClick={() => setMergeOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Move one open check&apos;s items onto another. The source table is freed.</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Move this check</Label>
                <select value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                  <option value="">Select…</option>
                  {mergeableTables.map((t) => (
                    <option key={t.ticketId} value={t.ticketId}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Into</Label>
                <select value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                  <option value="">Select…</option>
                  {mergeableTables.filter((t) => t.ticketId !== mergeFrom).map((t) => (
                    <option key={t.ticketId} value={t.ticketId}>{t.label}</option>
                  ))}
                </select>
              </div>
              <Button className="w-full h-11 mt-1" onClick={submitMerge} disabled={mergeBusy || !mergeFrom || !mergeInto}>
                {mergeBusy ? "Merging…" : "Merge checks"}
              </Button>
              {mergeErr && <p className="text-sm text-red-600">{mergeErr}</p>}
            </div>
          </div>
        </div>
      )}

      {togoOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setTogoOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">New takeout order</h3>
              <button type="button" onClick={() => setTogoOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <div className="space-y-2 mb-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer name</Label>
                <Input value={togoName} onChange={(e) => setTogoName(e.target.value)} placeholder="Name" className="h-11" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone number</Label>
                <Input type="tel" inputMode="tel" value={togoPhone} onChange={(e) => setTogoPhone(e.target.value)} placeholder="(555) 123-4567" className="h-11" />
              </div>
            </div>
            <Button className="w-full h-12" disabled={pending || !togoName.trim() || !togoPhone.trim()} onClick={startTogo}>Start takeout</Button>
          </div>
        </div>
      )}

      {tabOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setTabOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">New bar tab</h3>
              <button type="button" onClick={() => setTabOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <div className="space-y-1 mb-3">
              <Label className="text-xs">Tab name</Label>
              <Input value={tabName} onChange={(e) => setTabName(e.target.value)} placeholder="Name or description" className="h-11" onKeyDown={(e) => { if (e.key === "Enter") startTab(); }} />
            </div>
            <Button className="w-full h-12" disabled={pending || !tabName.trim()} onClick={startTab}>Open tab</Button>
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

      {/* P0-4: split-check chooser — pay each guest's check independently. */}
      {splitView && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setSplitView(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">{splitView.label + " — split"}</h3>
              <button type="button" onClick={() => setSplitView(null)} className="text-xs text-muted-foreground underline">Close</button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{splitView.children.length + " check" + (splitView.children.length === 1 ? "" : "s") + " still to pay. Tap one to tender it."}</p>
            <div className="space-y-2">
              {splitView.children.map((c) => (
                <button key={c.id} type="button" onClick={() => payChild(c)} className="w-full flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent text-left">
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-sm tabular-nums">{"$" + c.subtotal.toFixed(2) + " +tax"}</span>
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full h-10 mt-3" disabled={pending} onClick={() => handleUnsplit(splitView.parentId)}>
              Un-split (merge back)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
