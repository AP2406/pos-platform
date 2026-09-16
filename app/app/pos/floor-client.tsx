"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/lib/format";
import { partySummary } from "@surge/api-contracts";
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
  listTableMoveTargets,
  moveTicketToTable,
  renameParty,
  setTicketServer,
  type TableCart,
  type TableTicketSummary,
  type TogoTicketSummary,
  type BarTabSummary,
  type ChildTicket,
} from "./ticket-actions";
import { listFloor, type FloorElement, type ElementKind, type FloorPlan } from "../floor/floor-actions";
import { listKitchenMessages, ackKitchenMessage, type KitchenMessage } from "../kitchen/actions";
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
// Turn-time status, named once so the tile class, the dot class and the
// screen-reader label can't drift apart.
type TableStatus = "available" | "noorder" | "seated" | "warn" | "late";
type Selected = { elementId: string; ticketId: string; tableLabel: string; cart: TableCart; serverName: string | null; seatCount: number | null; guestCount: number | null; ticketType?: "tab"; heldAuthCents?: number | null };

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
// "Johnson · 4 guests", or whichever half we actually know. The iPad floor
// draws the same line from the same helper.
function partyLine(open: { party_name: string | null; guest_count: number | null }): string {
  return partySummary(open.party_name, open.guest_count);
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
  // The party's name, captured at the door and editable afterwards.
  const [partyName, setPartyName] = useState("");
  const [renameFor, setRenameFor] = useState<{ ticketId: string; label: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // The table options menu. `at` is where the press landed, so the menu opens
  // under the finger; null means "centre it", which is what the toolbar button
  // and the keyboard path want.
  const [menuFor, setMenuFor] = useState<
    { el: FloorElement; open: TableTicketSummary; at: { x: number; y: number } | null } | null
  >(null);
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
  // THE TABLE ACTION STRIP (UI handoff, screen 01).
  //
  // The handoff's own implementation note is "Table actions should require a
  // selected table", and this screen had no notion of a selected table: tapping
  // a table opens its check in the register, which is the gesture every server
  // already has in their hands and is not something a restyle gets to change.
  // So selection is an explicit control of its own — the first thing in the
  // strip — and every action is disabled, with the reason spelled out, until it
  // holds a table. Only OPEN tables are offered: both wired actions operate on
  // a ticket, and a table with no check has nothing to transfer or reassign.
  const [actionTableId, setActionTableId] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargets, setMoveTargets] = useState<{ elementId: string; label: string; occupied: boolean }[]>([]);
  const [moveErr, setMoveErr] = useState<string | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPin, setAssignPin] = useState("");
  const [assignNeedsPin, setAssignNeedsPin] = useState(false);
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
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
    const refreshMsgs = () => { listKitchenMessages().then(setKmsgs).catch(() => {}); };
    refreshMsgs();
    const channel = supabase
      .channel("floor-" + bid)
      .on("postgres_changes", { event: "*", schema: "public", table: "open_tickets", filter: "business_id=eq." + bid }, () => { refreshOpen(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_messages", filter: "business_id=eq." + bid }, () => { refreshMsgs(); })
      .subscribe();
    const id = setInterval(() => { refreshOpen(); refreshMsgs(); }, 60000);
    return () => { supabase.removeChannel(channel); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // B8: live kitchen → server messages, shown as a dismissible banner.
  const [kmsgs, setKmsgs] = useState<KitchenMessage[]>([]);
  function ackMsg(id: string) {
    setKmsgs((prev) => prev.filter((m) => m.id !== id));
    ackKitchenMessage(id).catch(() => {});
  }

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

  function enterElement(el: FloorElement, guestCount: number | null, party?: string | null) {
    setError(null);
    setPromptTable(null);
    const chairs = seatsOf(el.id);
    startTransition(async () => {
      const res = await openTableTicket(el.id, guestCount, party ?? null);
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
      setPartyName("");
      setPromptTable(el);
    } else {
      enterElement(el, null);
    }
  }

  // --- the table options menu -------------------------------------------------
  // Press and hold a table to act on it, instead of finding it again in a
  // dropdown you have already pointed at with your finger. The menu does not
  // own any behaviour: it sets the same `actionTableId` the strip sets and
  // calls the same functions, so Transfer table and Assign server keep their
  // existing dialogs, permission gates and audit trail.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressFired = useRef(false);

  function openTableMenu(el: FloorElement, open: TableTicketSummary, at: { x: number; y: number } | null) {
    setError(null);
    setActionTableId(el.id);
    setMenuFor({ el, open, at });
  }
  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }
  // True when the click that follows was really the end of a long press, and
  // should not also open the check.
  function consumePress(): boolean {
    if (!pressFired.current) return false;
    pressFired.current = false;
    return true;
  }
  function pressHandlers(el: FloorElement) {
    const open = openByElement[el.id];
    if (!open) return {}; // an empty table has nothing to act on yet
    const start = (x: number, y: number) => {
      pressFired.current = false;
      cancelPress();
      pressTimer.current = setTimeout(() => {
        pressFired.current = true;
        openTableMenu(el, open, { x, y });
      }, 450);
    };
    return {
      onPointerDown: (e: React.PointerEvent) => start(e.clientX, e.clientY),
      onPointerUp: cancelPress,
      onPointerLeave: cancelPress,
      onPointerCancel: cancelPress,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        openTableMenu(el, open, { x: e.clientX, y: e.clientY });
      },
    };
  }

  // Rename the party at a table. The name lives on the check, so this is a
  // check-level edit that happens to be reached from the floor.
  function doRenameParty() {
    const target = renameFor;
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const res = await renameParty(target.ticketId, renameValue);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setRenameFor(null);
      await refreshOpen();
    });
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
      setSelected({ elementId: "", ticketId: res.ticketId, tableLabel: "Tab" + (res.name ? " · " + res.name : ""), cart: { items: [] }, serverName: null, seatCount: null, guestCount: null, ticketType: "tab", heldAuthCents: null });
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
      setSelected({ elementId: "", ticketId: t.id, tableLabel: "Tab" + (t.name ? " · " + t.name : ""), cart: res.cart, serverName: t.server_name, seatCount: null, guestCount: null, ticketType: "tab", heldAuthCents: t.held_auth_cents });
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

  // --- table action strip: transfer table ------------------------------------
  // Straight onto the same pair of server actions the register's "Move table"
  // uses (P0-7). Nothing new server-side, and no money math: moving a check
  // re-points it at another element, or merges it into that element's check.
  function openMoveTable(ticketId: string) {
    setMoveErr(null);
    setMoveTargets([]);
    setMoveOpen(true);
    startTransition(async () => {
      setMoveTargets(await listTableMoveTargets(ticketId));
    });
  }
  function doMoveTable(ticketId: string, elementId: string) {
    setMoveErr(null);
    setMoveBusy(true);
    startTransition(async () => {
      const res = await moveTicketToTable(ticketId, elementId);
      setMoveBusy(false);
      if ("error" in res) { setMoveErr(res.error); return; }
      setMoveOpen(false);
      setActionTableId(""); // the check no longer lives on the table that was picked
      await refreshOpen();
    });
  }

  // --- table action strip: assign server -------------------------------------
  // setTicketServer() is the permission gate, not this component: taking a
  // table that belongs to someone else, as staff or a trainee, comes back
  // `needs_approval` and the manager PIN is collected here exactly as the
  // handoff dialog already does it. The change is reason-coded into the audit
  // trail server-side either way.
  function openAssign() {
    setAssignErr(null);
    setAssignPin("");
    setAssignNeedsPin(false);
    setAssignOpen(true);
  }
  function doAssign(ticketId: string, staffId: string) {
    setAssignErr(null);
    setAssignBusy(true);
    startTransition(async () => {
      const res = await setTicketServer(ticketId, staffId, assignPin || undefined);
      setAssignBusy(false);
      if ("needs_approval" in res) {
        setAssignNeedsPin(true);
        setAssignErr("A manager PIN is needed to take another server's table.");
        return;
      }
      if ("error" in res) { setAssignErr(res.error); return; }
      setAssignOpen(false);
      setAssignPin("");
      setAssignNeedsPin(false);
      await refreshOpen();
    });
  }

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
        tableBinding={{ tableId: selected.elementId, ticketId: selected.ticketId, tableLabel: selected.tableLabel, serverName: selected.serverName, seatCount: selected.seatCount, guestCount: selected.guestCount, ticketType: selected.ticketType, heldAuthCents: selected.heldAuthCents }}
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
      // "Find a check" now finds it by the party's name, which is the thing a
      // host is most likely to be asked for at the door: "where are the Johnsons?"
      || (open?.party_name ?? "").toLowerCase().includes(q)
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
  function tableStatus(open: TableTicketSummary | undefined): TableStatus {
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
  function statusClass(s: TableStatus): string {
    switch (s) {
      // Occupied, no order: neutral fill + teal outline — clearly seated, never critical.
      case "noorder": return "bg-table-available-bg border-table-seated-border text-foreground shadow-elevation-sm";
      case "seated": return "bg-table-seated-bg border-table-seated-border text-table-seated-fg shadow-elevation-sm";
      case "warn": return "bg-table-warn-bg border-table-warn-border text-table-warn-fg shadow-elevation-sm";
      case "late": return "bg-table-late-bg border-table-late-border text-table-late-fg shadow-elevation-sm";
      default: return "bg-table-available-bg border-table-available-border text-foreground shadow-elevation-sm hover:border-foreground/40 hover:shadow-elevation";
    }
  }
  // The status DOT — the handoff's one structural change to this screen.
  // In dark, every occupied tile is now the same subdued slate (see the
  // --table-* tokens in globals.css) and this badge is the only thing carrying
  // the status colour, so a floor full of stale checks reads as a floor with
  // dots on it instead of a wall of red you can't read a table number off.
  // Light still tints the tile as well; the dot is drawn in both themes so the
  // component doesn't have to know which one it is in.
  // `available` returns null on purpose: an empty table is not a condition.
  function statusDotClass(s: TableStatus): string | null {
    switch (s) {
      case "noorder":
      case "seated": return "bg-table-dot-occupied";
      case "warn": return "bg-table-dot-warn";
      case "late": return "bg-table-dot-late";
      default: return null;
    }
  }
  // Colour is now the primary carrier of status on this screen, so every tile
  // also says it in words for a screen reader (and for anyone who can't tell
  // the amber dot from the red one).
  function statusLabel(s: TableStatus): string {
    switch (s) {
      case "noorder":
      case "seated": return "Occupied";
      case "warn": return "Warning — over " + aging.yellowMin + " minutes";
      case "late": return "Late — over " + aging.redMin + " minutes";
      default: return "Available";
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

  // The tables the action strip can act on, and the one currently picked.
  const actionTargets = ringEls
    .filter((e) => openByElement[e.id])
    .map((e) => ({
      elementId: e.id,
      ticketId: openByElement[e.id].id,
      label: e.label ?? "Table",
      childCount: openByElement[e.id].child_count ?? 0,
      serverName: openByElement[e.id].server_name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const actionTarget = actionTargets.find((t) => t.elementId === actionTableId) ?? null;
  // Why a control is off, in the words the operator needs. A disabled button
  // with no reason is the same problem as a dead one.
  const actionReason = actionTargets.length === 0
    ? "No open checks on this floor yet."
    : !actionTarget
      ? "Pick a table first."
      : null;
  // Per-action reasons ("un-split it first", "no staff on file") moved into the
  // options menu, which is now the only place those actions are offered — they
  // belong next to the row they disable, not in a strip the operator has to
  // read separately.

  return (
    <div className="h-full flex flex-col">
      {/* B8: live kitchen → server messages */}
      {kmsgs.length > 0 && (
        <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10">
          {kmsgs.map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">🔔 Kitchen{m.toName ? " → " + m.toName : ""}:</span>
              <span className="flex-1 min-w-0 truncate">{m.body}</span>
              <button type="button" onClick={() => ackMsg(m.id)} className="text-xs underline shrink-0">Got it</button>
            </div>
          ))}
        </div>
      )}
      {/* One toolbar.
          Restyled to the handoff: the workspace name is the page's heading
          rather than another line of body text, the two segmented controls get
          the blue active state the mockup uses for "you are here", and every
          control in the row is the same 44px tall so the row reads as one
          object. The gutter opens up on wide screens (the handoff asks for 40px
          and the mockup is 2048 wide) and stays tight on a handheld. */}
      <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-6 lg:px-10 py-3 border-b border-border bg-card">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">{register.businessName}</h1>
        {plans.length > 1 && (
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {plans.map((pl) => (
              <button key={pl.id} type="button" onClick={() => switchPlan(pl.id)} disabled={planLoading} aria-pressed={pl.id === activePlan} className={"u-tx text-sm rounded-md px-3 h-9 font-medium " + (pl.id === activePlan ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {pl.name}
              </button>
            ))}
          </div>
        )}
        {ringEls.length > 0 && (
          <span className="text-sm text-muted-foreground hidden md:inline tabular-nums">
            {seatedCount + " of " + ringEls.length + " seated" + (overdue > 0 ? "  ·  " + overdue + " over " + aging.redMin + "m" : "")}
          </span>
        )}
        {/* Wraps on a handheld. The outer row already wrapped but this cluster
            did not, so at 375 the trailing buttons ran off the right edge and
            took the whole screen into horizontal scroll. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {(["map", "list"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={"u-tx text-sm rounded-md px-3 h-9 capitalize font-medium " + (view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {v}
              </button>
            ))}
          </div>
          <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a check" className="h-11 w-40 sm:w-48" />
          {serversWithOpen.length > 0 && staff.length > 1 && (
            <Button variant="outline" className="h-11 hidden sm:inline-flex" onClick={openHandoff}>Handoff</Button>
          )}
          {mergeableTables.length >= 2 && (
            <Button variant="outline" className="h-11 hidden sm:inline-flex" onClick={openMerge}>Merge</Button>
          )}
          {(reservationSummary.waitlist > 0 || reservationSummary.next) && (
            <Link href="/app/reservations" className="u-tx flex items-center gap-1.5 h-11 px-3 rounded-md border border-border text-sm hover:bg-accent">
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
          <Button variant="outline" className="h-11" onClick={() => { setTogoName(""); setTogoPhone(""); setTogoOpen(true); }}>New to-go</Button>
          <Button variant="outline" className="h-11" onClick={() => { setTabName(""); setTabOpen(true); }}>New tab</Button>
          <Link href="/app" className="u-tx flex items-center gap-1.5 h-11 px-3 text-sm rounded-md border border-border hover:bg-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Exit
          </Link>
        </div>
      </div>

      {/* THE TABLE ACTION STRIP — the one net-new piece on this screen.
          Two of the handoff's four actions are here because two of them are
          reachable from the floor without re-implementing money handling:
          Transfer table and Assign server both take a ticket id and nothing
          else. Split bill and Print check are NOT here and are not stubbed —
          both need the live cart (a split has to partition to the cent; a bill
          has to price discounts, comps, service charge and tax), which only the
          register holds. A control that looks like a button and isn't one is
          worse than no control.
          Hidden below `sm`: on a handheld the floor is the list view and both
          actions are already in the register, one tap away. */}
      <div className="shrink-0 hidden sm:flex flex-wrap items-center gap-2 px-3 sm:px-6 lg:px-10 py-2 border-b border-border bg-card/60">
        <label htmlFor="floor-action-table" className="text-xs uppercase tracking-wide text-muted-foreground">Table</label>
        <select
          id="floor-action-table"
          value={actionTableId}
          onChange={(e) => setActionTableId(e.target.value)}
          disabled={actionTargets.length === 0}
          className="u-tx u-focus h-11 min-w-[9rem] rounded-md border border-border bg-transparent text-foreground px-2 text-sm disabled:opacity-50"
        >
          <option value="">{actionTargets.length === 0 ? "No open checks" : "Select a table…"}</option>
          {actionTargets.map((t) => (
            <option key={t.elementId} value={t.elementId}>{t.label + (t.serverName ? " · " + t.serverName : "")}</option>
          ))}
        </select>
        {/* One button, not one per action. The actions now live in the table's
            own options menu — press and hold any table to get it under your
            finger. This is the keyboard and mouse route to the same menu, and
            the reason the strip still exists: a long press has no keyboard
            equivalent. */}
        <Button
          variant="outline"
          className="h-11"
          disabled={!actionTarget || pending}
          title={actionReason ?? "Actions for this table"}
          onClick={() => {
            const el = elements.find((e) => e.id === actionTableId);
            const open = actionTableId ? openByElement[actionTableId] : undefined;
            if (el && open) openTableMenu(el, open, null);
          }}
        >
          Table options
        </Button>
        <span className="text-xs text-muted-foreground">
          {actionReason ?? "Tip: press and hold a table on the floor for the same menu."}
        </span>
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
                      onClick={() => { if (consumePress()) return; tapElement(el); }}
                      {...pressHandlers(el)}
                      className={"rounded-lg border p-3.5 min-h-[68px] text-left active:scale-[0.98] transition-transform disabled:opacity-60 " + statusClass(status)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          {/* Same badge as the map tile, same reason. */}
                          {(() => { const dot = statusDotClass(status); return dot ? <span className={"shrink-0 w-2 h-2 rounded-full " + dot} aria-hidden="true" /> : null; })()}
                          <span className="font-semibold text-base truncate">{el.label ?? "Table"}</span>
                          <span className="sr-only">{statusLabel(status)}</span>
                        </span>
                        {open && <span className="tabular-nums text-sm font-medium">{"$" + open.subtotal.toFixed(2)}</span>}
                      </div>
                      {open && partyLine(open) && (
                        <div className="text-[11px] mt-0.5 truncate font-medium">{partyLine(open)}</div>
                      )}
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
              {/* CHAIRS ARE DRAWN NOW. They used to be filtered out here —
                  "the live floor stays clean" — and the handoff's floor plan is
                  the argument against that: a rectangle labelled "Table 4" is a
                  diagram, a round top with six chairs around it is the room. It
                  is also how a server finds the right table at a glance without
                  reading a single label. They cost nothing to render (they are
                  already in `elements`, already positioned, already below the
                  tables in z-order) and they are not interactive. Floors whose
                  designer never placed chairs look exactly as they did. */}
              {ordered.map((el) => {
                const ring = isRingable(el.kind);
                const open = ring ? openByElement[el.id] : undefined;
                const dim = q && ring && !matchesFind(el);
                // 8px corners, per the handoff. Chairs get a tighter 6 so a seat
                // pad doesn't read as a small table.
                const radius = el.shape === "round" ? 9999 : el.kind === "wall" ? 2 : el.kind === "seat" ? 6 : 8;
                const baseStyle = {
                  left: el.x, top: el.y, width: el.w, height: el.h, borderRadius: radius,
                  transform: el.rotation ? "rotate(" + el.rotation + "deg)" : undefined,
                  zIndex: zFor(el.kind), opacity: dim ? 0.3 : 1,
                } as const;

                if (!ring) {
                  // A labelled seat is a BAR STOOL — the editor numbers a
                  // counter's seats (101, 102 …) so a server can say which one.
                  // It has to read inside an 18px circle, so it gets its own
                  // type size and no padding; anything else keeps the old
                  // décor label. Unlabelled table chairs render blank as before.
                  const isStool = el.kind === "seat";
                  return (
                    <div key={el.id} className={"absolute flex items-center justify-center overflow-hidden " + (isStool ? "text-[8px] font-medium leading-none " : "text-[10px] ") + decorClass(el.kind)} style={baseStyle}>
                      {el.label ? <span className={isStool ? "" : "px-1 truncate"}>{el.label}</span> : null}
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
                    onClick={() => { if (consumePress()) return; tapElement(el); }}
                    {...pressHandlers(el)}
                    className={"absolute overflow-hidden border p-1.5 flex flex-col items-center text-center leading-tight gap-0.5 active:scale-[0.97] transition-all " + (isTable || short ? "justify-center " : "justify-start ") + statusClass(status)}
                    style={tileStyle}
                  >
                    {/* Status badge, top-left — see statusDotClass(). Paired
                        with an off-screen word, because on a dark floor the
                        tile no longer carries the status itself and a dot on
                        its own is a colour-only signal. */}
                    {(() => { const dot = statusDotClass(status); return dot ? <span className={"absolute top-1.5 left-1.5 w-2 h-2 rounded-full " + dot} aria-hidden="true" /> : null; })()}
                    <span className="sr-only">{statusLabel(status)}</span>
                    {/* Section color = a corner dot (a tag), never a status edge.
                        Moved to the bottom-left now that the status badge holds
                        the top-left corner: two dots in one corner would be two
                        readings of two different things in the same place. */}
                    {secColor && (
                      <span className="absolute bottom-1.5 left-1.5 w-2 h-2 rounded-full ring-1 ring-black/30" style={{ backgroundColor: secColor }} aria-hidden="true" />
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
                    {/* Who is sitting here, above what they owe. TouchBistro
                        writes this "Johnson: 4"; we spell out the unit, for the
                        same reason we print a legend and they don't — a colon
                        between a name and a number is a convention you have to
                        be taught. */}
                    {open && !short && partyLine(open) && (
                      <span className="text-[11px] opacity-90 truncate max-w-full">{partyLine(open)}</span>
                    )}
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
          {/* Legend. Now that the tile no longer carries the status in dark, the
              legend has to teach the BADGE, not the fill — so each swatch is
              the dot the operator will actually be looking for. Available is
              the one hollow ring, because it is the absence of a badge. */}
          <div className="absolute bottom-3 right-3 z-10 hidden sm:flex items-center gap-3 rounded-lg border border-border bg-card/90 backdrop-blur px-3 py-2 text-[11px] text-muted-foreground shadow-elevation-sm">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-table-available-border" />Available</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-table-dot-occupied" />Occupied</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-table-dot-warn" />Warning</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-table-dot-late" />Late</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-muted-foreground" />Section</span>
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

      {/* Action strip: transfer the selected table's check to another table. */}
      {moveOpen && actionTarget && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setMoveOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">{"Transfer " + actionTarget.label}</h3>
              <button type="button" onClick={() => setMoveOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">An occupied table merges the two checks.</p>
            <div className="space-y-1">
              {moveTargets.length === 0 ? (
                <p className="text-xs text-muted-foreground">{pending ? "Loading tables…" : "No other tables."}</p>
              ) : (
                moveTargets.map((t) => (
                  <button key={t.elementId} type="button" disabled={moveBusy || pending} onClick={() => doMoveTable(actionTarget.ticketId, t.elementId)} className="u-tx w-full flex items-center justify-between px-3 h-11 rounded-md text-sm border border-border hover:bg-accent disabled:opacity-60">
                    <span>{t.label}</span>
                    {t.occupied && <span className="text-[10px] text-muted-foreground">occupied · merge</span>}
                  </button>
                ))
              )}
            </div>
            {moveErr && <p className="text-sm text-red-600 mt-2">{moveErr}</p>}
          </div>
        </div>
      )}

      {/* Action strip: reassign the selected table's server. */}
      {assignOpen && actionTarget && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setAssignOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">{"Assign " + actionTarget.label}</h3>
              <button type="button" onClick={() => setAssignOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {actionTarget.serverName ? "Currently " + actionTarget.serverName + "." : "This check has no server yet."}
            </p>
            {assignNeedsPin && (
              <div className="space-y-1 mb-3">
                <Label className="text-xs">Manager PIN</Label>
                <Input type="password" inputMode="numeric" value={assignPin} onChange={(e) => setAssignPin(e.target.value)} placeholder="4-6 digits" className="h-11" />
              </div>
            )}
            <div className="space-y-1">
              {staff.map((s) => (
                <button key={s.id} type="button" disabled={assignBusy || pending} onClick={() => doAssign(actionTarget.ticketId, s.id)} className="u-tx w-full text-left px-3 h-11 rounded-md text-sm border border-border hover:bg-accent disabled:opacity-60">
                  {s.name}
                </button>
              ))}
            </div>
            {assignErr && <p className="text-sm text-red-600 mt-2">{assignErr}</p>}
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

      {/* OPTIONS FOR A TABLE.
          Anchored under the press when it came from a long press, centred when
          it came from the toolbar button. Every row is 44px so it can be hit
          without looking, and a row that cannot run says why on its own line
          rather than being a dead grey rectangle — the same rule the action
          strip already followed.

          Printing a bill and closing a table are deliberately NOT here. Both
          need the live cart — a bill has to price discounts, comps, service
          charge and tax; closing has to know the check is settled — and the
          register is what holds it. They are one tap away through Open check. */}
      {menuFor && (() => {
        const m = menuFor;
        const isSplit = (m.open.child_count ?? 0) > 0;
        const rows: { label: string; run: () => void; reason?: string | null; danger?: boolean }[] = [
          {
            label: isSplit ? "Open split checks" : "Open check",
            run: () => (isSplit ? openSplitView(m.el, m.open) : resumeElement(m.el, m.open.id, m.open.server_name)),
          },
          {
            label: m.open.party_name ? "Rename party…" : "Name this party…",
            run: () => {
              setRenameValue(m.open.party_name ?? "");
              setRenameFor({ ticketId: m.open.id, label: m.el.label ?? "Table" });
            },
          },
          {
            label: "Transfer table…",
            run: () => openMoveTable(m.open.id),
            reason: isSplit ? "Un-split " + (m.el.label ?? "this table") + " before moving it." : null,
          },
          {
            label: "Assign server…",
            run: openAssign,
            reason: staff.length === 0 ? "No staff on file to assign." : null,
          },
        ];
        if (isSplit) {
          rows.push({ label: "Un-split check", run: () => handleUnsplit(m.open.id), danger: true });
        }
        const W = 264;
        const pos = m.at
          ? {
              left: Math.max(8, Math.min(m.at.x - W / 2, (typeof window === "undefined" ? 1024 : window.innerWidth) - W - 8)),
              top: Math.max(8, Math.min(m.at.y + 12, (typeof window === "undefined" ? 768 : window.innerHeight) - 340)),
            }
          : null;
        return (
          <div className="fixed inset-0 z-[70] bg-black/40" onClick={() => setMenuFor(null)}>
            <div
              role="menu"
              aria-label={"Options for " + (m.el.label ?? "table")}
              onClick={(e) => e.stopPropagation()}
              className={"bg-card border border-border rounded-xl shadow-elevation-lg overflow-hidden " + (pos ? "absolute" : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2")}
              style={pos ? { ...pos, width: W } : { width: W }}
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="font-medium text-sm truncate">{"Options for " + (m.el.label ?? "table")}</div>
                {partyLine(m.open) && (
                  <div className="text-xs text-muted-foreground truncate">{partyLine(m.open)}</div>
                )}
              </div>
              {rows.map((r) => (
                <div key={r.label} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!!r.reason || pending}
                    onClick={() => { setMenuFor(null); r.run(); }}
                    className={"u-tx w-full text-left px-4 h-12 text-sm hover:bg-accent disabled:opacity-50 " + (r.danger ? "text-red-600" : "")}
                  >
                    {r.label}
                  </button>
                  {r.reason && <p className="px-4 pb-2 -mt-1 text-[11px] text-muted-foreground">{r.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* SEATING A TABLE.
          Party size is a grid of tap targets, not a number field. A host seats
          a table standing up, often holding menus, on a screen they are not
          looking at closely — "4" should be one tap, not tap-field, summon
          keyboard, type, dismiss keyboard, tap button. The grid runs to 24
          because that is a large private party and anything past it is two
          tables merged.

          Party name is optional and above the size, because it is what the
          host is being told at that moment ("Johnson, four"). It writes to the
          check's label and shows on the tile as "Johnson · 4", so a server
          crossing the room knows who is sitting there, not just how many. */}
      {promptTable && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setPromptTable(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{"Open " + (promptTable.label ?? "table")}</h3>
              <button type="button" onClick={() => setPromptTable(null)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <div className="space-y-1 mb-3">
              <Label className="text-xs">Party name (optional)</Label>
              <Input
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="Johnson"
                maxLength={80}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5 mb-4">
              <Label className="text-xs">Party size</Label>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => {
                  const on = guests === String(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setGuests(on ? "" : String(n))}
                      aria-pressed={on}
                      className={"u-tx u-focus h-11 rounded-md border text-sm tabular-nums " + (on ? "border-primary bg-primary text-primary-foreground font-semibold" : "border-border hover:bg-accent")}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              className="w-full h-12"
              disabled={pending}
              onClick={() => enterElement(promptTable, guests ? parseInt(guests) : null, partyName)}
            >
              Open table
            </Button>
          </div>
        </div>
      )}

      {/* Renaming the party. The name usually arrives after seating — the host
          sits them, the server greets them and gets a name — so this is its own
          small dialog off the table's options menu rather than something you
          can only set at the door. Clearing the field clears the name. */}
      {renameFor && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setRenameFor(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{"Rename party on " + renameFor.label}</h3>
              <button type="button" onClick={() => setRenameFor(null)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <div className="space-y-1 mb-4">
              <Label className="text-xs">Party name</Label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Johnson"
                maxLength={80}
                autoFocus
                className="h-11"
              />
            </div>
            <Button className="w-full h-12" disabled={pending} onClick={doRenameParty}>
              Save name
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
