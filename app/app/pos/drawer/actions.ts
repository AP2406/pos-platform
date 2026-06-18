"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { getActiveStaff } from "../staff-session";
import { actorCan, approverByPin } from "@/lib/services/permissions-server";
import { businessDateFor, parseCutoff } from "@/lib/services/business-day";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { CASH_MOVEMENT_REASONS, isValidReason } from "../reason-codes";

// No Sale / Pay In / Pay Out. Recorded in cash_movements and folded into the
// closeout expected-cash total. Pay Out needs a reason; cash adjustments by a
// staff/trainee need a manager PIN (mirrors the void/refund gate).
export async function recordCashMovement(input: {
  kind: "pay_in" | "pay_out" | "no_sale";
  amount?: number;
  reason_code?: string;
  reason_note?: string;
  approver_pin?: string;
}): Promise<{ ok: true } | { needs_approval: true } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const kind = input.kind;
  if (kind !== "pay_in" && kind !== "pay_out" && kind !== "no_sale") {
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

export type DayTotals = {
  starting_cash: number;
  gross_sales: number;
  net_sales: number;
  tax: number;
  tips: number;
  discounts: number;
  comps: number;
  void_count: number;
  void_amount: number;
  cash_sales: number;
  card_sales: number;
  other_sales: number;
  refunds: number;
  pay_ins: number;
  pay_outs: number;
  sale_count: number;
  expected_cash: number;
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
    .select("id, total, subtotal, tax, tip, discount, comp, payment_method, status")
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

  let cash = 0, card = 0, other = 0;
  for (const p of payments) {
    if (p.method === "cash") cash += p.amount;
    else if (p.method === "card") card += p.amount;
    else other += p.amount;
  }
  for (const o of live) {
    if (withPay.has(o.id as string)) continue;
    const t = Number(o.total) || 0;
    const m = (o.payment_method as string) || "cash";
    if (m === "cash") cash += t;
    else if (m === "card") card += t;
    else other += t;
  }

  let gross = 0, net = 0, tax = 0, tips = 0, disc = 0, comp = 0;
  for (const o of live) {
    gross += Number(o.total) || 0;
    net += Number(o.subtotal) || 0;
    tax += Number(o.tax) || 0;
    tips += Number(o.tip) || 0;
    disc += Number(o.discount) || 0;
    comp += Number(o.comp) || 0;
  }
  let voidAmt = 0;
  for (const o of voided) voidAmt += Number(o.total) || 0;

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
  let payIns = 0, payOuts = 0;
  for (const m of moveData ?? []) {
    const a = Number(m.amount) || 0;
    if (m.kind === "pay_in") payIns += a;
    else if (m.kind === "pay_out") payOuts += a;
  }

  const expected = r2(startingCash + r2(cash) - r2(refunds) + r2(payIns) - r2(payOuts));
  return {
    starting_cash: r2(startingCash),
    gross_sales: r2(gross),
    net_sales: r2(net),
    tax: r2(tax),
    tips: r2(tips),
    discounts: r2(disc),
    comps: r2(comp),
    void_count: voided.length,
    void_amount: r2(voidAmt),
    cash_sales: r2(cash),
    card_sales: r2(card),
    other_sales: r2(other),
    refunds: r2(refunds),
    pay_ins: r2(payIns),
    pay_outs: r2(payOuts),
    sale_count: live.length,
    expected_cash: expected,
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
  | { needs_open_check_confirm: true; open_checks: { id: string; label: string | null }[] }
  | { error: string };

export async function closeDrawerSession(input: {
  counted_cash: number;
  note?: string;
  blind?: boolean;
  confirm_open_checks?: boolean;
}): Promise<CloseResult> {
  const { business } = await requireBusiness();
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

  // Open-check guard: don't let the day close over unpaid checks unless the
  // manager has seen the list and confirmed.
  if (!input.confirm_open_checks) {
    const { data: openChecks } = await supabase
      .from("open_tickets")
      .select("id, label")
      .eq("business_id", business.id)
      .order("opened_at", { ascending: true });
    if (openChecks && openChecks.length > 0) {
      return {
        needs_open_check_confirm: true,
        open_checks: openChecks.map((c) => ({
          id: c.id as string,
          label: (c.label as string | null) ?? null,
        })),
      };
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
      ["Tax", fmt(totals.tax)],
      ["Tips", fmt(totals.tips)],
      ["Discounts", fmt(totals.discounts)],
      ["Comps", fmt(totals.comps)],
      ["Voids", `${totals.void_count} · ${fmt(totals.void_amount)}`],
      ["Cash / Card / Other", `${fmt(totals.cash_sales)} / ${fmt(totals.card_sales)} / ${fmt(totals.other_sales)}`],
      ["Refunds", fmt(totals.refunds)],
      ["Pay in / out", `${fmt(totals.pay_ins)} / ${fmt(totals.pay_outs)}`],
      ["Expected cash", fmt(totals.expected_cash)],
      ["Counted cash", fmt(counted)],
      ["Over / short", (overShort > 0 ? "+" : "") + fmt(overShort)],
    ];
    const html =
      `<h2>Z-report — ${bizName}</h2><p>Business day ${businessDate} · ${totals.sale_count} sale(s)</p>` +
      `<table cellpadding="6" style="border-collapse:collapse">` +
      rows
        .map(
          ([k, v]) =>
            `<tr><td style="color:#666">${k}</td><td style="text-align:right;font-variant-numeric:tabular-nums"><strong>${v}</strong></td></tr>`
        )
        .join("") +
      `</table>`;
    for (const to of recipients.slice(0, 10)) {
      const sent = await sendEmail({ to, subject: `Z-report — ${bizName} — ${businessDate}`, html });
      if ("error" in sent) console.error("z_report email:", sent.error);
    }
  }

  revalidatePath("/app/pos/drawer");
  revalidatePath("/app/pos");
  return { ok: true, ...totals, counted, over_short: overShort, z_business_date: businessDate };
}