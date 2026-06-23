"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordDeposit, setDepositStatus, deleteDeposit, type DepositRow, type UndepositedDay } from "../deposit-actions";

export function DepositsClient({ deposits, undeposited, currency }: { deposits: DepositRow[]; undeposited: UndepositedDay[]; currency: string }) {
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.round((Number(n) || 0) * 100) / 100);
  const [pending, start] = useTransition();
  const [form, setForm] = useState<{ day: UndepositedDay; expected: string; deposited: string; date: string; reference: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const fmtDate = (d: string | null) => (d ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(d + "T00:00:00Z")) : "—");

  function openFor(day: UndepositedDay) {
    setErr(null);
    setForm({ day, expected: String(day.countedCash), deposited: String(day.countedCash), date: today, reference: "" });
  }
  function save() {
    if (!form) return;
    setErr(null);
    start(async () => {
      const res = await recordDeposit({
        businessDate: form.day.businessDate, zReportId: form.day.zReportId,
        expectedCash: Number(form.expected) || 0, depositedAmount: Number(form.deposited) || 0,
        depositDate: form.date || null, reference: form.reference || null,
      });
      if ("error" in res) { setErr(res.error); return; }
      setForm(null);
    });
  }

  const outstanding = undeposited.reduce((s, d) => s + d.countedCash, 0);
  const flagged = deposits.filter((d) => Math.abs(d.variance) >= 0.01);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Awaiting deposit" value={money(outstanding)} hint={undeposited.length + " day" + (undeposited.length === 1 ? "" : "s")} tone={undeposited.length > 0 ? "warn" : undefined} />
        <Stat label="Variances" value={String(flagged.length)} tone={flagged.length > 0 ? "bad" : undefined} />
        <Stat label="Recorded" value={String(deposits.length)} />
      </div>

      {undeposited.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2">Days awaiting a deposit</h2>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl divide-y divide-border overflow-hidden">
            {undeposited.map((d) => (
              <div key={d.zReportId} className="p-3">
                {form && form.day.zReportId === d.zReportId ? (
                  <div className="space-y-3">
                    <div className="font-medium text-sm">{fmtDate(d.businessDate)} <span className="text-xs font-normal text-muted-foreground">counted {money(d.countedCash)} · cash sales {money(d.cashSales)}</span></div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1"><Label className="text-xs">Expected to bank</Label><Input value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} inputMode="decimal" className="h-9 w-32" /></div>
                      <div className="space-y-1"><Label className="text-xs">Deposited</Label><Input value={form.deposited} onChange={(e) => setForm({ ...form, deposited: e.target.value })} inputMode="decimal" className="h-9 w-32" /></div>
                      <div className="space-y-1"><Label className="text-xs">Deposit date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-9 w-40" /></div>
                      <div className="space-y-1"><Label className="text-xs">Slip / ref</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="h-9 w-36" /></div>
                    </div>
                    {(() => { const v = (Number(form.deposited) || 0) - (Number(form.expected) || 0); return Math.abs(v) >= 0.01 ? <p className="text-xs text-amber-600">Variance {money(v)} — double-check before saving.</p> : null; })()}
                    <div className="flex items-center gap-3">
                      <Button onClick={save} disabled={pending} className="h-9">Save deposit</Button>
                      <Button variant="outline" onClick={() => setForm(null)} disabled={pending} className="h-9">Cancel</Button>
                      {err && <span className="text-sm text-red-600">{err}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{fmtDate(d.businessDate)}</div>
                      <div className="text-[11px] text-muted-foreground">Counted {money(d.countedCash)} · cash sales {money(d.cashSales)}{Math.abs(d.overShort) >= 0.01 ? " · over/short " + money(d.overShort) : ""}</div>
                    </div>
                    <Button variant="outline" className="h-9 shrink-0" onClick={() => openFor(d)}>Record deposit</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold mb-2">Recorded deposits</h2>
      {deposits.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">No deposits recorded yet.</div>
      ) : (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Business day</th>
                <th className="px-3 py-2 font-medium text-right">Expected</th>
                <th className="px-3 py-2 font-medium text-right">Deposited</th>
                <th className="px-3 py-2 font-medium text-right">Variance</th>
                <th className="px-3 py-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => {
                const off = Math.abs(d.variance) >= 0.01;
                return (
                  <tr key={d.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-2 font-medium">{fmtDate(d.businessDate)}<span className="block text-[11px] text-muted-foreground font-normal">{d.reference ? "ref " + d.reference + " · " : ""}{d.depositDate ? "dep " + fmtDate(d.depositDate) : "no date"}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(d.expectedCash)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(d.depositedAmount)}</td>
                    <td className={"px-3 py-2 text-right tabular-nums font-medium " + (off ? "text-red-600" : "text-muted-foreground")}>{d.variance > 0 ? "+" : ""}{money(d.variance)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={"inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " + (d.status === "reconciled" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>{d.status}</span>
                      <div className="mt-1 flex justify-end gap-1.5 text-[11px]">
                        <button onClick={() => start(async () => { await setDepositStatus(d.id, d.status === "reconciled" ? "recorded" : "reconciled"); })} disabled={pending} className="underline text-muted-foreground">{d.status === "reconciled" ? "unmatch" : "mark matched"}</button>
                        <button onClick={() => { if (confirm("Delete this deposit record?")) start(async () => { await deleteDeposit(d.id); }); }} disabled={pending} className="underline text-red-600">delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" | "bad" }) {
  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"text-xl font-semibold tabular-nums mt-0.5 " + (tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "")}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
