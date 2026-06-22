"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CfdItem = { name: string; quantity: number; unit_price: number };
type TipRequest = { base: number; presets: number[] };
type CfdState = {
  businessName: string;
  status: "idle" | "cart" | "paid";
  items: CfdItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerName: string | null;
  paidTotal: number | null;
  saleNumber: number | null;
  tipRequest?: TipRequest | null;
};

function money(n: number): string {
  return "$" + (Math.round(n * 100) / 100).toFixed(2);
}

export function CfdClient({ businessId, businessName }: { businessId: string; businessName: string }) {
  const [state, setState] = useState<CfdState | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  // E2: once the guest submits their tip + signature, show a brief thank-you.
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("cfd-" + businessId, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "state" }, (msg) => {
      const p = msg.payload as CfdState;
      setState(p);
      if (!p.tipRequest) setSubmitted(false); // a new sale / step resets the thank-you
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (p.status === "paid") {
        idleTimer.current = setTimeout(() => {
          setState((cur) => (cur && cur.status === "paid" ? { ...cur, status: "idle", items: [] } : cur));
        }, 12000);
      }
    });
    ch.subscribe();
    chRef.current = ch;
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      supabase.removeChannel(ch);
    };
  }, [businessId]);

  function sendGuestInput(tip: number, signature: string | null) {
    chRef.current?.send({ type: "broadcast", event: "guest_input", payload: { tip: Math.max(0, Math.round(tip * 100) / 100), signature } });
    setSubmitted(true);
  }

  const name = state?.businessName || businessName;
  const status = state?.status ?? "idle";

  // E2: guest tip + signature step.
  if (status === "cart" && state?.tipRequest && !submitted) {
    return <TipSignature name={name} req={state.tipRequest} total={state.total} onDone={sendGuestInput} />;
  }
  if (status === "cart" && state?.tipRequest && submitted) {
    return (
      <Screen>
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <h1 className="text-5xl font-bold text-white">Thank you!</h1>
          <p className="text-2xl text-zinc-400 mt-4">One moment…</p>
        </div>
      </Screen>
    );
  }

  if (status === "paid") {
    return (
      <Screen>
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <div className="w-24 h-24 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-8">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-12 h-12">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-white">Thank you!</h1>
          {state?.paidTotal != null && <p className="text-2xl text-zinc-400 mt-4">Paid {money(state.paidTotal)}</p>}
          {state?.saleNumber ? <p className="text-zinc-500 mt-2">Sale #{state.saleNumber}</p> : null}
        </div>
      </Screen>
    );
  }

  if (status === "idle" || !state || state.items.length === 0) {
    return (
      <Screen>
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <h1 className="text-6xl font-bold text-white tracking-tight">{name}</h1>
          <p className="text-2xl text-zinc-400 mt-6">Welcome — please order at the counter</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="min-h-screen flex flex-col">
        <header className="px-10 py-6 border-b border-zinc-800 flex items-baseline justify-between">
          <h1 className="text-3xl font-bold text-white">{name}</h1>
          {state.customerName && <span className="text-xl text-zinc-400">{state.customerName}</span>}
        </header>
        <div className="flex-1 overflow-y-auto px-10 py-6">
          <div className="divide-y divide-zinc-800">
            {state.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between py-4">
                <div className="flex items-baseline gap-4 min-w-0">
                  <span className="text-2xl font-semibold text-zinc-500 w-10 tabular-nums">{it.quantity}×</span>
                  <span className="text-2xl text-white truncate">{it.name}</span>
                </div>
                <span className="text-2xl text-zinc-200 tabular-nums">{money(it.unit_price * it.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
        <footer className="px-10 py-6 border-t border-zinc-800 space-y-2">
          <Row label="Subtotal" value={money(state.subtotal)} muted />
          {state.tax > 0 && <Row label="Tax" value={money(state.tax)} muted />}
          <div className="flex items-center justify-between pt-2">
            <span className="text-3xl font-bold text-white">Total</span>
            <span className="text-4xl font-bold text-white tabular-nums">{money(state.total)}</span>
          </div>
        </footer>
      </div>
    </Screen>
  );
}

function TipSignature({ name, req, total, onDone }: { name: string; req: TipRequest; total: number; onDone: (tip: number, sig: string | null) => void }) {
  const [tip, setTip] = useState<number>(0);
  const [custom, setCustom] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInk.current = true;
  }
  function up() { drawing.current = false; }
  function clearSig() {
    const c = canvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  }
  function done() {
    const sig = hasInk.current && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null;
    onDone(tip, sig);
  }

  const presets = req.presets.map((pct) => ({ pct, amt: Math.round(req.base * (pct / 100) * 100) / 100 }));

  return (
    <Screen>
      <div className="min-h-screen flex flex-col items-center justify-center px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-1">{name}</h1>
        <p className="text-xl text-zinc-400 mb-6">Total {money(total + tip)}</p>

        <div className="text-zinc-300 text-lg mb-2">Add a tip?</div>
        <div className="flex flex-wrap gap-3 justify-center mb-3 max-w-2xl">
          {presets.map((p) => (
            <button key={p.pct} onClick={() => { setTip(p.amt); setCustom(""); }} className={"min-w-[140px] rounded-xl border px-6 py-5 text-center " + (tip === p.amt && !custom ? "border-emerald-500 bg-emerald-500/15" : "border-zinc-700 hover:bg-zinc-800")}>
              <div className="text-2xl font-bold text-white">{p.pct}%</div>
              <div className="text-lg text-zinc-400 tabular-nums">{money(p.amt)}</div>
            </button>
          ))}
          <button onClick={() => { setTip(0); setCustom(""); }} className={"min-w-[140px] rounded-xl border px-6 py-5 text-center " + (tip === 0 && !custom ? "border-emerald-500 bg-emerald-500/15" : "border-zinc-700 hover:bg-zinc-800")}>
            <div className="text-2xl font-bold text-white">No tip</div>
          </button>
        </div>
        <div className="flex items-center gap-2 mb-6">
          <span className="text-zinc-400 text-lg">Custom $</span>
          <input value={custom} onChange={(e) => { setCustom(e.target.value); setTip(Math.max(0, Number(e.target.value) || 0)); }} inputMode="decimal" className="h-12 w-32 rounded-md bg-zinc-900 border border-zinc-700 text-white text-xl text-center" />
        </div>

        <div className="text-zinc-300 text-lg mb-2">Sign below <span className="text-zinc-500 text-sm">(optional)</span></div>
        <canvas
          ref={canvasRef}
          width={560}
          height={180}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="rounded-xl bg-zinc-900 border border-zinc-700 touch-none"
          style={{ width: "min(560px, 90vw)", height: "180px" }}
        />
        <button onClick={clearSig} className="text-zinc-500 text-sm underline mt-1">clear signature</button>

        <button onClick={done} className="mt-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-2xl font-semibold px-12 py-4">
          Done{tip > 0 ? " · " + money(tip) + " tip" : ""}
        </button>
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-zinc-950 select-none">{children}</div>;
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={"text-xl " + (muted ? "text-zinc-500" : "text-zinc-200")}>{label}</span>
      <span className={"text-xl tabular-nums " + (muted ? "text-zinc-400" : "text-zinc-200")}>{value}</span>
    </div>
  );
}
