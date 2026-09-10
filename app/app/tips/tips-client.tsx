"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveTipPoolSettings,
  computeTipPool,
  serverCashout,
  type TipPoolSettings,
  type TipPoolResult,
  type TipSplitMethod,
  type ServerCashout,
} from "./tip-actions";

const money = (n: number) => "$" + (Number(n) || 0).toFixed(2);

const METHOD_LABELS: Record<TipSplitMethod, string> = {
  by_sales: "By sales (share of their net sales)",
  by_tips: "By tips (share of tips they brought in)",
  equal: "Equal (split evenly among servers)",
};

export function TipsClient({
  initialSettings,
  today,
}: {
  initialSettings: TipPoolSettings;
  today: string;
}) {
  const [tipouts, setTipouts] = useState(initialSettings.tipouts);
  const [method, setMethod] = useState<TipSplitMethod>(initialSettings.method);
  const [reportable, setReportable] = useState(initialSettings.reportable);
  const [newRole, setNewRole] = useState("");
  const [newPct, setNewPct] = useState("");
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(today);
  const [result, setResult] = useState<TipPoolResult | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [running, startRun] = useTransition();

  const [coDate, setCoDate] = useState(today);
  const [cashout, setCashout] = useState<ServerCashout | null>(null);
  const [coErr, setCoErr] = useState<string | null>(null);
  const [coRunning, startCo] = useTransition();

  function runCashout() {
    setCoErr(null);
    startCo(async () => {
      const res = await serverCashout(coDate);
      if ("error" in res) {
        setCoErr(res.error);
        setCashout(null);
        return;
      }
      setCashout(res);
    });
  }

  const totalPct = tipouts.reduce((s, r) => s + r.percent, 0);

  function addRule() {
    const role = newRole.trim();
    const pct = Number(newPct);
    if (!role || !Number.isFinite(pct) || pct <= 0) return;
    setTipouts((prev) => [...prev, { role, percent: Math.min(100, pct) }]);
    setNewRole("");
    setNewPct("");
    setSaved(false);
  }

  function removeRule(i: number) {
    setTipouts((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  function save() {
    setSaveErr(null);
    startTransition(async () => {
      const res = await saveTipPoolSettings({ tipouts, method, reportable });
      if ("error" in res) {
        setSaveErr(res.error);
        return;
      }
      setSaved(true);
    });
  }

  function run() {
    setRunErr(null);
    startRun(async () => {
      const res = await computeTipPool(date);
      if ("error" in res) {
        setRunErr(res.error);
        setResult(null);
        return;
      }
      setResult(res);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Tip-out rules */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Tip-out rules</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Each support role takes a percentage of the day&apos;s total tips before the rest is split among servers.
          </p>
        </div>

        <div className="space-y-2">
          {tipouts.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{r.role}</span>
              <span className="tabular-nums text-sm w-16 text-right">{r.percent}%</span>
              <button type="button" onClick={() => removeRule(i)} disabled={pending} className="text-xs text-red-600 underline">
                Remove
              </button>
            </div>
          ))}
          {tipouts.length === 0 && (
            <p className="text-xs text-muted-foreground">No tip-outs — servers keep the full pool.</p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Kitchen" className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Percent</Label>
            <Input value={newPct} onChange={(e) => setNewPct(e.target.value)} placeholder="10" inputMode="decimal" className="h-9 w-24" />
          </div>
          <Button variant="outline" onClick={addRule} disabled={pending}>Add</Button>
          <span className={"text-xs ml-auto " + (totalPct >= 100 ? "text-red-600" : "text-muted-foreground")}>
            Total tip-out: {totalPct}%
          </span>
        </div>

        <div className="space-y-1 pt-2 border-t border-border">
          <Label className="text-xs">Split the server pool</Label>
          <select
            value={method}
            onChange={(e) => { setMethod(e.target.value as TipSplitMethod); setSaved(false); }}
            className="h-9 w-full rounded-md border border-border bg-transparent text-foreground px-2 text-sm"
          >
            {(Object.keys(METHOD_LABELS) as TipSplitMethod[]).map((m) => (
              <option key={m} value={m}>{METHOD_LABELS[m]}</option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-2 text-xs pt-2 border-t border-border select-none">
          <input type="checkbox" checked={reportable} onChange={(e) => { setReportable(e.target.checked); setSaved(false); }} className="h-4 w-4 mt-0.5" />
          <span>
            <span className="font-medium text-foreground">Tips are payroll-reportable income</span>
            <span className="block text-muted-foreground">Labels the payroll export so your bookkeeper includes them in pay. Turn off only if tips are handled outside payroll.</span>
          </span>
        </label>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>Save rules</Button>
          {saved && <span className="text-xs text-emerald-600">Saved.</span>}
          {saveErr && <span className="text-xs text-red-600">{saveErr}</span>}
        </div>
      </div>

      {/* Payroll export */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Payroll export</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Per-employee tip totals for a pay period (the daily pool, summed). Downloads a CSV for payroll.
          </p>
        </div>
        <form action="/app/tips/payroll" method="get" className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" name="from" defaultValue={today} className="h-9 w-44" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" name="to" defaultValue={today} className="h-9 w-44" required />
          </div>
          <Button type="submit" variant="outline">Export CSV</Button>
        </form>
      </div>

      {/* Server cashout */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Server cashout</h2>
          <p className="text-xs text-muted-foreground mt-1">
            End-of-shift reconciliation per server. Assumes servers drop their cash sales and keep cash tips net of tip-out.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={coDate} onChange={(e) => setCoDate(e.target.value)} className="h-9 w-44" />
          </div>
          <Button onClick={runCashout} disabled={coRunning}>{coRunning ? "Running…" : "Run cashout"}</Button>
          {coErr && <span className="text-xs text-red-600">{coErr}</span>}
        </div>

        {cashout && (
          cashout.rows.length === 0 ? (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">No server-attributed sales that day.</p>
          ) : (
            <div className="pt-2 border-t border-border overflow-x-auto">
              {cashout.tipOutPct > 0 && (
                <p className="text-[12px] text-muted-foreground mb-2">Tip-out: {cashout.tipOutPct}% of each server&apos;s tips.</p>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2 font-medium">Server</th>
                    <th className="py-2 px-2 font-medium text-right">Cash sales</th>
                    <th className="py-2 px-2 font-medium text-right">Card sales</th>
                    <th className="py-2 px-2 font-medium text-right">Tips</th>
                    <th className="py-2 px-2 font-medium text-right">Tip-out</th>
                    <th className="py-2 px-2 font-medium text-right">Drop to house</th>
                    <th className="py-2 pl-2 font-medium text-right">Take-home tips</th>
                  </tr>
                </thead>
                <tbody>
                  {cashout.rows.map((r) => (
                    <tr key={r.staffId} className="border-b border-border last:border-0">
                      <td className="py-2 pr-2 font-medium">{r.name}<span className="text-xs text-muted-foreground ml-1">{r.orders}</span></td>
                      <td className="py-2 px-2 text-right tabular-nums">{money(r.cashSales)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{money(r.cardSales)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{money(r.tips)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{r.tipOut > 0 ? "-" + money(r.tipOut) : "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold">{money(r.dropToHouse)}</td>
                      <td className="py-2 pl-2 text-right tabular-nums font-semibold text-emerald-600">{money(r.takeHomeTips)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Run the pool */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-semibold">Calculate a day</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" />
          </div>
          <Button onClick={run} disabled={running}>{running ? "Calculating…" : "Calculate"}</Button>
          {runErr && <span className="text-xs text-red-600">{runErr}</span>}
        </div>

        {result && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <div><span className="text-muted-foreground">Orders:</span> <span className="tabular-nums">{result.orderCount}</span></div>
              <div><span className="text-muted-foreground">Gross tips:</span> <span className="tabular-nums font-semibold">{money(result.grossTips)}</span></div>
              <div><span className="text-muted-foreground">Server pool:</span> <span className="tabular-nums font-semibold">{money(result.serverPool)}</span></div>
            </div>

            {result.tipouts.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Tip-outs</div>
                <div className="space-y-1 text-sm">
                  {result.tipouts.map((t, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{t.role} <span className="text-muted-foreground">({t.percent}%)</span></span>
                      <span className="tabular-nums">{money(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Servers — {METHOD_LABELS[result.method].split(" (")[0]}
              </div>
              {result.servers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No server-attributed orders that day.</p>
              ) : (
                <div className="space-y-1 text-sm">
                  {result.servers.map((s) => (
                    <div key={s.staffId} className="flex justify-between gap-2">
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="tabular-nums text-muted-foreground w-24 text-right">sales {money(s.sales)}</span>
                      <span className="tabular-nums font-semibold w-20 text-right">{money(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {result.unallocated > 0.0049 && (
              <p className="text-xs text-amber-600">
                {money(result.unallocated)} of the server pool is unallocated — no eligible servers for the chosen split.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
