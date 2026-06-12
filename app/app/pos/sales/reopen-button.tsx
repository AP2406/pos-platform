"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reopenOrder, addOrderAdjustment, getOrderAdjustments, type AdjustmentRow } from "./reopen-actions";

const REASON_LABELS: Record<string, string> = {
  correct_error: "Correct a mistake",
  add_items: "Add items",
  adjust_tip: "Adjust tip",
  comp_after: "Comp after close",
  manager: "Manager decision",
  other: "Other",
};
const REOPEN_REASONS = Object.keys(REASON_LABELS);
const ADJ_KINDS: { key: string; label: string; sign: string }[] = [
  { key: "charge", label: "Add charge", sign: "+" },
  { key: "tip_adjust", label: "Tip adjust", sign: "+" },
  { key: "comp", label: "Comp", sign: "−" },
  { key: "void", label: "Void item", sign: "−" },
];
const money = (n: number) => "$" + (Math.round(n * 100) / 100).toFixed(2);

export function ReopenButton({ orderId, saleNumber, total }: { orderId: string; saleNumber: number; total: number }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"reason" | "adjust">("reason");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [needsPin, setNeedsPin] = useState(false);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [kind, setKind] = useState("charge");
  const [amount, setAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setStep("reason"); setReason(""); setNote(""); setPin(""); setNeedsPin(false);
    setAdjustments([]); setKind("charge"); setAmount(""); setAdjNote(""); setErr(null);
  }

  const netDelta = adjustments.reduce((s, a) => s + a.amount, 0);
  const net = Math.round((total + netDelta) * 100) / 100;

  function doReopen() {
    if (!reason) { setErr("Choose a reason."); return; }
    setErr(null);
    startTransition(async () => {
      const res = await reopenOrder({ order_id: orderId, reason_code: reason, reason_note: note, approver_pin: pin || undefined });
      if ("needs_approval" in res) { setNeedsPin(true); setErr("A manager PIN is needed."); return; }
      if ("error" in res) { setErr(res.error); return; }
      const adj = await getOrderAdjustments(orderId);
      setAdjustments(adj);
      setStep("adjust");
    });
  }

  function doAdjust() {
    const amt = parseFloat(amount);
    if (!amt) { setErr("Enter an amount."); return; }
    setErr(null);
    startTransition(async () => {
      const res = await addOrderAdjustment({ order_id: orderId, kind, amount: amt, reason_code: kind, reason_note: adjNote, approver_pin: pin || undefined });
      if ("needs_approval" in res) { setNeedsPin(true); setErr("A manager PIN is needed."); return; }
      if ("error" in res) { setErr(res.error); return; }
      const adj = await getOrderAdjustments(orderId);
      setAdjustments(adj);
      setAmount(""); setAdjNote("");
    });
  }

  return (
    <>
      <button type="button" onClick={() => { reset(); setOpen(true); }} className="text-xs text-muted-foreground underline hover:text-foreground">Reopen</button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Reopen sale #{saleNumber}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">Close</button>
            </div>

            {step === "reason" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">The original sale stays unchanged. Reopening lets you record append-only adjustments (manager-approved).</p>
                <div className="space-y-1">
                  <Label className="text-xs">Reason</Label>
                  <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                    <option value="">Select…</option>
                    {REOPEN_REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
                  </select>
                </div>
                {reason === "other" && <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="h-10" />}
                {needsPin && (
                  <div className="space-y-1">
                    <Label className="text-xs">Manager PIN</Label>
                    <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4–6 digits" className="h-10" />
                  </div>
                )}
                <Button className="w-full" onClick={doReopen} disabled={pending || !reason}>{pending ? "…" : "Reopen"}</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-border p-3 text-sm space-y-1">
                  <div className="flex justify-between text-muted-foreground"><span>Original total</span><span className="tabular-nums">{money(total)}</span></div>
                  {adjustments.filter((a) => a.kind !== "reopen").map((a) => (
                    <div key={a.id} className="flex justify-between"><span className="capitalize text-muted-foreground">{a.kind.replace("_", " ")}</span><span className={"tabular-nums " + (a.amount < 0 ? "text-red-600" : "")}>{(a.amount < 0 ? "−$" : "+$") + Math.abs(a.amount).toFixed(2)}</span></div>
                  ))}
                  <div className="flex justify-between font-medium pt-1 border-t border-border"><span>Net</span><span className="tabular-nums">{money(net)}</span></div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Add adjustment</Label>
                  <div className="flex gap-2">
                    <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm flex-1">
                      {ADJ_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label} ({k.sign})</option>)}
                    </select>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-10 w-24 text-right" />
                  </div>
                  <Input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="Note (optional)" className="h-10" />
                  {needsPin && <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Manager PIN" className="h-10" />}
                  <Button variant="outline" className="w-full" onClick={doAdjust} disabled={pending || !amount}>{pending ? "…" : "Add adjustment"}</Button>
                </div>
                <Button className="w-full" onClick={() => setOpen(false)}>Done</Button>
              </div>
            )}
            {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
          </div>
        </div>
      )}
    </>
  );
}
