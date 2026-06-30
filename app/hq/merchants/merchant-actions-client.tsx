"use client";

import { useState, useTransition } from "react";
import { setTenantAccessStatus, setTenantPlan, setTenantCustomMrr } from "./actions";

export function MerchantActions({
  businessId,
  paused,
  plan,
  customMrr,
  canWrite,
}: {
  businessId: string;
  paused: boolean;
  plan: string | null;
  customMrr: number | null;
  canWrite: boolean;
}) {
  const [planVal, setPlanVal] = useState(plan ?? "");
  const [mrrVal, setMrrVal] = useState(customMrr != null ? String(customMrr) : "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canWrite) {
    return <p className="text-xs text-zinc-500">Your platform role is read-only for tenant changes.</p>;
  }

  function pauseResume() {
    setMsg(null);
    const next = paused ? "active" : "suspended";
    if (next === "suspended" && !confirm("Pause this merchant? Its users will be locked out until resumed.")) return;
    start(async () => {
      const r = await setTenantAccessStatus(businessId, next);
      setMsg("error" in r ? r.error : next === "suspended" ? "Merchant paused." : "Merchant resumed.");
    });
  }

  function savePlan() {
    setMsg(null);
    start(async () => {
      const r = await setTenantPlan(businessId, planVal);
      setMsg("error" in r ? r.error : "Plan saved.");
    });
  }

  function saveMrr() {
    setMsg(null);
    start(async () => {
      const r = await setTenantCustomMrr(businessId, mrrVal);
      setMsg("error" in r ? r.error : mrrVal.trim() === "" ? "MRR override cleared." : "MRR override saved.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={planVal}
          onChange={(e) => setPlanVal(e.target.value)}
          placeholder="Plan / tier (e.g. Pro $99)"
          className="h-9 rounded-md bg-zinc-950 border border-zinc-700 px-3 text-sm w-56"
        />
        <button type="button" onClick={savePlan} disabled={pending} className="h-9 px-3 rounded-md border border-zinc-700 text-sm hover:bg-zinc-800 disabled:opacity-50">Save plan</button>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={mrrVal}
          onChange={(e) => setMrrVal(e.target.value)}
          inputMode="decimal"
          placeholder="Custom MRR $ (blank = plan tier)"
          className="h-9 rounded-md bg-zinc-950 border border-zinc-700 px-3 text-sm w-56"
        />
        <button type="button" onClick={saveMrr} disabled={pending} className="h-9 px-3 rounded-md border border-zinc-700 text-sm hover:bg-zinc-800 disabled:opacity-50">Save MRR</button>
      </div>
      <button
        type="button"
        onClick={pauseResume}
        disabled={pending}
        className={"h-9 px-4 rounded-md text-sm font-medium disabled:opacity-50 " + (paused ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}
      >
        {pending ? "Working…" : paused ? "Resume merchant" : "Pause merchant"}
      </button>
      {msg && <p className="text-xs text-zinc-400">{msg}</p>}
    </div>
  );
}
