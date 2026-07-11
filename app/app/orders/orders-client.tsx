"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markOrderFulfilled, recallOrder } from "../kitchen/actions";

export type OrderRow = {
  id: string;
  saleNumber: number | null;
  total: number;
  createdAt: string;
  channel: string | null;
  diningOption: string | null;
  fulfilledAt: string | null;
  status: string;
  customerName: string | null;
};

type ChannelKey = "dine_in" | "takeout" | "pickup" | "delivery" | "online" | "kiosk" | "qr" | "other";

// Collapse an order's channel + dining option into one fulfillment channel.
function channelOf(o: OrderRow): ChannelKey {
  const ch = (o.channel || "").toLowerCase();
  const d = (o.diningOption || "").toLowerCase();
  if (ch === "delivery" || d === "delivery") return "delivery";
  if (d === "pickup") return "pickup";
  if (d === "takeout") return "takeout";
  if (ch === "online") return "online";
  if (ch === "kiosk") return "kiosk";
  if (ch === "qr") return "qr";
  if (d === "dine_in") return "dine_in";
  return "other";
}

const CHANNEL_LABEL: Record<ChannelKey, string> = {
  dine_in: "Dine-in", takeout: "Takeout", pickup: "Pickup", delivery: "Delivery",
  online: "Online", kiosk: "Kiosk", qr: "QR table", other: "Other",
};
const CHANNEL_BADGE: Record<ChannelKey, string> = {
  dine_in: "🍽", takeout: "🥡", pickup: "🛍", delivery: "🚗", online: "🌐", kiosk: "🖥", qr: "📱", other: "•",
};

function money(n: number): string {
  return "$" + (Number(n) || 0).toFixed(2);
}

export function OrdersClient({ initialOrders, timezone }: { initialOrders: OrderRow[]; timezone: string }) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [tab, setTab] = useState<"all" | ChannelKey>("all");
  const [view, setView] = useState<"active" | "completed">("active");
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }),
    [timezone]
  );

  // Which channels actually appear (so we don't show empty tabs).
  const presentChannels = useMemo(() => {
    const set = new Set<ChannelKey>();
    for (const o of orders) set.add(channelOf(o));
    return (["dine_in", "takeout", "pickup", "delivery", "online", "kiosk", "qr", "other"] as ChannelKey[]).filter((c) => set.has(c));
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (tab !== "all" && channelOf(o) !== tab) return false;
      const active = !o.fulfilledAt;
      return view === "active" ? active : !active;
    });
  }, [orders, tab, view]);

  const activeCount = (c: "all" | ChannelKey) =>
    orders.filter((o) => !o.fulfilledAt && (c === "all" || channelOf(o) === c)).length;

  function complete(id: string) {
    setBusyId(id);
    start(async () => {
      const res = await markOrderFulfilled(id);
      if (!("error" in res)) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, fulfilledAt: new Date().toISOString() } : o)));
      }
      setBusyId(null);
    });
  }
  function reopen(id: string) {
    setBusyId(id);
    start(async () => {
      const res = await recallOrder(id);
      if (!("error" in res)) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, fulfilledAt: null } : o)));
      }
      setBusyId(null);
    });
  }

  return (
    <div>
      {/* Channel tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button type="button" onClick={() => setTab("all")} className={"px-3 py-1.5 rounded-md text-sm border " + (tab === "all" ? "border-foreground bg-accent font-medium" : "border-border hover:bg-accent/50")}>
          All{activeCount("all") > 0 && <span className="ml-1 text-xs text-muted-foreground">{activeCount("all")}</span>}
        </button>
        {presentChannels.map((c) => (
          <button key={c} type="button" onClick={() => setTab(c)} className={"px-3 py-1.5 rounded-md text-sm border " + (tab === c ? "border-foreground bg-accent font-medium" : "border-border hover:bg-accent/50")}>
            {CHANNEL_BADGE[c]} {CHANNEL_LABEL[c]}{activeCount(c) > 0 && <span className="ml-1 text-xs text-muted-foreground">{activeCount(c)}</span>}
          </button>
        ))}
      </div>

      {/* Active / Completed */}
      <div className="flex rounded-md border border-border overflow-hidden text-sm w-fit mb-4">
        <button type="button" onClick={() => setView("active")} className={"px-4 py-1.5 " + (view === "active" ? "bg-foreground text-background" : "hover:bg-accent")}>Active</button>
        <button type="button" onClick={() => setView("completed")} className={"px-4 py-1.5 border-l border-border " + (view === "completed" ? "bg-foreground text-background" : "hover:bg-accent")}>Completed</button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No {view} orders{tab !== "all" ? " in " + CHANNEL_LABEL[tab as ChannelKey] : ""}.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {filtered.map((o) => {
            const ch = channelOf(o);
            return (
              <div key={o.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    <span className="mr-1">{CHANNEL_BADGE[ch]}</span>
                    {o.saleNumber != null ? "#" + o.saleNumber : o.id.slice(0, 8)}
                    <span className="ml-2 text-xs text-muted-foreground">{CHANNEL_LABEL[ch]}</span>
                    {o.customerName && <span className="ml-2 text-xs text-muted-foreground truncate">· {o.customerName}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {timeFmt.format(new Date(o.createdAt))} · {money(o.total)}
                    {o.status === "refunded" && <span className="ml-2 text-red-600">Refunded</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  {o.fulfilledAt ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-600 font-medium">Completed</span>
                      <button type="button" onClick={() => reopen(o.id)} disabled={pending && busyId === o.id} className="text-xs text-muted-foreground underline hover:text-foreground">Reopen</button>
                    </div>
                  ) : (
                    <Button className="h-8" disabled={pending && busyId === o.id} onClick={() => complete(o.id)}>
                      {pending && busyId === o.id ? "…" : "Mark ready"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
