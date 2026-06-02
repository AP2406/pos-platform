import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { VoidButton } from "./void-button";
import { EmailReceiptButton } from "./email-receipt-button";
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

function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

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

export default async function SalesPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";

  const { data } = await supabase
    .from("orders")
    .select(
      "id, created_at, subtotal, discount, tax, tip, total, payment_method, status, sale_number, customer:customers(name)"
    )
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(200);

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

  const todayKey = dayKey(new Date().toISOString(), tz);
  const today = rows.filter(
    (r) => r.status !== "voided" && dayKey(r.created_at, tz) === todayKey
  );

  const sumOf = (f: (r: Row) => number) =>
    round2(today.reduce((a, r) => a + f(r), 0));
  const count = today.length;
  const gross = sumOf((r) => r.subtotal);
  const discounts = sumOf((r) => r.discount);
  const tax = sumOf((r) => r.tax);
  const tips = sumOf((r) => r.tip);
  const collected = sumOf((r) => r.total);

  const byMethod = (m: string) =>
    round2(
      today
        .filter((r) => r.payment_method === m)
        .reduce((a, r) => a + r.total, 0)
    );
  const cash = byMethod("cash");
  const card = byMethod("card");
  const other = byMethod("other");

  const list = rows.slice(0, 50);

  // Recorded void reasons for any voided sales on screen.
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

  // Which sales have had a receipt emailed.
  const emailedIds = new Set<string>();
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
            const method =
              o.payment_method.charAt(0).toUpperCase() +
              o.payment_method.slice(1);
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
                    {money(o.total)}
                    {voided && (
                      <span className="ml-2 text-xs text-red-600">Voided</span>
                    )}
                  </div>
                  {o.customer_name && (
                    <div className="text-xs text-muted-foreground truncate">
                      {o.customer_name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {numberPrefix +
                      new Date(o.created_at).toLocaleString() +
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
                        <EmailReceiptButton orderId={o.id} />
                        <VoidButton orderId={o.id} />
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