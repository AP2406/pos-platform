"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { clockToggle, breakToggle, listOnShift, type OnShift } from "./time-actions";

function sinceLabel(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins + "m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + "h " + (m < 10 ? "0" + m : m) + "m";
}

export function ClockClient({ initialOnShift }: { initialOnShift: OnShift[] }) {
  const [onShift, setOnShift] = useState<OnShift[]>(initialOnShift);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function press(d: string) {
    setMsg(null);
    setPin((p) => (p.length >= 6 ? p : p + d));
  }
  function back() {
    setMsg(null);
    setPin((p) => p.slice(0, -1));
  }

  function submit() {
    if (pin.length < 4) return;
    startTransition(async () => {
      const res = await clockToggle(pin);
      setPin("");
      if ("error" in res) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: res.name + (res.action === "in" ? " clocked in." : " clocked out.") });
      setOnShift(await listOnShift());
    });
  }

  function submitBreak() {
    if (pin.length < 4) return;
    startTransition(async () => {
      const res = await breakToggle(pin);
      setPin("");
      if ("error" in res) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: res.name + (res.action === "break_start" ? " on break." : " back from break.") });
      setOnShift(await listOnShift());
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
      {/* PIN pad */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="h-12 mb-4 rounded-md border border-border flex items-center justify-center text-2xl tracking-[0.3em] tabular-nums">
          {pin ? "•".repeat(pin.length) : <span className="text-muted-foreground text-sm tracking-normal">Enter PIN</span>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} disabled={pending} className="h-14 rounded-md border border-border text-lg font-medium hover:bg-accent disabled:opacity-50">
              {d}
            </button>
          ))}
          <button type="button" onClick={back} disabled={pending} className="h-14 rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50">⌫</button>
          <button type="button" onClick={() => press("0")} disabled={pending} className="h-14 rounded-md border border-border text-lg font-medium hover:bg-accent disabled:opacity-50">0</button>
          <button type="button" onClick={() => { setPin(""); setMsg(null); }} disabled={pending} className="h-14 rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50">Clear</button>
        </div>
        <Button className="w-full h-12 mt-3" onClick={submit} disabled={pending || pin.length < 4}>
          Clock in / out
        </Button>
        <Button variant="outline" className="w-full h-11 mt-2" onClick={submitBreak} disabled={pending || pin.length < 4}>
          Start / end break
        </Button>
        {msg && (
          <p className={"text-sm mt-3 text-center " + (msg.kind === "ok" ? "text-emerald-600" : "text-red-600")}>{msg.text}</p>
        )}
      </div>

      {/* On the clock */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold mb-3">On the clock</h2>
        {onShift.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one is clocked in right now.</p>
        ) : (
          <div className="space-y-2">
            {onShift.map((s) => (
              <div key={s.staffId} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="font-medium text-sm flex items-center gap-2">
                  <span className={"inline-block w-1.5 h-1.5 rounded-full " + (s.onBreakSince ? "bg-amber-500" : "bg-emerald-500")} />
                  {s.name}
                  {s.onBreakSince && <span className="text-[10px] text-amber-600 font-semibold">ON BREAK</span>}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{sinceLabel(s.since)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
