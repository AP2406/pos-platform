"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck, Inbox, ListFilter, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
  // Mark-ready used to fail as quietly as the list used to render empty: the
  // action answers { error }, this component only ever checked for success, and
  // the button simply sprang back as though the click had never happened. Hold
  // the failure on screen and keep the exact click that failed retryable.
  const [failure, setFailure] = useState<{ message: string; retry: () => void } | null>(null);

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
      if ("error" in res) {
        setFailure({ message: res.error, retry: () => complete(id) });
      } else {
        setFailure(null);
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, fulfilledAt: new Date().toISOString() } : o)));
      }
      setBusyId(null);
    });
  }
  function reopen(id: string) {
    setBusyId(id);
    start(async () => {
      const res = await recallOrder(id);
      if ("error" in res) {
        setFailure({ message: res.error, retry: () => reopen(id) });
      } else {
        setFailure(null);
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, fulfilledAt: null } : o)));
      }
      setBusyId(null);
    });
  }

  // Nothing here and something broke are opposite facts, and this screen used
  // to render both as the same grey sentence. A broken *load* now throws in the
  // server component (must(), see page.tsx) and surfaces through
  // app/app/error.tsx, so all that's left for the list is to say which kind of
  // nothing this is: none ever, or none under the filter the user just picked.
  function emptyState() {
    if (orders.length === 0) {
      return (
        <EmptyState
          icon={<Inbox />}
          title="No orders yet"
          description="Every sale rung up on the register lands here, along with anything that arrives from online, kiosk, QR or delivery."
          action={
            <Button variant="outline" asChild>
              <Link href="/app/pos">Open the register</Link>
            </Button>
          }
        />
      );
    }

    // Past this point the hub does hold orders, so the filter is what's empty.
    // Say how many are sitting just outside it, or the user is left wondering
    // whether the tab is broken.
    if (tab !== "all") {
      const elsewhere = orders.filter((o) => (view === "active" ? !o.fulfilledAt : !!o.fulfilledAt)).length;
      return (
        <EmptyState
          icon={<ListFilter />}
          title={"No " + view + " " + CHANNEL_LABEL[tab as ChannelKey] + " orders"}
          description={
            elsewhere > 0
              ? elsewhere + " " + view + " " + (elsewhere === 1 ? "order is" : "orders are") + " on other channels."
              : "No channel has " + (view === "active" ? "anything waiting" : "anything completed") + " right now."
          }
          action={
            <Button variant="outline" onClick={() => setTab("all")}>
              Show all channels
            </Button>
          }
        />
      );
    }

    if (view === "active") {
      return (
        <EmptyState
          icon={<CircleCheck />}
          title="Nothing waiting"
          description={
            "All " + orders.length + " recent " + (orders.length === 1 ? "order has" : "orders have") + " been marked ready."
          }
          action={
            <Button variant="outline" onClick={() => setView("completed")}>
              See completed
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        icon={<Inbox />}
        title="Nothing completed yet"
        description={
          "All " + orders.length + " recent " + (orders.length === 1 ? "order is" : "orders are") + " still open."
        }
        action={
          <Button variant="outline" onClick={() => setView("active")}>
            See active
          </Button>
        }
      />
    );
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

      {failure && (
        <div role="alert" className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg bg-raised ring-1 ring-destructive/30 px-3 py-2.5">
          <div className="flex min-w-0 gap-2.5">
            <TriangleAlert className="size-4 shrink-0 mt-0.5 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm font-medium">That didn&rsquo;t go through</p>
              <p className="text-xs text-muted-foreground mt-0.5">{failure.message} The order is unchanged.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const again = failure.retry;
                setFailure(null);
                again();
              }}
            >
              Try again
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setFailure(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        emptyState()
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
