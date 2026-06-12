"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type GuestMenuItem = { id: string; name: string; price: number; category: string | null };

const money = (n: number) => "$" + (Number(n) || 0).toFixed(2);

export function GuestOrderClient({
  businessId,
  elementId,
  businessName,
  tableLabel,
  items,
}: {
  businessId: string;
  elementId: string;
  businessName: string;
  tableLabel: string | null;
  items: GuestMenuItem[];
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function add(id: string) {
    setErr(null);
    setQty((q) => ({ ...q, [id]: (q[id] ?? 0) + 1 }));
  }
  function remove(id: string) {
    setQty((q) => {
      const next = Math.max(0, (q[id] ?? 0) - 1);
      const copy = { ...q };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  const lines = items.filter((i) => (qty[i.id] ?? 0) > 0);
  const total = lines.reduce((s, i) => s + i.price * (qty[i.id] ?? 0), 0);
  const count = lines.reduce((s, i) => s + (qty[i.id] ?? 0), 0);

  // Group menu by category for display.
  const groups: { name: string; items: GuestMenuItem[] }[] = [];
  for (const it of items) {
    const cat = (it.category || "Menu").trim() || "Menu";
    let g = groups.find((x) => x.name === cat);
    if (!g) { g = { name: cat, items: [] }; groups.push(g); }
    g.items.push(it);
  }

  async function submit() {
    if (count === 0) return;
    setSubmitting(true);
    setErr(null);
    const supabase = createClient();
    const payload = lines.map((i) => ({ catalog_item_id: i.id, quantity: qty[i.id] ?? 0 }));
    const { data, error } = await supabase.rpc("submit_guest_order", {
      p_business_id: businessId,
      p_element_id: elementId,
      p_items: payload,
    });
    setSubmitting(false);
    if (error || !data || !(data as { ok?: boolean }).ok) {
      setErr("We couldn't send your order. Please ask your server.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-xl font-semibold">Order sent!</h1>
          <p className="text-sm text-muted-foreground">Your server will bring it over. You can keep ordering any time.</p>
          <button type="button" onClick={() => { setDone(false); setQty({}); }} className="text-sm underline">Order more</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-4 py-4 border-b border-border sticky top-0 bg-background z-10">
        <h1 className="text-lg font-semibold">{businessName}</h1>
        <p className="text-xs text-muted-foreground">{tableLabel ? tableLabel : "Your table"}</p>
      </div>

      <div className="px-4 py-4 space-y-5 max-w-lg mx-auto">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No items available right now.</p>}
        {groups.map((g) => (
          <div key={g.name}>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{g.name}</div>
            <div className="space-y-2">
              {g.items.map((it) => {
                const n = qty[it.id] ?? 0;
                return (
                  <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{it.name}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{money(it.price)}</div>
                    </div>
                    {n === 0 ? (
                      <button type="button" onClick={() => add(it.id)} className="shrink-0 h-9 px-3 rounded-md border border-foreground text-sm">Add</button>
                    ) : (
                      <div className="shrink-0 flex items-center gap-2">
                        <button type="button" onClick={() => remove(it.id)} className="h-9 w-9 rounded-md border border-border text-lg leading-none">−</button>
                        <span className="w-5 text-center tabular-nums">{n}</span>
                        <button type="button" onClick={() => add(it.id)} className="h-9 w-9 rounded-md border border-border text-lg leading-none">+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>

      {count > 0 && (
        <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background p-4">
          <div className="max-w-lg mx-auto">
            <button type="button" onClick={submit} disabled={submitting} className="w-full h-12 rounded-lg bg-foreground text-background font-medium disabled:opacity-60">
              {submitting ? "Sending…" : "Send order to kitchen · " + count + " item" + (count === 1 ? "" : "s") + " · " + money(total)}
            </button>
            <p className="text-[11px] text-center text-muted-foreground mt-1.5">You&apos;ll pay with your server. Prices shown before tax.</p>
          </div>
        </div>
      )}
    </div>
  );
}
