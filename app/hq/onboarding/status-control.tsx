"use client";

import { useState, useTransition } from "react";
import { setApplicationStatus } from "./actions";

const STEPS = ["new", "kyc", "submitted", "approved"];

export function StatusControl({ id, status, canWrite }: { id: string; status: string; canWrite: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canWrite) return <p className="text-xs text-zinc-500">Read-only platform role.</p>;
  if (status === "provisioned" || status === "live") {
    return <p className="text-sm text-emerald-400">Provisioned — managed in HQ-3b.</p>;
  }

  function move(to: string) {
    setMsg(null);
    if (to === "rejected" && !confirm("Reject this application?")) return;
    start(async () => {
      const r = await setApplicationStatus(id, to);
      setMsg("error" in r ? r.error : "Updated.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button key={s} type="button" onClick={() => move(s)} disabled={pending || s === status}
            className={"h-9 px-3 rounded-md text-sm border capitalize " + (s === status ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 hover:bg-zinc-800")}>
            {s}
          </button>
        ))}
        <button type="button" onClick={() => move("rejected")} disabled={pending || status === "rejected"}
          className="h-9 px-3 rounded-md text-sm border border-red-800 text-red-400 hover:bg-red-950">Reject</button>
      </div>
      {status === "approved" && (
        <div className="rounded-md border border-dashed border-zinc-700 p-3 text-xs text-zinc-400">
          Approved. <span className="text-zinc-300">Approve &amp; provision</span> (create Finix sub-merchant + POS tenant) arrives in HQ-3b.
        </div>
      )}
      {msg && <p className="text-xs text-zinc-400">{msg}</p>}
    </div>
  );
}
