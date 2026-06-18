"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { listPendingApprovals, decideApproval, type ApprovalRow } from "./actions";

function labelKind(k: string): string {
  return k === "void" ? "Void" : k.charAt(0).toUpperCase() + k.slice(1);
}

export function ApprovalsClient({ initial }: { initial: ApprovalRow[] }) {
  const [rows, setRows] = useState<ApprovalRow[]>(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setRows(await listPendingApprovals());
    } catch {
      /* keep last good */
    }
  }

  useEffect(() => {
    const id = setInterval(refresh, 20000);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function decide(id: string, approve: boolean) {
    setErr(null);
    setRows((prev) => prev.filter((r) => r.id !== id)); // optimistic
    start(async () => {
      const res = await decideApproval(id, approve);
      if ("error" in res) {
        setErr(res.error);
        refresh();
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
        No pending requests.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {err && <p className="text-sm text-red-600">{err}</p>}
      {rows.map((r) => (
        <div key={r.id} className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">
              {labelKind(r.kind)}
              {r.saleNumber ? " · #" + r.saleNumber : ""}
              {r.amount != null ? " · $" + r.amount.toFixed(2) : ""}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {(r.requestedByName ?? "Cashier") + (r.reasonCode ? " · " + r.reasonCode : "")}
              {r.reasonNote ? " — " + r.reasonNote : ""}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => decide(r.id, false)} disabled={pending}>
              Deny
            </Button>
            <Button size="sm" onClick={() => decide(r.id, true)} disabled={pending}>
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
