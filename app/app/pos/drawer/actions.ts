"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { getActiveStaff } from "../staff-session";
import { actorCan, approverByPin } from "@/lib/services/permissions-server";
import { businessDateFor, parseCutoff } from "@/lib/services/business-day";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { CASH_MOVEMENT_REASONS, isValidReason } from "../reason-codes";

// No Sale / Pay In / Pay Out / Safe Drop. Recorded in cash_movements and folded
// into the closeout expected-cash total. Pay Out needs a reason; cash
// adjustments by a staff/trainee need a manager PIN (mirrors the void/refund
// gate). A safe drop moves cash from the till to the safe — it reduces expected
// cash just like a pay out, and is gated the same way.
export async function recordCashMovement(input: {
  kind: "pay_in" | "pay_out" | "no_sale" | "drop";
  amount?: number;
  reason_code?: string;
  reason_note?: string;
  approver_pin?: string;
}): Promise<{ ok: true } | { needs_approval: true } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const kind = input.kind;
  if (kind !== "pay_in" && kind !== "pay_out" && kind !== "no_sale" && kind !== "drop") {
    return { error: "Invalid action." };
  }

  let amount = 0;
  if (kind !== "no_sale") {
    amount = Math.round((Number(input.amount) || 0) * 100) / 100;
    if (amount <= 0) return { error: "Enter an amount greater than zero." };
    if (amount > 100000) return { error: "That amount is too large." };
  }

  if (kind === "pay_out") {
    if (!input.reason_code || !isValidReason(CASH_MOVEMENT_REASONS, input.reason_code)) {
      return { error: "Choose a reason for the pay out." };
    }
    if (input.reason_code === "other" && !(input.reason_note && input.reason_note.trim())) {
      return { error: "Add a note for the pay out." };
    }
  }

  const { data: session } = await supabase
    .from("drawer_sessions")
    .select("id")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  if (kind !== "no_sale" && !session) {
    return { error: "Start the day before moving cash." };
  }

  // The active operator needs the `open_drawer` permission for a cash
  // adjustment; otherwise someone who holds it must approve by PIN.
  // Behavior-preserving (server/host need a manager; manager/owner don't).
  if (kind !== "no_sale") {
    const active = await getActiveStaff();
    if (active && !(await actorCan(supabase, business.id, active.id, "open_drawer"))) {
      if (!input.approver_pin) return { needs_approval: true };
      const approver = await approverByPin(supabase, business.id, input.approver_pin, "open_drawer");
      if (!approver) return { error: "That PIN can't approve this." };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("cash_movements").insert({
    business_id: business.id,
    drawer_session_id: session ? session.id : null,
    kind: kind,
    amount: amount,
    reason_code: input.reason_code ?? null,
    reason_note: input.reason_note ? input.reason_note.trim().slice(0, 500) : null,
    created_by: user ? user.id : null,
  });
  if (error) {
    console.error("recordCashMovement:", error);
    return { error: "Could not record that. Please try again." };
  }

  revalidatePath("/app/pos/drawer");
  return { ok: true };
}

export async function openDrawerSession(
  startingCash: number
): Promise<{ ok: true } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const start = Math.round((Number(startingCash) || 0) * 100) / 100;
  if (start < 0) return { error: "Starting cash cannot be negative." };

  const { data: existing } = await supabase
    .from("drawer_sessions")
    .select("id")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  if (existing) {
    return { error: "The day is already started. End it first." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("drawer_sessions").insert({
    business_id: business.id,
    opened_by: user ? user.id : null,
    starting_cash: start,
    status: "open",
  });

  if (error) {
    console.error("openDrawerSession:", error);
    // The partial unique index also rejects a double-open race.
    return { error: "Could not start the day. It may already be started." };
  }

  revalidatePath("/app/pos/drawer");
  revalidatePath("/app/pos");
  return { ok: true };
}

export type ServerSales = { staff_id: string; name: string; sales: number; count: number };

export type DayTotals = {
  starting_cash: number;
  gross_sales: number;
  net_sales: number;
  tax: number;
  service_charge: number;
  tips: number;
  discounts: number;
  comps: number;
  void_count: number;
  void_amount: number;
  cash_sales: number;
  card_sales: number;
  gift_sales: number;
  store_credit_sales: number;
  other_sales: number;
  refunds: number;
  pay_ins: number;
  pay_outs: number;
  drops: number;
  sale_count: number;
  expected_cash: number;
  per_server: ServerSales[];
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Shared totals for a drawer session — used by both the X-report (read) and the
// Z-report (close). Cash reconciliation math is identical to the original close.
async function computeDayTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  sessionId: string,
  startingCash: number
): Promise<DayTotals> {
  const { data: sessionOrders } = await supabase
    .from("orders")
    .select("id, total, subtotal, tax, service_charge, tip, discount, comp, payment_method, status, staff_id")
    .eq("business_id", businessId)
    .eq("drawer_session_id", sessionId)
    .neq("is_training", true);

  const all = sessionOrders ?? [];
  const live = all.filter((o) => (o.status as string) !== "voided");
  const voided = all.filter((o) => (o.status as string) === "voided");
  const orderIds = live.map((o) => o.id as string);

  let payments: { order_id: string; method: string; amount: number }[] = [];
  if (orderIds.length > 0) {
    const { data: payData } = await supabase
      .from("payments")
      .select("order_id, method, amount")
      .eq("business_id", businessId)
      .in("order_id", orderIds);
    payments = (payData ?? []).map((p) => ({
      order_id: p.order_id as string,
      method: p.method as string,
      amount: Number(p.amount) || 0,
    }));
  }
  const withPay = new Set(payments.map((p) => p.order_id));

  // Tender split — cash / card / gift card / store credit / other, kept
  // separate (the Z-report breaks them out individually).
  const tender = { cash: 0, card: 0, gift: 0, store_credit: 0, other: 0 };
  const bucket = (m: string): keyof typeof tender =>
    m === "cash" ? "cash"
    : m === "card" ? "card"
    : m === "gift_card" ? "gift"
    : m === "store_credit" ? "store_credit"
    : "other";
  for (const p of payments) tender[bucket(p.method)] += p.amount;
  for (const o of live) {
    if (withPay.has(o.id as string)) continue;
    tender[bucket((o.payment_method as string) || "cash")] += Number(o.total) || 0;
  }

  let gross = 0, net = 0, tax = 0, svc = 0, tips = 0, disc = 0, comp = 0;
  // Per-server sales (by the order's staff_id), gross + transaction count.
  const serverAgg: Record<string, { sales: number; count: number }> = {};
  for (const o of live) {
    gross += Number(o.total) || 0;
    net += Number(o.subtotal) || 0;
    tax += Number(o.tax) || 0;
    svc += Number(o.service_charge) || 0;
    tips += Number(o.tip) || 0;
    disc += Number(o.discount) || 0;
    comp += Number(o.comp) || 0;
    const sid = (o.staff_id as string | null) || null;
    if (sid) {
      if (!serverAgg[sid]) serverAgg[sid] = { sales: 0, count: 0 };
      serverAgg[sid].sales += Number(o.total) || 0;
      serverAgg[sid].count += 1;
    }
  }
  let voidAmt = 0;
  for (const o of voided) voidAmt += Number(o.total) || 0;

  // Resolve server names for the per-server breakdown.
  let perServer: ServerSales[] = [];
  const serverIds = Object.keys(serverAgg);
  if (serverIds.length > 0) {
    const { data: staffRows } = await supabase
      .from("staff_members")
      .select("id, name")
      .eq("business_id", businessId)
      .in("id", serverIds);
    const nameById = new Map(
      (staffRows ?? []).map((s) => [s.id as string, (s.name as string) || "Staff"])
    );
    perServer = serverIds
      .map((id) => ({
        staff_id: id,
        name: nameById.get(id) || "Staff",
        sales: r2(serverAgg[id].sales),
        count: serverAgg[id].count,
      }))
      .sort((a, b) => b.sales - a.sales);
  }

  const { data: refundData } = await supabase
    .from("refunds")
    .select("amount")
    .eq("business_id", businessId)
    .eq("drawer_session_id", sessionId);
  let refunds = 0;
  for (const r of refundData ?? []) refunds += Number(r.amount) || 0;

  const { data: moveData } = await supabase
    .from("cash_movements")
    .select("kind, amount")
    .eq("business_id", businessId)
    .eq("drawer_session_id", sessionId);
  let payIns = 0, payOuts = 0, drops = 0;
  for (const m of moveData ?? []) {
    const a = Number(m.amount) || 0;
    if (m.kind === "pay_in") payIns += a;
    else if (m.kind === "pay_out") payOuts += a;
    else if (m.kind === "drop") drops += a;
  }

  // Expected cash = float + cash sales − cash refunds + pay-ins − pay-outs − safe drops.
  const expected = r2(
    startingCash + r2(tender.cash) - r2(refunds) + r2(payIns) - r2(payOuts) - r2(drops)
  );
  return {
    starting_cash: r2(startingCash),
    gross_sales: r2(gross),
    net_sales: r2(net),
    tax: r2(tax),
    service_charge: r2(svc),
    tips: r2(tips),
    discounts: r2(disc),
    comps: r2(comp),
    void_count: voided.length,
    void_amount: r2(voidAmt),
    cash_sales: r2(tender.cash),
    card_sales: r2(tender.card),
    gift_sales: r2(tender.gift),
    store_credit_sales: r2(tender.store_credit),
    other_sales: r2(tender.other),
    refunds: r2(refunds),
    pay_ins: r2(payIns),
    pay_outs: r2(payOuts),
    drops: r2(drops),
    sale_count: live.length,
    expected_cash: expected,
    per_server: perServer,
  };
}

// X-report: a mid-day read of the open session. Does NOT finalize anything.
export async function getXReport(): Promise<
  { ok: true; totals: DayTotals; open_check_count: number } | { error: string }
> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("drawer_sessions")
    .select("id, starting_cash")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  if (!session) return { error: "No open day to read." };
  const totals = await computeDayTotals(
    supabase,
    business.id,
    session.id as string,
    Number(session.starting_cash) || 0
  );
  const { count } = await supabase
    .from("open_tickets")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);
  return { ok: true, totals, open_check_count: count ?? 0 };
}

