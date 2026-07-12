"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type StatusItem = { name: string; quantity: number };
type StatusData = {
  found: boolean;
  status?: "preparing" | "ready" | "completed";
  placed_at?: string;
  business_name?: string;
  items?: StatusItem[];
};

const STEPS: { key: "preparing" | "ready" | "completed"; label: string; sub: string }[] = [
  { key: "preparing", label: "Preparing", sub: "The kitchen is on it" },
  { key: "ready", label: "Ready for pickup", sub: "Come grab it at the counter" },
  { key: "completed", label: "Picked up", sub: "Thanks — see you next time!" },
];

function stepIndex(status?: string): number {
  if (status === "ready") return 1;
  if (status === "completed") return 2;
  return 0; // preparing (or unknown)
}

export function OrderStatusClient({ businessId, token }: { businessId: string; token: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: res, error } = await supabase.rpc("get_order_status", { p_token: token });
    if (!error) setData((res ?? { found: false }) as StatusData);
    setLoaded(true);
  }, [token]);

  useEffect(() => {
    load();
    // Poll for live progress. Polling (not realtime) keeps this public surface
    // simple and safe — the guest only holds an opaque token, never a row id.
    const id = setInterval(load, 6000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (!loaded) {
    return <Centered>Loading your order…</Centered>;
  }

  if (!data?.found) {
    return (
      <Centered>
        <div>
          <p className="text-zinc-900 font-semibold text-xl">Order not found</p>
          <p className="text-zinc-500 mt-2">This link may have expired, or the order was already closed.</p>
        </div>
      </Centered>
    );
  }

  const active = stepIndex(data.status);
  const isReady = data.status === "ready";

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="px-6 py-4 bg-white border-b border-zinc-200 text-center">
        <h1 className="text-xl font-bold text-zinc-900">{data.business_name ?? "Your order"}</h1>
        <p className="text-sm text-zinc-500">Pickup order status</p>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 py-8">
        <div className="w-full max-w-md">
          {/* Headline state */}
          <div
            className={
              "rounded-2xl p-6 text-center mb-8 " +
              (isReady ? "bg-green-600 text-white" : "bg-white border border-zinc-200")
            }
          >
            <div className={"text-2xl font-bold " + (isReady ? "text-white" : "text-zinc-900")}>
              {STEPS[active].label}
            </div>
            <div className={"mt-1 " + (isReady ? "text-green-50" : "text-zinc-500")}>{STEPS[active].sub}</div>
          </div>

          {/* Stepper */}
          <ol className="space-y-4 mb-8">
            {STEPS.map((s, i) => {
              const done = i < active;
              const current = i === active;
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span
                    className={
                      "w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold " +
                      (done || current ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-400")
                    }
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <div className="flex-1">
                    <div
                      className={
                        "font-medium " + (done || current ? "text-zinc-900" : "text-zinc-400")
                      }
                    >
                      {s.label}
                    </div>
                    {current && <div className="text-xs text-zinc-500">{s.sub}</div>}
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Items */}
          {data.items && data.items.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Your order</div>
              <ul className="space-y-2">
                {data.items.map((it, i) => (
                  <li key={i} className="flex justify-between text-zinc-800">
                    <span>{it.name}</span>
                    <span className="tabular-nums text-zinc-500">×{it.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-zinc-400 text-center mt-6">This page updates automatically.</p>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-500 text-lg p-8 text-center">
      {children}
    </div>
  );
}
