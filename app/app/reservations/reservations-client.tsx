"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReservation, setReservationStatus, pageWaitlistGuest, type Reservation } from "./reservation-actions";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return h + ":" + (m < 10 ? "0" + m : m) + " " + ampm;
}

export function ReservationsClient({
  initial,
  tables,
}: {
  initial: Reservation[];
  tables: { id: string; label: string }[];
}) {
  const [rows, setRows] = useState<Reservation[]>(initial);
  const [mode, setMode] = useState<"booking" | "waitlist">("booking");
  const [name, setName] = useState("");
  const [party, setParty] = useState("2");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [when, setWhen] = useState("");
  const [wait, setWait] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seatingId, setSeatingId] = useState<string | null>(null);
  const [pageNote, setPageNote] = useState<string | null>(null);

  function add() {
    setErr(null);
    setWarning(null);
    startTransition(async () => {
      const res = await createReservation({
        guest_name: name,
        party_size: Number(party),
        phone,
        email,
        scheduled_at: mode === "booking" && when ? new Date(when).toISOString() : null,
        quoted_wait_min: mode === "waitlist" && wait ? Number(wait) : null,
      });
      if ("error" in res) { setErr(res.error); return; }
      setRows((prev) => [...prev, res.reservation]);
      setWarning(res.warning);
      setName(""); setParty("2"); setPhone(""); setEmail(""); setWhen(""); setWait("");
    });
  }

  function update(id: string, status: string, elementId?: string | null) {
    setSeatingId(null);
    startTransition(async () => {
      const res = await setReservationStatus(id, status, elementId);
      if ("error" in res) { setErr(res.error); return; }
      if (status === "seated") {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status, element_id: elementId ?? null } : r)));
      } else {
        // cancelled / no_show / done leave the active list
        setRows((prev) => prev.filter((r) => r.id !== id));
      }
    });
  }

  const bookings = rows.filter((r) => r.scheduled_at && r.status !== "seated");
  const waitlist = rows.filter((r) => !r.scheduled_at && r.status !== "seated");
  const seated = rows.filter((r) => r.status === "seated");
  const tableLabel = (id: string | null) => tables.find((t) => t.id === id)?.label ?? "table";

  function pageGuest(id: string) {
    startTransition(async () => {
      const res = await pageWaitlistGuest(id);
      setPageNote("error" in res ? res.error : "Paged the guest by " + (res.channel === "sms" ? "text" : "email") + ".");
    });
  }

  function row(r: Reservation) {
    return (
      <div key={r.id} className="flex items-center justify-between gap-3 p-3 border-b border-border last:border-0">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {r.guest_name} <span className="text-muted-foreground font-normal">· party of {r.party_size}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {r.scheduled_at ? fmtTime(r.scheduled_at) : (r.quoted_wait_min != null ? "~" + r.quoted_wait_min + " min wait" : "Walk-in")}
            {r.phone ? "  ·  " + r.phone : ""}
            {r.status === "seated" && r.element_id ? "  ·  Seated at " + tableLabel(r.element_id) : ""}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {r.status === "seated" ? (
            <button type="button" onClick={() => update(r.id, "done")} disabled={pending} className="text-xs rounded-md border border-border px-2 py-1.5 hover:bg-accent">Done</button>
          ) : seatingId === r.id ? (
            <select
              autoFocus
              defaultValue=""
              onChange={(e) => { if (e.target.value) update(r.id, "seated", e.target.value); }}
              className="h-8 rounded-md border border-border bg-transparent text-foreground px-2 text-xs"
            >
              <option value="" disabled>Pick a table…</option>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          ) : (
            <>
              {!r.scheduled_at && (r.phone || r.email) && (
                <button type="button" onClick={() => pageGuest(r.id)} disabled={pending} className={"text-xs rounded-md border px-2 py-1.5 hover:bg-accent " + (r.paged_at ? "border-emerald-500/50 text-emerald-600" : "border-border")}>
                  {r.paged_at ? "Paged ✓" : "Table ready"}
                </button>
              )}
              <button type="button" onClick={() => setSeatingId(r.id)} disabled={pending} className="text-xs rounded-md border border-foreground px-2 py-1.5 hover:bg-accent">Seat</button>
              <button type="button" onClick={() => update(r.id, "no_show")} disabled={pending} className="text-xs rounded-md border border-border px-2 py-1.5 hover:bg-accent">No-show</button>
              <button type="button" onClick={() => update(r.id, "cancelled")} disabled={pending} className="text-xs text-red-600 underline">Cancel</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {pageNote && (
        <div className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm flex items-center justify-between gap-2">
          <span>{pageNote}</span>
          <button onClick={() => setPageNote(null)} className="text-xs text-muted-foreground underline">dismiss</button>
        </div>
      )}
      {/* Add */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <div className="flex gap-2">
          {(["booking", "waitlist"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={"text-sm rounded-md px-3 py-1.5 border capitalize " + (mode === m ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}>
              {m === "booking" ? "New booking" : "Add to waitlist"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Guest name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" /></div>
          <div className="space-y-1"><Label className="text-xs">Party size</Label><Input value={party} onChange={(e) => setParty(e.target.value)} inputMode="numeric" className="h-9" /></div>
          <div className="space-y-1"><Label className="text-xs">Phone (optional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" /></div>
          {mode === "booking" && (
            <div className="space-y-1"><Label className="text-xs">Email (sends a confirmation)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" /></div>
          )}
          {mode === "booking" ? (
            <div className="space-y-1"><Label className="text-xs">Date &amp; time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-9" /></div>
          ) : (
            <div className="space-y-1"><Label className="text-xs">Quoted wait (min)</Label><Input value={wait} onChange={(e) => setWait(e.target.value)} inputMode="numeric" placeholder="20" className="h-9" /></div>
          )}
        </div>
        {warning && <p className="text-sm text-amber-600">{warning}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={add} disabled={pending || !name.trim()}>{mode === "booking" ? "Add booking" : "Add to waitlist"}</Button>
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>

      {/* Lists */}
      <Section title="Upcoming bookings" empty="No bookings.">{bookings.map(row)}</Section>
      <Section title="Waitlist" empty="No one waiting.">{waitlist.map(row)}</Section>
      {seated.length > 0 && <Section title="Seated" empty="">{seated.map(row)}</Section>}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const has = arr.some((c) => c);
  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground mb-2">{title}</h2>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {has ? children : <p className="text-sm text-muted-foreground p-4">{empty}</p>}
      </div>
    </div>
  );
}
