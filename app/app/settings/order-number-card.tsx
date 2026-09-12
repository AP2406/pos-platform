"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setSaleNumberSeed } from "./order-number-actions";

// Set the next sale/bill number (TouchBistro "Current Order #"). Shows the current
// next number and lets an owner/manager seed a new starting point (forward only).
export function OrderNumberCard({ nextNumber, canManage }: { nextNumber: number; canManage: boolean }) {
  const [value, setValue] = useState(String(nextNumber));
  const [next, setNext] = useState(nextNumber);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setMsg(null);
    setErr(null);
    const seed = parseInt(value, 10);
    if (!Number.isFinite(seed) || seed < 1) {
      setErr("Enter a whole number of 1 or greater.");
      return;
    }
    start(async () => {
      const res = await setSaleNumberSeed(seed);
      if ("error" in res) { setErr(res.error); return; }
      setNext(res.next);
      setValue(String(res.next));
      setMsg("Saved — the next sale will be #" + res.next + ".");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        The next sale and bill will be <span className="font-medium text-foreground tabular-nums">#{next}</span>. Set a new starting number here — it can only move forward (going backward would risk duplicate numbers).
      </p>
      <div className="flex items-center gap-2">
        <label className="text-sm">Next number</label>
        <Input
          type="number"
          min="1"
          step="1"
          value={value}
          disabled={!canManage || pending}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-40"
        />
        {canManage && (
          <Button onClick={save} disabled={pending} className="h-9">
            {pending ? "Saving..." : "Save"}
          </Button>
        )}
      </div>
      {msg && <p className="text-xs text-emerald-600 mt-2">{msg}</p>}
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      {!canManage && <p className="text-xs text-muted-foreground mt-2">Only an owner or manager can change this.</p>}
    </div>
  );
}
