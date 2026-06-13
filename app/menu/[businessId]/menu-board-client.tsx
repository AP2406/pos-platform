"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type MenuBoardItem = { name: string; price: number; category: string | null; out_of_stock: boolean };

const money = (n: number) => "$" + (Number(n) || 0).toFixed(2);

export function MenuBoardClient({
  businessId,
  businessName,
  initialItems,
}: {
  businessId: string;
  businessName: string;
  initialItems: MenuBoardItem[];
}) {
  const [items, setItems] = useState<MenuBoardItem[]>(initialItems);

  // Refresh so 86 / new items reflect on the board within ~30s.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const pull = async () => {
      const { data } = await supabase.rpc("get_public_menu", { p_business_id: businessId });
      const m = data as { items?: MenuBoardItem[] } | null;
      if (!cancelled && m?.items) setItems(m.items);
    };
    const id = setInterval(pull, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [businessId]);

  const groups: { name: string; items: MenuBoardItem[] }[] = [];
  for (const it of items) {
    const cat = (it.category || "Menu").trim() || "Menu";
    let g = groups.find((x) => x.name === cat);
    if (!g) { g = { name: cat, items: [] }; groups.push(g); }
    g.items.push(it);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <h1 className="text-4xl font-bold tracking-tight mb-8 text-center">{businessName}</h1>
      {items.length === 0 ? (
        <p className="text-center text-zinc-400">Menu coming soon.</p>
      ) : (
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          {groups.map((g) => (
            <div key={g.name}>
              <h2 className="text-xl font-semibold uppercase tracking-wide text-amber-400 border-b border-zinc-800 pb-2 mb-3">{g.name}</h2>
              <div className="space-y-2.5">
                {g.items.map((it, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3">
                    <span className={"text-lg " + (it.out_of_stock ? "text-zinc-600 line-through" : "")}>
                      {it.name}
                      {it.out_of_stock && <span className="ml-2 text-xs uppercase tracking-wide text-zinc-500 no-underline">Sold out</span>}
                    </span>
                    <span className="flex-1 border-b border-dotted border-zinc-700 mx-1 translate-y-[-3px]" />
                    <span className={"text-lg tabular-nums " + (it.out_of_stock ? "text-zinc-600" : "text-zinc-300")}>{money(it.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
