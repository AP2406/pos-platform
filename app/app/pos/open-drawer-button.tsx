"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordCashMovement } from "./drawer/actions";

/**
 * Open the cash drawer without a sale, from the register.
 *
 * TouchBistro puts "Open Cash Drawer" in its checkout header. Surge had the
 * action — `recordCashMovement({ kind: "no_sale" })` — but only on
 * /app/pos/drawer, so a cashier who needed to break a note left the register,
 * navigated away, opened the drawer, and came back, with a customer waiting.
 *
 * This is deliberately NOT a silent one-tap button. A no-sale is the action
 * that opens a till with no transaction to account for it, which is why it is
 * audited and why it now requires the `no_sale` permission — a gate that was
 * declared in the permission table and never enforced until the same change
 * that added this button. Making it reachable from the register without fixing
 * that first would have put an unguarded till-opener one tap from every server.
 */
export function OpenDrawerButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [needsPin, setNeedsPin] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function reset() {
    setPin("");
    setNeedsPin(false);
    setErr(null);
    setDone(false);
  }

  function submit() {
    setErr(null);
    start(async () => {
      const res = await recordCashMovement({
        kind: "no_sale",
        approver_pin: needsPin ? pin : undefined,
      });
      if ("needs_approval" in res) {
        setNeedsPin(true);
        setErr("A manager PIN is needed to open the drawer.");
        return;
      }
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      // Confirmed rather than silently dismissed: the operator needs to know a
      // record was written, because one was.
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1200);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={
          className ??
          "flex h-10 items-center gap-2 rounded-lg border border-sidebar-border px-3.5 text-sm font-semibold hover:bg-sidebar-accent"
        }
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
          <rect x="2" y="7" width="20" height="12" rx="2" />
          <path d="M2 11h20M10 15h4" />
        </svg>
        Open drawer
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">Open the cash drawer</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">
                Cancel
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              No sale is recorded, but the drawer opening is — with who did it
              and when.
            </p>

            {needsPin && (
              <div className="space-y-1 mb-3">
                <Label className="text-xs">Manager PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="4-6 digits"
                  autoFocus
                  className="h-11"
                />
              </div>
            )}

            <Button className="w-full h-12" disabled={pending || done} onClick={submit}>
              {done ? "Drawer opened" : pending ? "Opening…" : "Open drawer"}
            </Button>
            {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
          </div>
        </div>
      )}
    </>
  );
}
