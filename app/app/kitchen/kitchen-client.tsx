"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { markOrderFulfilled } from "./actions";

type KitchenOrder = {
  id: string;
  total: number;
  createdAt: string;
  customerName: string | null;
  items: { name: string; quantity: number }[];
};

export function KitchenClient({
  businessId,
  initialOrders,
}: {
  businessId: string;
  initialOrders: KitchenOrder[];
}) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const supabase = createClient();

    const { data: orderRows } = await supabase
      .from("orders")
      .select("id, total, customer_id, created_at")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .is("fulfilled_at", null)
      .order("created_at", { ascending: true });

    const rows = orderRows ?? [];
    const ids = rows.map((o) => o.id as string);

    const itemsByOrder: Record<string, { name: string; quantity: number }[]> = {};
    if (ids.length > 0) {
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, name, quantity")
        .in("order_id", ids);
      for (const it of items ?? []) {
        const oid = it.order_id as string;
        if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
        itemsByOrder[oid].push({
          name: it.name as string,
          quantity: Number(it.quantity),
        });
      }
    }

    const customerNames: Record<string, string> = {};
    const custIds = rows
      .map((o) => o.customer_id as string | null)
      .filter((x): x is string => !!x);
    if (custIds.length > 0) {
      const { data: custs } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", custIds);
      for (const c of custs ?? []) {
        customerNames[c.id as string] = c.name as string;
      }
    }

    setOrders(
      rows.map((o) => ({
        id: o.id as string,
        total: Number(o.total),
        createdAt: (o.created_at as string) ?? new Date().toISOString(),
        customerName: o.customer_id
          ? customerNames[o.customer_id as string] ?? null
          : null,
        items: itemsByOrder[o.id as string] ?? [],
      }))
    );
  }, [businessId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("kitchen-orders-" + businessId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: "business_id=eq." + businessId,
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, refresh]);

  function handleDone(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    startTransition(async () => {
      const res = await markOrderFulfilled(id);
      if ("error" in res) {
        refresh();
      }
    });
  }

  function timeLabel(iso: string): string {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    const mm = m < 10 ? "0" + m : "" + m;
    return h + ":" + mm + " " + ampm;
  }

  if (orders.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No open orders. New sales will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {orders.map((o) => (
        <div
          key={o.id}
          className="bg-card border border-border rounded-lg p-4 flex flex-col"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">{"#" + o.id.slice(0, 8)}</span>
            <span className="text-xs text-muted-foreground">
              {timeLabel(o.createdAt)}
            </span>
          </div>
          {o.customerName && (
            <div className="text-xs text-muted-foreground mb-2">
              {o.customerName}
            </div>
          )}
          <div className="space-y-1 text-sm flex-1">
            {o.items.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Loading items...
              </div>
            ) : (
              o.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span className="truncate">{it.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {"x" + it.quantity}
                  </span>
                </div>
              ))
            )}
          </div>
          <Button
            className="w-full mt-3"
            onClick={() => handleDone(o.id)}
            disabled={pending}
          >
            Done
          </Button>
        </div>
      ))}
    </div>
  );
}