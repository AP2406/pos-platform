"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordDeferred, releaseDeferred, deleteDeferred, setGiftBreakageConfig, recognizeBreakage, type DeferredRow, type BreakageInfo } from "./actions";

export function DeferredClient({ rows, breakage, currency, today }: { rows: DeferredRow[]; breakage: BreakageInfo; currency: string; today: string }) {
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.round((Number(n) || 0) * 100) / 100);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [desc, setDesc] = useState("");
  const [cust, setCust] = useState("");
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState(today);
  const [event, setEvent] = useState("");

  // breakage form
  const [rate, setRate] = useState(String(breakage.rate));
  const [ageM, setAgeM] = useState(String(breakage.ageMonths));
  const [brkAmt, setBrkAmt] = useState(String(breakage.suggested));
  const [brkMsg, setBrkMsg] = useState<string | null>(null);

  const fmtDate = (d: string | null) => (d ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(d + "T00:00:00Z")) : "—");

  function save() {
    setErr(null);
    start(async () => {
      const res = await recordDeferred({ description: desc, customerName: cust || null, amount: Number(amount) || 0, receivedDate: received || null, eventDate: event || null });
      if ("error" in res) { setErr(res.error); return; }
      setDesc(""); setCust(""); setAmount(""); setEvent(""); setAdding(false);
    });
  }

  const deferred = rows.filter((r) => r.status === "deferred");
  const liability = deferred.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <Stat label="Deferred liability" value={money(liability)} hint={deferred.length + " open"} />
          <Stat label="Records" value={String(rows.length)} />
        </div>
        {!adding ? (
          <Button onClick={() => { setErr(null); setAdding(true); }}>Record a deposit</Button>
        ) : (
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 flex-1 min-w-[160px]"><Label className="text-xs">Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} className="h-9" placeholder="Catering — Smith wedding" /></div>
              <div className="space-y-1"><Label className="text-xs">Customer</Label><Input value={cust} onChange={(e) => setCust(e.target.value)} className="h-9 w-40" /></div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1"><Label className="text-xs">Amount</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="h-9 w-28" /></div>
              <div className="space-y-1"><Label className="text-xs">Received</Label><Input type="date" value={received} onChange={(e) => setReceived(e.target.value)} className="h-9 w-40" /></div>
              <div className="space-y-1"><Label className="text-xs">Event date</Label><Input type="date" value={event} onChange={(e) => setEvent(e.target.value)} className="h-9 w-40" /></div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={pending || !desc.trim() || !amount}>Record (post deferral entry)</Button>
              <Button variant="outline" onClick={() => setAdding(false)} disabled={pending}>Cancel</Button>
              {err && <span className="text-sm text-red-600">{err}</span>}
            </div>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Deposit</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium text-right">Event</th>
                <th className="px-3 py-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{r.description}<span className="block text-[11px] text-muted-foreground font-normal">{r.customerName ? r.customerName + " · " : ""}rec {fmtDate(r.receivedDate)}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(r.amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDate(r.eventDate)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={"inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " + (r.status === "released" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : r.status === "deferred" ? "bg-sky-500/15 text-sky-700 dark:text-sky-400" : "bg-muted text-muted-foreground")}>{r.status}</span>
                    <div className="mt-1 flex justify-end gap-1.5 text-[11px]">
                      {r.status === "deferred" && <button onClick={() => start(async () => { await releaseDeferred(r.id); })} disabled={pending} className="underline text-emerald-600">release to revenue</button>}
                      <button onClick={() => { if (confirm("Delete this record? (journal entries stay)")) start(async () => { await deleteDeferred(r.id); }); }} disabled={pending} className="underline text-red-600">delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* F6 gift-card breakage */}
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-1">Gift-card breakage</h2>
        <p className="text-xs text-muted-foreground mb-3">Recognize aged unredeemed gift-card balances as income. Aged = active cards with a balance and no activity in {breakage.ageMonths} months.</p>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <Stat label={"Aged balance (" + breakage.ageMonths + "mo)"} value={money(breakage.agedBalance)} />
          <div className="space-y-1"><Label className="text-xs">Rate %</Label><Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="h-9 w-20" /></div>
          <div className="space-y-1"><Label className="text-xs">Age (months)</Label><Input value={ageM} onChange={(e) => setAgeM(e.target.value)} inputMode="numeric" className="h-9 w-24" /></div>
          <Button variant="outline" onClick={() => { setBrkMsg(null); start(async () => { await setGiftBreakageConfig(Number(rate) || 0, Number(ageM) || 24); }); }} disabled={pending} className="h-9">Save rate</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label className="text-xs">Recognize amount</Label><Input value={brkAmt} onChange={(e) => setBrkAmt(e.target.value)} inputMode="decimal" className="h-9 w-28" /></div>
          <Button onClick={() => { setBrkMsg(null); start(async () => { const res = await recognizeBreakage(Number(brkAmt) || 0); setBrkMsg("error" in res ? res.error : "Posted breakage income entry."); }); }} disabled={pending || !(Number(brkAmt) > 0)} className="h-9">Recognize (post entry)</Button>
          {brkMsg && <span className="text-sm text-emerald-600">{brkMsg}</span>}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Posts Dr Gift card liability / Cr Breakage income. An estimate — if a recognized card is later redeemed, reverse it with a journal entry.</p>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
