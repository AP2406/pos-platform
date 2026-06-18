"use client";

import { useState, useTransition } from "react";
import { voidOrder } from "../actions";
import { requestApproval } from "../../approvals/actions";
import { VOID_REASONS } from "../reason-codes";

export function VoidButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [mgrPin, setMgrPin] = useState("");

  const canConfirm = reason !== "" && (reason !== "other" || note.trim().length > 0);

  function close() {
    setOpen(false);
    setReason("");
    setNote("");
    setError(null);
    setNeedsApproval(false);
    setMgrPin("");
  }

  function runVoid(approverPin?: string) {
    setError(null);
    startTransition(async () => {
      const res = await voidOrder(
        orderId,
        reason,
        reason === "other" ? note.trim() : "",
        approverPin
      );
      if ("needs_approval" in res) {
        setNeedsApproval(true);
        return;
      }
      if ("error" in res) {
        setError(res.error);
        return;
      }
      close();
    });
  }

  function handleVoid() {
    if (!canConfirm) {
      setError("Choose a reason.");
      return;
    }
    runVoid(undefined);
  }

  function handleApprove() {
    if (!/^[0-9]{4,6}$/.test(mgrPin)) {
      setError("Enter the manager's 4 to 6 digit PIN.");
      return;
    }
    runVoid(mgrPin);
  }

  const [sent, setSent] = useState(false);
  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const res = await requestApproval({
        kind: "void",
        orderId,
        reasonCode: reason,
        reasonNote: reason === "other" ? note.trim() : undefined,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted-foreground underline hover:text-foreground">
        Void
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{needsApproval ? "Manager approval" : "Void sale"}</h3>
              <button type="button" onClick={close} className="text-xs text-muted-foreground underline">
                Cancel
              </button>
            </div>

            {needsApproval ? (
              sent ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Request sent to a manager. The void applies once it&apos;s approved
                    from the Approvals screen.
                  </p>
                  <button type="button" onClick={close} className="w-full px-3 py-2 text-sm rounded-md border border-border hover:bg-accent">
                    Done
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    A manager must approve this void — enter their PIN now, or send it to
                    the Approvals queue.
                  </p>
                  <input type="password" inputMode="numeric" value={mgrPin} onChange={(e) => setMgrPin(e.target.value)} placeholder="Manager PIN" className="w-full h-9 rounded-md border border-border bg-transparent text-foreground px-3 text-sm" />
                  {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={handleApprove} disabled={pending || !mgrPin} className="flex-1 px-3 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                      {pending ? "Voiding..." : "Approve & void"}
                    </button>
                    <button type="button" onClick={handleRequest} disabled={pending} className="flex-1 px-3 py-2 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-50">
                      Request approval
                    </button>
                  </div>
                </>
              )
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  This marks the sale as voided. The reason is recorded.
                </p>
                <div className="space-y-2">
                  <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                    <option value="">Select a reason...</option>
                    {VOID_REASONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {reason === "other" && (
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason note" className="w-full h-9 rounded-md border border-border bg-transparent text-foreground px-3 text-sm" />
                  )}
                </div>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={handleVoid} disabled={pending || !canConfirm} className="flex-1 px-3 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                    {pending ? "Voiding..." : "Void sale"}
                  </button>
                  <button type="button" onClick={close} className="flex-1 px-3 py-2 text-sm rounded-md border border-border hover:bg-accent">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}