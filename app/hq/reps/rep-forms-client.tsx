"use client";

import { useState, useTransition } from "react";
import { addRep, recordPayout } from "./actions";

const inp = "h-9 rounded-md bg-zinc-950 border border-zinc-700 px-2 text-sm";

export function AddRepForm() {
  const [f, setF] = useState({ name: "", email: "", code: "", residualPct: "0.30", bounty: "150", clawbackMonths: "3" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function add() {
    setMsg(null);
    start(async () => {
      const r = await addRep(f);
      if ("error" in r) { setMsg(r.error); return; }
      setMsg("Rep added.");
      setF({ name: "", email: "", code: "", residualPct: "0.30", bounty: "150", clawbackMonths: "3" });
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Add rep</h2>
      <div className="grid sm:grid-cols-3 gap-2">
        <input className={inp} placeholder="Name" value={f.name} onChange={s("name")} />
        <input className={inp} placeholder="Email" value={f.email} onChange={s("email")} />
        <input className={inp} placeholder="Code (for /apply/<code>)" value={f.code} onChange={s("code")} />
        <input className={inp} placeholder="Residual % (0.30)" value={f.residualPct} onChange={s("residualPct")} />
        <input className={inp} placeholder="Bounty $ (150)" value={f.bounty} onChange={s("bounty")} />
        <input className={inp} placeholder="Clawback months (3)" value={f.clawbackMonths} onChange={s("clawbackMonths")} />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <button type="button" onClick={add} disabled={pending} className="h-9 px-4 rounded-md bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">{pending ? "Adding…" : "Add rep"}</button>
        {msg && <span className="text-xs text-zinc-400">{msg}</span>}
      </div>
    </div>
  );
}

export function PayoutForm({ repId }: { repId: string }) {
  const [f, setF] = useState({ amount: "", period: "", note: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function rec() {
    setMsg(null);
    start(async () => {
      const r = await recordPayout(repId, f.amount, f.period, f.note);
      if ("error" in r) { setMsg(r.error); return; }
      setMsg("Payout recorded.");
      setF({ amount: "", period: "", note: "" });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className={inp + " w-28"} placeholder="Amount $" value={f.amount} onChange={s("amount")} inputMode="decimal" />
      <input className={inp + " w-28"} placeholder="Period (2026-06)" value={f.period} onChange={s("period")} />
      <input className={inp + " flex-1 min-w-40"} placeholder="Note (optional)" value={f.note} onChange={s("note")} />
      <button type="button" onClick={rec} disabled={pending} className="h-9 px-3 rounded-md border border-zinc-700 text-sm hover:bg-zinc-800 disabled:opacity-50">{pending ? "…" : "Record payout"}</button>
      {msg && <span className="text-xs text-zinc-400 w-full">{msg}</span>}
    </div>
  );
}
