import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { reasonLabelForAction } from "../pos/reason-codes";

type Event = {
  id: string;
  action: string;
  order_id: string | null;
  reason_code: string;
  reason_note: string | null;
  actor_role: string | null;
  amount: number | null;
  created_at: string;
};

const ACTIONS = ["void", "discount", "refund"];

function actionMeta(action: string): { label: string; cls: string } {
  if (action === "void") return { label: "Void", cls: "text-red-500 border-red-500/30 bg-red-500/10" };
  if (action === "discount") return { label: "Discount", cls: "text-amber-500 border-amber-500/30 bg-amber-500/10" };
  if (action === "refund") return { label: "Refund", cls: "text-sky-500 border-sky-500/30 bg-sky-500/10" };
  return { label: action, cls: "text-muted-foreground border-border" };
}

function money(n: number): string {
  return "$" + n.toFixed(2);
}

function fmt(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { business, role } = await requireBusiness();

  if (role !== "owner" && role !== "manager") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Activity log</h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">
            Only owners and managers can view the activity log.
          </p>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const filter = sp.action && ACTIONS.indexOf(sp.action) >= 0 ? sp.action : null;

  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";

  let query = supabase
    .from("audit_events")
    .select("id, action, order_id, reason_code, reason_note, actor_role, metadata, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter) query = query.eq("action", filter);

  const { data } = await query;

  const events: Event[] = (data ?? []).map((e) => {
    const meta = (e.metadata as { amount?: number } | null) ?? null;
    const amount =
      meta && typeof meta.amount === "number" ? Math.round(meta.amount * 100) / 100 : null;
    return {
      id: e.id as string,
      action: (e.action as string) || "",
      order_id: (e.order_id as string | null) ?? null,
      reason_code: (e.reason_code as string | null) ?? "",
      reason_note: (e.reason_note as string | null) ?? null,
      actor_role: (e.actor_role as string | null) ?? null,
      amount: amount,
      created_at: e.created_at as string,
    };
  });

  const orderIds = Array.from(
    new Set(events.map((e) => e.order_id).filter((id): id is string => !!id))
  );
  const saleNumbers: Record<string, number | null> = {};
  if (orderIds.length > 0) {
    const { data: ords } = await supabase
      .from("orders")
      .select("id, sale_number")
      .eq("business_id", business.id)
      .in("id", orderIds);
    for (const o of ords ?? []) {
      saleNumbers[o.id as string] = o.sale_number != null ? Number(o.sale_number) : null;
    }
  }

  const tabs: { key: string | null; label: string }[] = [
    { key: null, label: "All" },
    { key: "void", label: "Voids" },
    { key: "discount", label: "Discounts" },
    { key: "refund", label: "Refunds" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Activity log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          A record of sensitive actions: voids, discounts, and refunds. Most
          recent first.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => {
          const active = filter === t.key || (t.key === null && filter === null);
          const href = t.key ? "/app/audit?action=" + t.key : "/app/audit";
          return (
            <Link
              key={t.label}
              href={href}
              className={
                "px-3 py-1.5 text-sm rounded-md border transition-colors " +
                (active
                  ? "border-foreground bg-accent font-medium"
                  : "border-border hover:border-foreground/40")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {events.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {events.map((e) => {
            const meta = actionMeta(e.action);
            const sale =
              e.order_id && saleNumbers[e.order_id] != null
                ? "Sale #" + saleNumbers[e.order_id]
                : null;
            const reason = reasonLabelForAction(e.action, e.reason_code);
            return (
              <div key={e.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={"text-xs px-2 py-0.5 rounded-md border " + meta.cls}
                    >
                      {meta.label}
                    </span>
                    {sale && (
                      <span className="text-sm font-medium">{sale}</span>
                    )}
                    {e.amount != null && (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {money(e.amount)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm mt-1">{reason}</div>
                  {e.reason_note && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {e.reason_note}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-muted-foreground">
                    {fmt(e.created_at, tz)}
                  </div>
                  {e.actor_role && (
                    <div className="text-xs text-muted-foreground capitalize">
                      {e.actor_role}
                    </div>
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