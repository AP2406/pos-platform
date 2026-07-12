import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { getTodayBoundsUTC } from "@/lib/utils/dates";
import { formatPaymentMethod } from "@/lib/format";
import { VoidButton } from "./void-button";
import { RefundButton } from "./refund-button";
import { ReopenButton } from "./reopen-button";
import { EmailReceiptButton } from "./email-receipt-button";
import { ReprintButton } from "./reprint-button";
import { VOID_REASONS, reasonLabel } from "../reason-codes";

type Row = {
  id: string;
  created_at: string;
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string;
  status: string;
  sale_number: number | null;
  customer_name: string | null;
};

function money(n: number): string {
  return "$" + n.toFixed(2);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function voidReasonText(code: string, note: string): string {
  if (code === "other") return note ? note : "Other";
  return reasonLabel(VOID_REASONS, code);
}

function fmtDateTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function SalesPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";

  const { start: todayStart, end: todayEnd } = getTodayBoundsUTC(tz);

  // Today's totals: bounded by the business-timezone day at the query level,
  // so the figure is complete (not capped at a row limit) and timezone-correct.
  const { data: todayData } = await supabase
    .from("orders")
    .select("subtotal, discount, tax, tip, total, payment_method")
    .eq("business_id", business.id)
    .neq("is_training", true)
    .neq("status", "voided")
    .gte("created_at", todayStart.toISOString())
    .lt("created_at", todayEnd.toISOString());

  const todayRows = (todayData ?? []).map((o) => ({
    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    tax: Number(o.tax) || 0,
    tip: Number(o.tip) || 0,
    total: Number(o.total) || 0,
    payment_method: (o.payment_method as string | null) ?? "cash",
  }));

  const sumOf = (f: (r: { subtotal: number; discount: number; tax: number; tip: number; total: number; payment_method: string }) => number) =>
    round2(todayRows.reduce((a, r) => a + f(r), 0));
  const count = todayRows.length;
  const gross = sumOf((r) => r.subtotal);
  const discounts = sumOf((r) => r.discount);
  const tax = sumOf((r) => r.tax);
  const tips = sumOf((r) => r.tip);
  const collected = sumOf((r) => r.total);

  const byMethod = (m: string) =>
    round2(
      todayRows
        .filter((r) => r.payment_method === m)
        .reduce((a, r) => a + r.total, 0)
    );
  const cash = byMethod("cash");
  const card = byMethod("card");
  const other = byMethod("other");

  // Recent sales: the most recent 50 for the list (includes voided/refunded
  // so their state badges show). Independent of the totals query above.
  const { data } = await supabase
    .from("orders")
    .select(
      "id, created_at, subtotal, discount, tax, tip, total, payment_method, status, sale_number, customer:customers(name)"
    )
    .eq("business_id", business.id)
    .neq("is_training", true)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows: Row[] = (data ?? []).map((o) => {
    const rawCustomer = (o as { customer?: unknown }).customer;
    let customerName: string | null = null;
    if (rawCustomer) {
      const c = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;
      customerName = (c && (c as { name?: string }).name) || null;
    }
    return {
      id: o.id as string,
      created_at: o.created_at as string,
      subtotal: Number(o.subtotal) || 0,
      discount: Number(o.discount) || 0,
      tax: Number(o.tax) || 0,
      tip: Number(o.tip) || 0,
      total: Number(o.total) || 0,
      payment_method: (o.payment_method as string | null) ?? "cash",
      status: (o.status as string | null) ?? "paid",
      sale_number: o.sale_number != null ? Number(o.sale_number) : null,
      customer_name: customerName,
    };
  });

  const list = rows;

  const voidedIds = list.filter((r) => r.status === "voided").map((r) => r.id);
  const voidReasons: Record<string, string> = {};
  if (voidedIds.length > 0) {
    const { data: voidEvents } = await supabase
      .from("audit_events")
      .select("order_id, reason_code, reason_note, created_at")
      .eq("business_id", business.id)
      .eq("action", "void")
      .in("order_id", voidedIds)
      .order("created_at", { ascending: false });
    for (const e of voidEvents ?? []) {
      const oid = (e.order_id as string | null) ?? "";
      if (!oid || voidReasons[oid]) continue;
      const code = (e.reason_code as string | null) ?? "";
      const note = (e.reason_note as string | null) ?? "";
      voidReasons[oid] = voidReasonText(code, note);
    }
  }

  const emailedIds = new Set<string>();
  // P0-8: net append-only adjustments into each order's shown total.
  const adjNet: Record<string, number> = {};
  if (list.length > 0) {
    const allIds = list.map((r) => r.id);
    const { data: emails } = await supabase
      .from("receipt_emails")
      .select("order_id, status")
      .eq("business_id", business.id)
      .eq("status", "sent")
      .in("order_id", allIds);
    for (const e of emails ?? []) {
      emailedIds.add(e.order_id as string);
    }
    const { data: adjustments } = await supabase
      .from("order_adjustments")
      .select("order_id, amount")
      .eq("business_id", business.id)
      .in("order_id", allIds);
    for (const a of adjustments ?? []) {
      const oid = a.order_id as string;
      adjNet[oid] = Math.round(((adjNet[oid] ?? 0) + (Number(a.amount) || 0)) * 100) / 100;
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Totals for today, plus your recent sales. Voided sales are not
          counted.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Today</h2>
          <span className="text-xs text-muted-foreground">
            {count + (count === 1 ? " sale" : " sales")}
          </span>
        </div>

        <div className="text-3xl font-semibold tabular-nums">
          {money(collected)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">collected</div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Gross</div>
            <div className="tabular-nums">{money(gross)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Discounts</div>
            <div
              className={"tabular-nums " + (discounts > 0 ? "text-red-600" : "")}
            >
              {discounts > 0 ? "-" + money(discounts) : money(0)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Tax</div>
            <div className="tabular-nums">{money(tax)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Tips</div>
            <div className="tabular-nums">{money(tips)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Cash</div>
            <div className="tabular-nums">{money(cash)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Card</div>
            <div className="tabular-nums">{money(card)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Other</div>
            <div className="tabular-nums">{money(other)}</div>
          </div>
        </div>
      </div>

      <h2 className="text-sm font-medium text-muted-foreground mb-2">
        Recent sales
      </h2>
      {list.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">No sales yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {list.map((o) => {
            const voided = o.status === "voided";
            const refunded = o.status === "refunded";
            const partiallyRefunded = o.status === "partially_refunded";
            const method = formatPaymentMethod(o.payment_method);
            const numberPrefix =
              o.sale_number != null
                ? "#" + o.sale_number + "  " + "\u00b7" + "  "
                : "";
            return (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {money(adjNet[o.id] !== undefined ? o.total + adjNet[o.id] : o.total)}
                    {adjNet[o.id] !== undefined && (
                      <span className="ml-2 text-xs text-sky-600">Reopened · was {money(o.total)}</span>
                    )}
                    {voided && (
                      <span className="ml-2 text-xs text-red-600">Voided</span>
                    )}
                    {refunded && (
                      <span className="ml-2 text-xs text-amber-600">
                        Refunded
                      </span>
                    )}
                    {partiallyRefunded && (
                      <span className="ml-2 text-xs text-amber-600">
                        Partial refund
                      </span>
                    )}
                  </div>
                  {o.customer_name && (
                    <div className="text-xs text-muted-foreground truncate">
                      {o.customer_name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {numberPrefix +
                      fmtDateTime(o.created_at, tz) +
                      "  " +
                      "\u00b7" +
                      "  " +
                      method}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {voided ? (
                    <>
                      {voidReasons[o.id] && (
                        <div className="text-xs text-muted-foreground max-w-[160px] truncate">
                          {voidReasons[o.id]}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {"Ref: " + o.id.slice(0, 8)}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-3">
                        {!refunded && (
                          <RefundButton
                            orderId={o.id}
                            saleNumber={o.sale_number ?? 0}
                            total={o.total}
                            businessName={business.name}
                          />
                        )}
                        <ReprintButton orderId={o.id} />
                        <EmailReceiptButton orderId={o.id} />
                        {o.status === "paid" && <VoidButton orderId={o.id} />}
                        <ReopenButton orderId={o.id} saleNumber={o.sale_number ?? 0} total={o.total} />
                      </div>
                      {emailedIds.has(o.id) && (
                        <span className="text-xs text-emerald-500">Emailed</span>
                      )}
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