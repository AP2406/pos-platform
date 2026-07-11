"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setHouseAccount, settleHouseAccount } from "../../pos/house-account-actions";

// Manage a customer's house account (accounts receivable): enable it + set a credit
// limit (owner/manager), see the outstanding balance, and record payments against it.
export function HouseAccountCard({
  customerId,
  initialEnabled,
  initialBalance,
  initialLimit,
  canManage,
}: {
  customerId: string;
  initialEnabled: boolean;
  initialBalance: number;
  initialLimit: number | null;
  canManage: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [limit, setLimit] = useState(initialLimit == null ? "" : String(initialLimit));
  const [balance, setBalance] = useState(initialBalance);
  const [pay, setPay] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function saveSettings(nextEnabled: boolean) {
    setMsg(null); setErr(null);
    const lim = limit.trim() === "" ? null : parseFloat(limit);
    start(async () => {
      const res = await setHouseAccount(customerId, nextEnabled, lim);
      if ("error" in res) { setErr(res.error); return; }
      setEnabled(nextEnabled);
      setMsg("Saved.");
    });
  }

  function settle() {
    setMsg(null); setErr(null);
    const amt = parseFloat(pay);
    if (!Number.isFinite(amt) || amt <= 0) { setErr("Enter a payment amount."); return; }
    start(async () => {
      const res = await settleHouseAccount(customerId, amt);
      if ("error" in res) { setErr(res.error); return; }
      setBalance(res.balance);
      setPay("");
      setMsg("Payment recorded.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Balance owed</span>
        <span className="text-lg font-semibold tabular-nums">${balance.toFixed(2)}</span>
      </div>

      {canManage ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => saveSettings(e.target.checked)} className="w-4 h-4" />
            Allow charging to a house account
          </label>
          <div className="flex items-center gap-2">
            <label className="text-sm w-28 shrink-0">Credit limit</label>
            <Input type="number" min="0" step="1" value={limit} disabled={!enabled || pending} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" className="h-9 w-32" />
            <Button variant="outline" className="h-9" disabled={!enabled || pending} onClick={() => saveSettings(enabled)}>Save limit</Button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{enabled ? "House account is active." : "No house account."} Only an owner or manager can change it.</p>
      )}

      {balance > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <label className="text-sm w-28 shrink-0">Record payment</label>
          <Input type="number" min="0" step="0.01" value={pay} disabled={pending} onChange={(e) => setPay(e.target.value)} placeholder="0.00" className="h-9 w-32 text-right" />
          <Button className="h-9" disabled={pending} onClick={settle}>Pay down</Button>
        </div>
      )}

      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
