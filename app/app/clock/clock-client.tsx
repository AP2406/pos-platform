"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { clockToggle, breakToggle, listOnShift, type OnShift } from "./time-actions";
import { ackBroadcast } from "../broadcasts/actions";

type Broadcast = { id: string; title: string; body: string };

function sinceLabel(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins + "m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + "h " + (m < 10 ? "0" + m : m) + "m";
}

export function ClockClient({ initialOnShift, broadcasts = [] }: { initialOnShift: OnShift[]; broadcasts?: Broadcast[] }) {
  const [onShift, setOnShift] = useState<OnShift[]>(initialOnShift);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [ackMsg, setAckMsg] = useState<string | null>(null);

  function acknowledge(id: string) {
    if (pin.length < 4) { setAckMsg("Enter your PIN on the pad first."); return; }
    const p = pin;
    startTransition(async () => {
      const res = await ackBroadcast(id, p);
      setPin("");
      setAckMsg("error" in res ? res.error : res.name + " acknowledged. Thanks!");
    });
  }
  // D1: when an off-schedule clock-in is blocked, hold the staff PIN and prompt
  // for a manager override.
  const [override, setOverride] = useState<{ staffPin: string; text: string } | null>(null);
  const [mgrPin, setMgrPin] = useState("");

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
    const staffPin = pin;
    startTransition(async () => {
      const res = await clockToggle(staffPin);
      if ("error" in res) {
        if ("needsOverride" in res && res.needsOverride) {
          setOverride({ staffPin, text: res.error });
          setPin("");
          return;
        }
        setPin("");
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setPin("");
      setMsg({ kind: "ok", text: res.name + (res.action === "in" ? " clocked in." : " clocked out.") });
      setOnShift(await listOnShift());
    });
  }

  function confirmOverride() {
    if (!override || mgrPin.length < 4) return;
    startTransition(async () => {
      const res = await clockToggle(override.staffPin, mgrPin);
      setMgrPin("");
      if ("error" in res) {
        setMsg({ kind: "err", text: res.error });
        if (!("needsOverride" in res && res.needsOverride)) setOverride(null);
        return;
      }
      setOverride(null);
      setMsg({ kind: "ok", text: res.name + " clocked in (manager override)." });
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
    <div className="max-w-3xl space-y-6">
      {broadcasts.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Announcements</h2>
          <div className="space-y-2">
            {broadcasts.map((b) => (
              <div key={b.id} className="rounded-md border border-border p-3">
                <div className="font-medium text-sm">{b.title}</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">{b.body}</p>
                <button onClick={() => acknowledge(b.id)} disabled={pending} className="mt-2 text-xs rounded-md border border-border px-2.5 py-1 hover:bg-accent disabled:opacity-50">
                  Acknowledge (with your PIN)
                </button>
              </div>
            ))}
          </div>
          {ackMsg && <p className="text-sm mt-2 text-emerald-600">{ackMsg}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        {override && (
          <div className="mt-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-700 dark:text-amber-500">{override.text}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-2">Manager PIN to override:</p>
            <div className="flex gap-2">
              <input
                value={mgrPin}
                onChange={(e) => setMgrPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                type="password"
                placeholder="••••"
                className="h-9 flex-1 rounded-md border border-border bg-transparent px-2 text-sm tracking-widest"
              />
              <Button onClick={confirmOverride} disabled={pending || mgrPin.length < 4} className="h-9">Override</Button>
              <Button variant="outline" onClick={() => { setOverride(null); setMgrPin(""); }} disabled={pending} className="h-9">Cancel</Button>
            </div>
          </div>
        )}
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
                  {s.onBreakSince && <span className="text-[11px] text-amber-600 font-semibold">ON BREAK</span>}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{sinceLabel(s.since)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
