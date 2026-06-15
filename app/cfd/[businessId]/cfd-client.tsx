"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CfdItem = { name: string; quantity: number; unit_price: number };
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
};

function money(n: number): string {
  return "$" + (Math.round(n * 100) / 100).toFixed(2);
}

export function CfdClient({ businessId, businessName }: { businessId: string; businessName: string }) {
  const [state, setState] = useState<CfdState | null>(null);
  // After a sale shows "paid", fall back to idle if nothing else arrives.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("cfd-" + businessId, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "state" }, (msg) => {
      const p = msg.payload as CfdState;
      setState(p);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (p.status === "paid") {
        idleTimer.current = setTimeout(() => {
          setState((cur) => (cur && cur.status === "paid" ? { ...cur, status: "idle", items: [] } : cur));
        }, 12000);
      }
    });
    ch.subscribe();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      supabase.removeChannel(ch);
    };
  }, [businessId]);

  const name = state?.businessName || businessName;
  const status = state?.status ?? "idle";

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
          {state?.paidTotal != null && (
            <p className="text-2xl text-zinc-400 mt-4">Paid {money(state.paidTotal)}</p>
          )}
          {state?.saleNumber ? (
            <p className="text-zinc-500 mt-2">Sale #{state.saleNumber}</p>
          ) : null}
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

  // Active cart
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
