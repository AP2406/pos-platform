"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type OnlineItem = { id: string; name: string; price: number; category: string | null };

type CartLine = { item: OnlineItem; qty: number };

function money(n: number): string {
  return "$" + n.toFixed(2);
}

// GAP-1 (2/5): online pickup ordering. Same build-a-cart flow as the kiosk, but for
// a customer's own phone: name + phone are required (so the shop can call about the
// pickup) and an optional note carries pickup time / allergies. No online payment in
// this chunk — the guest pays at pickup; the order fires to the kitchen on submit.
export function OnlineOrderClient({
  businessId,
  businessName,
  items,
}: {
  businessId: string;
  businessName: string;
  items: OnlineItem[];
}) {
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const i of items) {
      const c = i.category || "Other";
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [items]);

  const [activeCat, setActiveCat] = useState<string>(categories[0] ?? "Other");
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [confirmation, setConfirmation] = useState<{ label: string; count: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const shown = items.filter((i) => (i.category || "Other") === activeCat);
  const cartLines = [...cart.values()];
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.qty * l.item.price, 0);
  const contactOk = name.trim().length > 0 && phone.trim().length >= 7;

  function add(item: OnlineItem) {
    setErr(null);
    setCart((prev) => {
      const n = new Map(prev);
      const ex = n.get(item.id);
      n.set(item.id, { item, qty: (ex?.qty ?? 0) + 1 });
      return n;
    });
  }
  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const n = new Map(prev);
      if (qty <= 0) n.delete(id);
      else {
        const ex = n.get(id);
        if (ex) n.set(id, { ...ex, qty });
      }
      return n;
    });
  }

  async function placeOrder() {
    setErr(null);
    if (cartCount === 0) return;
    if (!contactOk) { setErr("Please add your name and a phone number for pickup."); return; }
    setPlacing(true);
    const supabase = createClient();
    const payload = cartLines.map((l) => ({ catalog_item_id: l.item.id, quantity: l.qty }));
    const { data, error } = await supabase.rpc("submit_online_order", {
      p_business_id: businessId,
      p_customer_name: name.trim(),
      p_customer_phone: phone.trim(),
      p_items: payload,
      p_note: note.trim() || null,
    });
    setPlacing(false);
    const res = (data ?? null) as { ok?: boolean; label?: string; count?: number } | null;
    if (error || !res?.ok) {
      setErr("Sorry — we couldn't place that order. Please call the restaurant.");
      return;
    }
    setConfirmation({ label: res.label ?? "Online", count: res.count ?? cartCount });
    setCart(new Map());
    setName("");
    setPhone("");
    setNote("");
  }

  if (confirmation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-10 h-10">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-zinc-900">Order received!</h1>
        <p className="text-zinc-600 mt-3 text-lg max-w-md">
          {confirmation.count} {confirmation.count === 1 ? "item" : "items"} sent to the kitchen at{" "}
          <span className="font-semibold">{businessName}</span>. We&apos;ll have it ready for pickup —{" "}
          <span className="font-semibold">pay when you collect your order</span>.
        </p>
        <button
          onClick={() => setConfirmation(null)}
          className="mt-10 px-8 py-4 rounded-xl bg-zinc-900 text-white text-lg font-semibold"
        >
          Start a new order
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="px-6 py-4 bg-white border-b border-zinc-200">
        <h1 className="text-xl font-bold text-zinc-900">{businessName}</h1>
        <p className="text-sm text-zinc-500">Order ahead for pickup · pay when you collect</p>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Menu */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex gap-2 overflow-x-auto px-6 py-3 bg-white border-b border-zinc-200">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={
                  "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors " +
                  (c === activeCat ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700")
                }
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {shown.map((it) => (
                <button
                  key={it.id}
                  onClick={() => add(it)}
                  className="text-left rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-900 active:scale-[0.98] transition"
                >
                  <div className="font-semibold text-zinc-900">{it.name}</div>
                  <div className="text-zinc-500 mt-1">{money(it.price)}</div>
                </button>
              ))}
              {shown.length === 0 && <p className="text-zinc-500">Nothing in this section.</p>}
            </div>
          </div>
        </div>

        {/* Cart */}
        <div className="w-full md:w-80 shrink-0 bg-white border-t md:border-t-0 md:border-l border-zinc-200 flex flex-col">
          <div className="px-5 py-4 border-b border-zinc-200">
            <h2 className="font-bold text-zinc-900">Your order ({cartCount})</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cartLines.length === 0 ? (
              <p className="text-zinc-400 text-sm">No items yet. Tap the menu to add.</p>
            ) : (
              cartLines.map((l) => (
                <div key={l.item.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 truncate">{l.item.name}</div>
                    <div className="text-xs text-zinc-500">{money(l.item.price * l.qty)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQty(l.item.id, l.qty - 1)}
                      className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-700 text-lg font-bold leading-none"
                    >
                      −
                    </button>
                    <span className="w-5 text-center tabular-nums">{l.qty}</span>
                    <button
                      onClick={() => setQty(l.item.id, l.qty + 1)}
                      className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-700 text-lg font-bold leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-zinc-200 p-4 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full h-11 rounded-lg border border-zinc-300 px-3 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="Mobile number (for pickup)"
              className="w-full h-11 rounded-lg border border-zinc-300 px-3 text-sm"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder="Pickup time or notes (optional)"
              className="w-full h-11 rounded-lg border border-zinc-300 px-3 text-sm"
            />
            <div className="flex justify-between text-lg font-bold text-zinc-900">
              <span>Total</span>
              <span className="tabular-nums">{money(cartTotal)}</span>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button
              onClick={placeOrder}
              disabled={cartCount === 0 || placing}
              className="w-full h-14 rounded-xl bg-zinc-900 text-white text-lg font-semibold disabled:opacity-40"
            >
              {placing ? "Placing…" : "Place pickup order"}
            </button>
            <p className="text-xs text-zinc-400 text-center">No payment now — pay when you pick up.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
