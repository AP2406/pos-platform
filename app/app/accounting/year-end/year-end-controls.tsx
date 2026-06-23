"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setFiscalYearStart } from "@/app/app/settings/basis-actions";
import { setPeriodLock } from "../lock-actions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function YearEndControls({ startMonth, fyEndDate, alreadyLocked, isOwner }: { startMonth: number; fyEndDate: string; alreadyLocked: boolean; isOwner: boolean }) {
  const [month, setMonth] = useState(startMonth);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Fiscal year starts</span>
        <select value={month} onChange={(e) => { const m = Number(e.target.value); setMonth(m); setMsg(null); start(async () => { await setFiscalYearStart(m); setMsg("Saved — pick the year again above."); }); }} className="h-8 rounded-md border border-border bg-transparent px-2 text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </label>
      {isOwner && (
        alreadyLocked ? (
          <span className="text-sm text-emerald-600">Locked through {fyEndDate} ✓</span>
        ) : (
          <Button variant="outline" onClick={() => { setErr(null); if (!confirm("Lock the books through " + fyEndDate + "? Sales on/before that date can no longer be voided or adjusted.")) return; start(async () => { const res = await setPeriodLock(fyEndDate); if (res && "error" in res) setErr(res.error); else setMsg("Fiscal year closed & locked."); }); }} disabled={pending}>
            Close &amp; lock through {fyEndDate}
          </Button>
        )
      )}
      {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  );
}