type CloseResult =
  | ({ ok: true; counted: number; over_short: number; z_business_date: string } & DayTotals)
  | { needs_approval: true }
  | { needs_open_check_confirm: true; open_checks: { id: string; label: string | null }[]; needs_reason: true }
  | { error: string };

export async function closeDrawerSession(input: {
  counted_cash: number;
  note?: string;
  blind?: boolean;
  confirm_open_checks?: boolean;
  override_reason?: string;
  approver_pin?: string;
}): Promise<CloseResult> {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("drawer_sessions")
    .select("id, starting_cash, opened_at")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  if (!session) {
    return { error: "There is no open day to end." };
  }

  // Ending the day is gated on the `close_day` permission, enforced server-side.
  // If the active operator lacks it, a manager must approve by PIN. Non-staffed
  // tills (no active cashier — QSR/retail/transportation) are unaffected.
  const active = await getActiveStaff();
  let approver: { id: string; name: string } | null = null;
  if (active && !(await actorCan(supabase, business.id, active.id, "close_day"))) {
    if (!input.approver_pin) return { needs_approval: true };
    approver = await approverByPin(supabase, business.id, input.approver_pin, "close_day");
    if (!approver) return { error: "That PIN can't end the day." };
  }

  // Open-check guard: never close over unpaid checks unless a manager (the
  // close_day holder above) has seen the list AND given a reason. The override
  // is recorded to audit_events with the reason and the open-check count.
  const { data: openChecksData } = await supabase
    .from("open_tickets")
    .select("id, label")
    .eq("business_id", business.id)
    .order("opened_at", { ascending: true });
  const openChecks = openChecksData ?? [];
  const overrideReason = (input.override_reason || "").trim();
  if (openChecks.length > 0) {
    if (!input.confirm_open_checks) {
      return {
        needs_open_check_confirm: true,
        needs_reason: true,
        open_checks: openChecks.map((c) => ({
          id: c.id as string,
          label: (c.label as string | null) ?? null,
        })),
      };
    }
    if (!overrideReason) {
      return { error: "A reason is required to end the day over open checks." };
    }
  }

  const startingCash = Number(session.starting_cash) || 0;
  const totals = await computeDayTotals(supabase, business.id, session.id as string, startingCash);
  const counted = r2(Number(input.counted_cash) || 0);
  const overShort = r2(counted - totals.expected_cash);

  const closeout = {
    ...totals,
    counted_cash: counted,
    over_short: overShort,
    blind: !!input.blind,
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("drawer_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user ? user.id : null,
      counted_cash: counted,
      expected_cash: totals.expected_cash,
      over_short: overShort,
      note: input.note && input.note.trim() ? input.note.trim().slice(0, 500) : null,
      closeout: closeout,
    })
    .eq("id", session.id)
    .eq("business_id", business.id)
    .eq("status", "open");

  if (error) {
    console.error("closeDrawerSession:", error);
    return { error: "Could not end the day. Please try again." };
  }

  // Audit the close: who ended the day, the headline figures, and — if it was
  // forced over open checks — the reason and how many were left unpaid.
  await supabase.from("audit_events").insert({
    business_id: business.id,
    actor_id: user ? user.id : null,
    actor_role: role,
    action: openChecks.length > 0 ? "day_close_forced" : "day_close",
    reason_code: openChecks.length > 0 ? "open_checks_override" : null,
    reason_note: openChecks.length > 0 ? overrideReason.slice(0, 500) : null,
    metadata: {
      drawer_session_id: session.id,
      staff_id: active?.id ?? null,
      staff_name: active?.name ?? null,
      approved_by: approver?.id ?? null,
      approver_name: approver?.name ?? null,
      open_check_count: openChecks.length,
      expected_cash: totals.expected_cash,
      counted_cash: counted,
      over_short: overShort,
      gross_sales: totals.gross_sales,
      blind: !!input.blind,
    },
  });

  // File the immutable Z-report for the business day (cutoff-aware). Non-fatal
  // if it can't be written (the drawer is already closed); a duplicate day is
  // ignored by the unique(business_id, business_date) constraint.
  const cutoff = parseCutoff((business as { settings?: Record<string, unknown> }).settings);
  const tz = (business as { timezone?: string }).timezone || "UTC";
  const openedAt = (session.opened_at as string) || new Date().toISOString();
  const businessDate = businessDateFor(openedAt, cutoff, tz);
  const { error: zErr } = await supabase.from("z_reports").insert({
    business_id: business.id,
    business_date: businessDate,
    opened_at: openedAt,
    drawer_session_id: session.id as string,
    totals: closeout,
    created_by: user ? user.id : null,
  });
  if (zErr && (zErr as { code?: string }).code !== "23505") {
    console.error("z_report insert:", zErr);
  }

  // Auto-email the Z-report to the configured recipients (best-effort).
  const settings = (business as { settings?: Record<string, unknown> }).settings ?? {};
  const recipients = Array.isArray((settings as { z_report_emails?: unknown }).z_report_emails)
    ? ((settings as { z_report_emails: unknown[] }).z_report_emails.filter(
        (e): e is string => typeof e === "string"
      ))
    : [];
  if (recipients.length > 0 && isEmailConfigured()) {
    const bizName = (business as { name?: string }).name || "Your business";
    const fmt = (n: number) =>
      "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
    const rows: [string, string][] = [
      ["Gross sales", fmt(totals.gross_sales)],
      ["Net (pre-tax)", fmt(totals.net_sales)],
      ["Tax (GST/HST)", fmt(totals.tax)],
      ["Service charge", fmt(totals.service_charge)],
      ["Tips", fmt(totals.tips)],
      ["Discounts", fmt(totals.discounts)],
      ["Comps", fmt(totals.comps)],
      ["Voids", `${totals.void_count} · ${fmt(totals.void_amount)}`],
      ["Cash", fmt(totals.cash_sales)],
      ["Card", fmt(totals.card_sales)],
      ["Gift card", fmt(totals.gift_sales)],
      ["Store credit", fmt(totals.store_credit_sales)],
      ["Other tender", fmt(totals.other_sales)],
      ["Refunds", fmt(totals.refunds)],
      ["Pay in / out", `${fmt(totals.pay_ins)} / ${fmt(totals.pay_outs)}`],
      ["Safe drops", fmt(totals.drops)],
      ["Expected cash", fmt(totals.expected_cash)],
      ["Counted cash", fmt(counted)],
      ["Over / short", (overShort > 0 ? "+" : "") + fmt(overShort)],
    ];
    const serverHtml =
      totals.per_server.length > 0
        ? `<h3 style="margin-top:16px">Sales by server</h3>` +
          `<table cellpadding="6" style="border-collapse:collapse">` +
          totals.per_server
            .map(
              (s) =>
                `<tr><td style="color:#666">${s.name} · ${s.count} sale(s)</td><td style="text-align:right;font-variant-numeric:tabular-nums"><strong>${fmt(s.sales)}</strong></td></tr>`
            )
            .join("") +
          `</table>`
        : "";
    const html =
      `<h2>Z-report — ${bizName}</h2><p>Business day ${businessDate} · ${totals.sale_count} transaction(s)</p>` +
      `<table cellpadding="6" style="border-collapse:collapse">` +
      rows
        .map(
          ([k, v]) =>
            `<tr><td style="color:#666">${k}</td><td style="text-align:right;font-variant-numeric:tabular-nums"><strong>${v}</strong></td></tr>`
        )
        .join("") +
      `</table>` +
      serverHtml;
    for (const to of recipients.slice(0, 10)) {
      const sent = await sendEmail({ to, subject: `Z-report — ${bizName} — ${businessDate}`, html });
      if ("error" in sent) console.error("z_report email:", sent.error);
    }
  }

  revalidatePath("/app/pos/drawer");
  revalidatePath("/app/pos");
  return { ok: true, ...totals, counted, over_short: overShort, z_business_date: businessDate };
}