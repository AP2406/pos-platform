"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { staffPermissionsById } from "@/lib/services/permissions-server";
import { type PermissionKey } from "@/lib/services/permissions";
import { verifyInSaleApprovals } from "@/lib/services/approval-gate";
import { parseThresholds } from "@/lib/services/exception-thresholds";
import { isOrderPeriodLocked } from "@/lib/services/period-lock";
import { computeCartTax } from "@/lib/services/tax-compute";
import { loadItemTaxMeta } from "@/lib/services/tax-meta";
import { notifyBusiness } from "@/lib/push";
import { emailOwnerAlert } from "@/lib/services/owner-alerts";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { VOID_REASONS, DISCOUNT_REASONS, TAX_EXEMPT_REASONS, COMP_REASONS, SERVICE_CHARGE_WAIVE_REASONS, isValidReason } from "./reason-codes";

// A chosen modifier recorded on a line. `price` is the option's MENU LIST price (already
// inside unit_price — a breakdown, not a second charge). Like unit_price it is
// client-reported and bounded but not reconciled here, so reporting must treat it as a
// list price (attach-rate/mix), not as reconciled revenue — line-level adjustments
// (happy-hour percent, comp, discount, void) are accounted for at the line/order level.
const lineModifierSchema = z.object({
  modifier_id: z.string().uuid().optional().nullable(),
  group_id: z.string().uuid().optional().nullable(),
  group_name: z.string().max(60).optional().nullable(),
  name: z.string().min(1).max(120),
  price: z.coerce.number().min(0).max(1000000),
  position: z.enum(["whole", "left", "right"]).optional(),
});

const lineSchema = z.object({
  catalog_item_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(120),
  unit_price: z.coerce.number().min(0).max(1000000),
  quantity: z.coerce.number().int().min(1).max(1000),
  note: z.string().max(280).optional().nullable(),
  allergy: z.string().max(120).optional().nullable(),
  seat: z.coerce.number().int().min(1).max(99).optional().nullable(),
  modifiers: z.array(lineModifierSchema).max(40).optional().nullable(),
});

const DINING_OPTIONS = ["dine_in", "takeout", "delivery", "pickup"] as const;

const paymentLineSchema = z.object({
  method: z.enum(["cash", "card", "other", "gift_card", "store_credit", "house_account"]),
  amount: z.coerce.number().min(0).max(1000000),
  tendered: z.coerce.number().min(0).max(1000000).optional().nullable(),
  // P2-32b: which gift card backs a "gift_card" tender line.
  gift_card_code: z.string().max(24).optional().nullable(),
});

const voidLineSchema = z.object({
  name: z.string().min(1).max(120),
  unit_price: z.coerce.number().min(0).max(1000000),
  quantity: z.coerce.number().int().min(1).max(1000),
  reason_code: z.string().max(60).optional(),
  reason_note: z.string().max(500).optional(),
});

const orderSchema = z.object({
  items: z.array(lineSchema).min(1, "Add at least one item."),
  voids: z.array(voidLineSchema).optional(),
  tip: z.coerce.number().min(0).max(1000000).optional(),
  payment_method: z.enum(["cash", "card", "other", "gift_card", "store_credit", "house_account"]).optional(),
  payments: z.array(paymentLineSchema).optional(),
  discount_type: z.enum(["amount", "percent"]).optional(),
  discount_value: z.coerce.number().min(0).max(1000000).optional(),
  discount_reason_code: z.string().max(60).optional(),
  discount_reason_note: z.string().max(500).optional(),
  comp_value: z.coerce.number().min(0).max(1000000).optional(),
  comp_reason_code: z.string().max(60).optional(),
  comp_reason_note: z.string().max(500).optional(),
  service_charge: z.coerce.boolean().optional(),
  service_charge_auto: z.coerce.boolean().optional(),
  service_charge_waive_reason_code: z.string().max(60).optional(),
  service_charge_waive_reason_note: z.string().max(500).optional(),
  tax_exempt: z.coerce.boolean().optional(),
  tax_exempt_reason_code: z.string().max(60).optional(),
  tax_exempt_reason_note: z.string().max(500).optional(),
  customer_id: z.string().uuid().optional().nullable(),
  idempotency_key: z.string().uuid().optional(),
  dining_option: z.enum(DINING_OPTIONS).optional().nullable(),
  open_ticket_id: z.string().uuid().optional().nullable(),
  // Whole-check note (prints on the bill/receipt; stored on the snapshot).
  note: z.string().max(280).optional().nullable(),
  // E2: guest's on-screen signature (data URL) captured on the CFD.
  signature_data: z.string().max(200000).optional().nullable(),
  // The manager who authorized a sensitive action (comp/discount/void) at the
  // register via PIN, when the cashier's own role lacked the permission/cap.
  // DISPLAY ONLY — never trusted: the audit approver is the one re-verified from
  // approver_pin below. Kept so nothing regresses during the client rollout.
  approver: z.object({ id: z.string().max(64), name: z.string().max(120) }).optional().nullable(),
  // The manager PIN that authorized the sensitive action(s) on this sale. RE-VERIFIED
  // server-side (a client can't forge an approver by sending a fabricated `approver`).
  approver_pin: z.string().regex(/^[0-9]{4,6}$/).optional().nullable(),
});

type PaymentInput = {
  method: "cash" | "card" | "other" | "gift_card" | "store_credit" | "house_account";
  amount: number;
  tendered?: number | null;
  gift_card_code?: string | null;
};

type OrderInput = {
  items: {
    catalog_item_id?: string | null;
    name: string;
    unit_price: number;
    quantity: number;
  }[];
  voids?: { name: string; unit_price: number; quantity: number; reason_code?: string; reason_note?: string }[];
  tip?: number;
  payment_method?: "cash" | "card" | "other" | "gift_card" | "store_credit" | "house_account";
  payments?: PaymentInput[];
  discount_type?: "amount" | "percent";
  discount_value?: number;
  discount_reason_code?: string;
  discount_reason_note?: string;
  comp_value?: number;
  comp_reason_code?: string;
  comp_reason_note?: string;
  service_charge?: boolean;
  service_charge_auto?: boolean;
  service_charge_waive_reason_code?: string;
  service_charge_waive_reason_note?: string;
  tax_exempt?: boolean;
  tax_exempt_reason_code?: string;
  tax_exempt_reason_note?: string;
  customer_id?: string | null;
  idempotency_key?: string;
  dining_option?: "dine_in" | "takeout" | "delivery" | "pickup" | null;
  note?: string | null;
  open_ticket_id?: string | null;
  approver?: { id: string; name: string } | null;
};

type Tender = {
  method: "cash" | "card" | "other" | "gift_card" | "store_credit" | "house_account";
  amount: number;
  tendered: number | null;
  change: number | null;
  gift_card_code?: string | null;
};

type CreateOrderResult =
  | { ok: true; id: string; sale_number: number }
  | { error: string };

async function getActiveStaffRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<{ id: string; name: string; role: string } | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get("surge_active_staff")?.value || null;
  if (!sid) return null;
  const { data } = await supabase
    .from("staff_members")
    .select("id, name, role, is_active")
    .eq("id", sid)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data || data.is_active === false) return null;
  return { id: data.id as string, name: data.name as string, role: data.role as string };
}

async function getManagerByPin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  pin: string | undefined
): Promise<{ id: string; name: string } | null> {
  if (!pin || !/^[0-9]{4,6}$/.test(pin)) return null;
  const { data } = await supabase.rpc("verify_staff_member_pin", {
    p_business_id: businessId,
    p_pin: pin,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.role !== "manager") return null;
  return { id: row.id as string, name: row.name as string };
}

// Permission-aware approver: verifies the PIN and that the resolved staff member
// actually holds the required permission (managers do by default, plus any
// custom role granted it — e.g. a Shift-lead with `void`).
async function getApproverByPin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  pin: string | undefined,
  permission: PermissionKey
): Promise<{ id: string; name: string } | null> {
  if (!pin || !/^[0-9]{4,6}$/.test(pin)) return null;
  const { data } = await supabase.rpc("verify_staff_member_pin", {
    p_business_id: businessId,
    p_pin: pin,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const perms = await staffPermissionsById(supabase, businessId, row.id as string);
  if (!perms || !perms.can(permission)) return null;
  return { id: row.id as string, name: row.name as string };
}

export async function createOrder(input: OrderInput): Promise<CreateOrderResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order." };
  }

  const { business, role } = await requireBusiness();
  const isTraining = (business as { training_mode?: boolean }).training_mode === true;
  const supabase = await createClient();

  const idemKey = parsed.data.idempotency_key ?? null;
  if (idemKey) {
    const { data: existing } = await supabase
      .from("orders")
      .select("id, sale_number")
      .eq("business_id", business.id)
      .eq("idempotency_key", idemKey)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        id: existing.id as string,
        sale_number: Number(existing.sale_number),
      };
    }
  }

  let customerId: string | null = parsed.data.customer_id ?? null;
  let customerName: string | null = null;
  let customerExempt = false;
  let customerExemptNumber: string | null = null;
  if (customerId) {
    const { data: cust } = await supabase
      .from("customers")
      .select("id, name, tax_exempt, tax_exempt_number")
      .eq("id", customerId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (cust) {
      customerName = (cust.name as string | null) ?? null;
      customerExempt = (cust.tax_exempt as boolean | null) === true;
      customerExemptNumber = (cust.tax_exempt_number as string | null) ?? null;
    } else {
      customerId = null;
    }
  }

  const { data: openSession } = await supabase
    .from("drawer_sessions")
    .select("id")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  const drawerSessionId = openSession ? (openSession.id as string) : null;

  let activeStaffId: string | null = null;
  let activeStaffName: string | null = null;
  let activeStaffRole: string | null = null;
  {
    const cookieStore = await cookies();
    const sid = cookieStore.get("surge_active_staff")?.value || null;
    if (sid) {
      const { data: st } = await supabase
        .from("staff_members")
        .select("id, name, role, is_active")
        .eq("id", sid)
        .eq("business_id", business.id)
        .maybeSingle();
      if (st && st.is_active !== false) {
        activeStaffId = st.id as string;
        activeStaffName = st.name as string;
        activeStaffRole = st.role as string;
      }
    }
  }

  // Attribution guard: a staffed business must close every sale under a
  // signed-in cashier (kills the "Unassigned" sale). Businesses with NO active
  // staff configured (transportation, solo quick-service/retail) are exempt, so
  // existing verticals are unaffected.
  if (!activeStaffId) {
    const { count: activeStaffCount } = await supabase
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("is_active", true);
    if ((activeStaffCount ?? 0) > 0) {
      return { error: "A cashier must be signed in to close this sale." };
    }
  }

  const subtotal = parsed.data.items.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0
  );

  // Voided items (not made): recorded for accountability but never charged or
  // inventoried. They don't touch the totals — only void_total + the snapshot.
  const voidLines = parsed.data.voids ?? [];
  const voidTotal = Math.round(voidLines.reduce((s, v) => s + v.unit_price * v.quantity, 0) * 100) / 100;

  const discountType = parsed.data.discount_type ?? "amount";
  const discountValue = parsed.data.discount_value ?? 0;
  let discount =
    discountType === "percent"
      ? subtotal * (discountValue / 100)
      : discountValue;
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;

  const discountReasonCode = (parsed.data.discount_reason_code || "").trim();
  const discountReasonNote = (parsed.data.discount_reason_note || "").trim();
  if (discount > 0) {
    if (!isValidReason(DISCOUNT_REASONS, discountReasonCode)) {
      return { error: "Choose a reason for the discount." };
    }
    if (discountReasonCode === "other" && !discountReasonNote) {
      return { error: "Add a note explaining the discount." };
    }
  }

  // P2-31b: a "loyalty_redeem" discount spends the customer's points. The final
  // (clamped) discount dollars plus the redeem rate fully determine the points
  // used — no separate field to trust. Validated against the live balance here;
  // decremented after the sale settles.
  let loyaltyRedeemPts = 0;
  if (discount > 0 && discountReasonCode === "loyalty_redeem") {
    if (!customerId) return { error: "Add a customer to redeem loyalty points." };
    const { data: bizL } = await supabase
      .from("businesses")
      .select("loyalty_settings")
      .eq("id", business.id)
      .maybeSingle();
    const ls = (bizL?.loyalty_settings ?? {}) as { enabled?: boolean; redeemPerDollar?: number };
    const redeemPerDollar = Number(ls.redeemPerDollar);
    if (ls.enabled !== true || !Number.isFinite(redeemPerDollar) || redeemPerDollar <= 0) {
      return { error: "Loyalty redemption isn't available." };
    }
    loyaltyRedeemPts = Math.round(discount * redeemPerDollar);
    const { data: acct } = await supabase
      .from("loyalty_accounts")
      .select("points")
      .eq("business_id", business.id)
      .eq("customer_id", customerId)
      .maybeSingle();
    const balance = acct ? (acct.points as number) : 0;
    if (loyaltyRedeemPts > balance) {
      return { error: "Not enough loyalty points for that redemption." };
    }
  }

  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;

  // Comp (on-the-house): a pre-tax reduction applied after any discount,
  // recorded separately from discount. Capped to what's left after the discount.
  let comp = parsed.data.comp_value ?? 0;
  if (comp < 0) comp = 0;
  if (comp > discountedSubtotal) comp = discountedSubtotal;
  comp = Math.round(comp * 100) / 100;
  const compReasonCode = (parsed.data.comp_reason_code || "").trim();
  const compReasonNote = (parsed.data.comp_reason_note || "").trim();
  if (comp > 0) {
    if (!isValidReason(COMP_REASONS, compReasonCode)) {
      return { error: "Choose a reason for the comp." };
    }
    if (compReasonCode === "other" && !compReasonNote) {
      return { error: "Add a note explaining the comp." };
    }
  }
  const netSubtotal = Math.round((discountedSubtotal - comp) * 100) / 100;

  let rate = Number(business.default_tax_rate) || 0;
  if (rate > 1) rate = rate / 100;

  const taxLineIds = Array.from(
    new Set(
      parsed.data.items
        .map((i) => i.catalog_item_id)
        .filter((id): id is string => !!id)
    )
  );
  const { itemTaxMeta, rateFracById, rateNameById } = await loadItemTaxMeta(supabase, business.id, taxLineIds);

  const taxF = subtotal > 0 ? netSubtotal / subtotal : 0;

  // Tax over the cart at each item's applicable rate. Extracted to a shared pure
  // helper (lib/services/tax-compute) so the QR pay-at-table guest path computes an
  // identical, server-authoritative total. taxF prorates for any discount/comp.
  const _taxRes = computeCartTax(
    parsed.data.items,
    { defaultRateFrac: rate, itemTaxMeta, rateFracById, rateNameById },
    taxF
  );
  let tax = _taxRes.tax;
  let taxableBase = _taxRes.taxableBase;
  const taxBreakdown = _taxRes.taxBreakdown;

  const manualExempt = parsed.data.tax_exempt === true;
  const exemptCode = (parsed.data.tax_exempt_reason_code || "").trim();
  const exemptNote = (parsed.data.tax_exempt_reason_note || "").trim();
  if (manualExempt) {
    if (!isValidReason(TAX_EXEMPT_REASONS, exemptCode)) {
      return { error: "Choose a reason for the tax exemption." };
    }
    if (exemptCode === "other" && !exemptNote) {
      return { error: "Add a note explaining the tax exemption." };
    }
  }
  const isExempt = manualExempt || customerExempt;
  let taxExemptInfo:
    | { source: "manual" | "customer"; reason_code: string | null; reason_note: string | null; number: string | null }
    | null = null;
  if (isExempt) {
    if (manualExempt) {
      taxExemptInfo = { source: "manual", reason_code: exemptCode, reason_note: exemptNote || null, number: null };
    } else {
      taxExemptInfo = { source: "customer", reason_code: "customer", reason_note: null, number: customerExemptNumber };
    }
    for (const b of taxBreakdown) b.amount = 0;
    tax = 0;
  }

  // Service charge / auto-gratuity — the amount is recomputed here from the
  // business policy (the client only says whether it's applied). It is NOT
  // taxed; its base is the pre-tax net (default) or the post-tax amount.
  const scEnabled = (business as { service_charge_enabled?: boolean }).service_charge_enabled === true;
  let scPct = Number((business as { service_charge_pct?: number }).service_charge_pct) || 0;
  if (scPct < 0) scPct = 0;
  if (scPct > 100) scPct = 100;
  const scPostTax = (business as { service_charge_post_tax?: boolean }).service_charge_post_tax === true;
  const scLabel = ((business as { service_charge_label?: string }).service_charge_label || "Service charge").toString();
  const scApplied = scEnabled && scPct > 0 && parsed.data.service_charge === true;
  const scBase = scApplied ? (scPostTax ? Math.round((netSubtotal + tax) * 100) / 100 : netSubtotal) : 0;
  const scAmount = scApplied ? Math.round(scBase * (scPct / 100) * 100) / 100 : 0;

  // P0-10c: a mandatory large-party charge is an AUTO-GRATUITY — in Canada that
  // is a service charge that IS taxable (HST applies), and it's recorded apart
  // from a manual service charge and from a voluntary (non-taxable) tip. The
  // client flags which one was applied.
  const scIsAuto = scApplied && parsed.data.service_charge_auto === true;
  const autoGratuity = scIsAuto ? scAmount : 0;
  const serviceCharge = scIsAuto ? 0 : scAmount;
  const autoGratTax = scIsAuto && !isExempt ? Math.round(autoGratuity * rate * 100) / 100 : 0;
  if (autoGratTax > 0) {
    tax = Math.round((tax + autoGratTax) * 100) / 100;
    taxableBase = Math.round((taxableBase + autoGratuity) * 100) / 100;
  }

  // Waiving an enabled service charge is the sensitive, reason-coded action.
  const scWaiveCode = (parsed.data.service_charge_waive_reason_code || "").trim();
  const scWaiveNote = (parsed.data.service_charge_waive_reason_note || "").trim();
  const scWaived = scEnabled && scPct > 0 && !scApplied && scWaiveCode !== "";
  if (scWaived) {
    if (!isValidReason(SERVICE_CHARGE_WAIVE_REASONS, scWaiveCode)) {
      return { error: "Choose a reason for waiving the service charge." };
    }
    if (scWaiveCode === "other" && !scWaiveNote) {
      return { error: "Add a note explaining the waived service charge." };
    }
  }

  const tip = parsed.data.tip ?? 0;
  const total = Math.round((netSubtotal + tax + serviceCharge + autoGratuity + tip) * 100) / 100;
  const paymentMethod = parsed.data.payment_method ?? "cash";

  let tenders: Tender[] = [];
  const providedPayments = parsed.data.payments ?? [];
  if (providedPayments.length > 0) {
    const cleaned = providedPayments
      .map((p) => ({
        method: p.method,
        amount: Math.round((Number(p.amount) || 0) * 100) / 100,
        tendered:
          p.tendered === null || p.tendered === undefined
            ? null
            : Math.round((Number(p.tendered) || 0) * 100) / 100,
        gift_card_code: p.gift_card_code ?? null,
      }))
      .filter((p) => p.amount > 0);

    if (cleaned.length === 0) {
      return { error: "Enter at least one payment amount." };
    }

    const sumCents = cleaned.reduce((s, p) => s + Math.round(p.amount * 100), 0);
    if (sumCents !== Math.round(total * 100)) {
      return {
        error: "Payments must add up to the sale total of " + total.toFixed(2) + ".",
      };
    }

    tenders = cleaned.map((p) => ({
      method: p.method,
      amount: p.amount,
      tendered: p.method === "cash" ? p.tendered : null,
      change:
        p.method === "cash" && p.tendered !== null
          ? Math.round((p.tendered - p.amount) * 100) / 100
          : null,
      gift_card_code: p.method === "gift_card" ? p.gift_card_code ?? null : null,
    }));
  } else {
    tenders = [{ method: paymentMethod, amount: total, tendered: null, change: null }];
  }

  // P2-32b: validate gift-card tenders against live balances before settling.
  // The actual decrement happens atomically after the sale records (post-settle).
  const giftRedemptions: { cardId: string; amountCents: number }[] = [];
  for (const t of tenders) {
    if (t.method !== "gift_card") continue;
    const code = (t.gift_card_code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!code) return { error: "Enter the gift card code." };
    const { data: card } = await supabase
      .from("gift_cards")
      .select("id, balance_cents, is_active")
      .eq("business_id", business.id)
      .eq("code", code)
      .maybeSingle();
    if (!card || card.is_active !== true) return { error: "Gift card not found." };
    const amountCents = Math.round(t.amount * 100);
    if ((card.balance_cents as number) < amountCents) {
      return { error: "Gift card balance is too low for that amount." };
    }
    giftRedemptions.push({ cardId: card.id as string, amountCents });
  }

  // P2-33: store-credit tenders draw down the attached customer's balance. The
  // decrement happens atomically post-settle; validate the total here.
  let storeCreditCents = 0;
  for (const t of tenders) {
    if (t.method !== "store_credit") continue;
    storeCreditCents += Math.round(t.amount * 100);
  }
  if (storeCreditCents > 0) {
    if (!customerId) return { error: "Add a customer to pay with store credit." };
    const { data: acct } = await supabase
      .from("store_credit_accounts")
      .select("balance_cents")
      .eq("business_id", business.id)
      .eq("customer_id", customerId)
      .maybeSingle();
    const balance = acct ? (acct.balance_cents as number) : 0;
    if (balance < storeCreditCents) {
      return { error: "Store credit balance is too low for that amount." };
    }
  }

  // House account (AR): charging to account books the sale as revenue now and adds
  // to the customer's outstanding balance. Validate enablement + credit limit here;
  // the atomic charge (with the same limit check) runs post-settle.
  let houseAccountCents = 0;
  for (const t of tenders) {
    if (t.method !== "house_account") continue;
    houseAccountCents += Math.round(t.amount * 100);
  }
  if (houseAccountCents > 0) {
    if (!customerId) return { error: "Add a customer to charge to a house account." };
    const { data: ha } = await supabase
      .from("house_accounts")
      .select("enabled, limit_cents, balance_cents")
      .eq("business_id", business.id)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (!ha || ha.enabled !== true) {
      return { error: "This customer doesn't have an active house account." };
    }
    const limit = ha.limit_cents as number | null;
    const balance = (ha.balance_cents as number) || 0;
    if (limit != null && balance + houseAccountCents > limit) {
      return { error: "That charge is over the customer's house-account credit limit." };
    }
  }

  const distinctMethods = Array.from(new Set(tenders.map((t) => t.method)));
  const orderPaymentMethod =
    distinctMethods.length > 1 ? "split" : distinctMethods[0];

  const snapshot = {
    dining_option: parsed.data.dining_option ?? null,
    note: parsed.data.note ?? null,
    items: parsed.data.items.map((i) => ({
      name: i.name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      note: i.note ?? null,
      allergy: i.allergy ?? null,
      seat: i.seat ?? null,
      // Structured modifier breakdown (list prices, already inside unit_price). Persisted
      // source for modifier attach-rate/mix reporting and structured chit rendering — see
      // lineModifierSchema on why `price` is a list price, not reconciled revenue.
      modifiers: i.modifiers && i.modifiers.length > 0 ? i.modifiers : null,
    })),
    subtotal: Math.round(subtotal * 100) / 100,
    discount: {
      type: discountType,
      value: discountValue,
      amount: discount,
      reason_code: discount > 0 ? discountReasonCode : null,
      reason_note: discount > 0 && discountReasonNote ? discountReasonNote : null,
    },
    comp: {
      amount: comp,
      reason_code: comp > 0 ? compReasonCode : null,
      reason_note: comp > 0 && compReasonNote ? compReasonNote : null,
    },
    voids: {
      total: voidTotal,
      lines: voidLines.map((v) => ({ name: v.name, unit_price: v.unit_price, quantity: v.quantity, reason_code: (v.reason_code || "").trim() || null, reason_note: (v.reason_note || "").trim() || null })),
    },
    tax: { rate: rate, amount: tax, taxable_base: taxableBase, breakdown: taxBreakdown, exempt: taxExemptInfo },
    service_charge: {
      applied: scApplied && !scIsAuto,
      label: scLabel,
      pct: scPct,
      post_tax: scPostTax,
      base: scBase,
      amount: serviceCharge,
      waived: scWaived,
      waive_reason_code: scWaived ? scWaiveCode : null,
      waive_reason_note: scWaived && scWaiveNote ? scWaiveNote : null,
    },
    auto_gratuity: {
      applied: scIsAuto,
      label: scLabel,
      pct: scPct,
      amount: autoGratuity,
      taxable: true,
      hst: autoGratTax,
    },
    tip: tip,
    total: total,
    payment_method: orderPaymentMethod,
    payments: tenders.map((t) => ({
      method: t.method,
      amount: t.amount,
      tendered: t.tendered,
      change: t.change,
    })),
    customer: customerId ? { id: customerId, name: customerName } : null,
    staff: activeStaffId ? { id: activeStaffId, name: activeStaffName, role: activeStaffRole } : null,
    is_training: isTraining,
    completed_at: new Date().toISOString(),
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authUserId = user ? user.id : null;

  // ── Server-side approval gate (P0 security) ───────────────────────────────
  // In-sale sensitive actions (discount, comp, line voids, tax exemption, service-
  // charge waive) must be authorized by someone who actually holds the permission.
  // The cashier's authority is computed server-side from their role/caps; anything
  // they can't do requires a manager PIN that is RE-VERIFIED here. The client-supplied
  // `approver` is NEVER trusted (a modified client could forge it) — the recorded
  // approver is the one resolved from approver_pin. Training sales and unstaffed
  // tills (no signed-in cashier) are exempt, matching the register's own gate.
  const gate = await verifyInSaleApprovals({
    supabase,
    businessId: business.id,
    isStaffed: activeStaffId != null,
    isTraining,
    cashierId: activeStaffId,
    cashierRole: activeStaffRole,
    approverPin: parsed.data.approver_pin ?? undefined,
    actions: [
      { present: discount > 0, label: "discount", permKey: "discount", amount: discount },
      { present: comp > 0, label: "comp", permKey: "comp", amount: comp },
      { present: voidLines.length > 0, label: "line void", permKey: "void", amount: null },
      { present: manualExempt, label: "tax exemption", permKey: null, amount: null },
      { present: scWaived, label: "service-charge waive", permKey: null, amount: null },
    ],
  });
  if ("blocked" in gate) {
    return { error: "A manager PIN is required to approve: " + gate.blocked.join(", ") + "." };
  }

  // The approver recorded in the audit trail is the RE-VERIFIED one (never the raw
  // client-supplied `approver`). Null when no sensitive action needed approval.
  const approverMeta = {
    approved_by: gate.approver ? gate.approver.id : null,
    approver_name: gate.approver ? gate.approver.name : null,
  };

  const auditEvents: {
    actor_id: string | null;
    actor_role: string | null;
    action: string;
    reason_code: string | null;
    reason_note: string | null;
    metadata: Record<string, unknown>;
  }[] = [];
  if (discount > 0 && !isTraining) {
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "discount",
      reason_code: discountReasonCode,
      reason_note: discountReasonNote ? discountReasonNote.slice(0, 500) : null,
      metadata: { type: discountType, value: discountValue, amount: discount, staff_id: activeStaffId, staff_name: activeStaffName, ...approverMeta },
    });
  }
  if (comp > 0 && !isTraining) {
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "comp",
      reason_code: compReasonCode,
      reason_note: compReasonNote ? compReasonNote.slice(0, 500) : null,
      metadata: { amount: comp, staff_id: activeStaffId, staff_name: activeStaffName, ...approverMeta },
    });
  }
  for (const v of voidLines) {
    if (isTraining) break;
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "void",
      reason_code: (v.reason_code || "").trim() || null,
      reason_note: (v.reason_note || "").trim() ? (v.reason_note as string).trim().slice(0, 500) : null,
      metadata: { name: v.name, amount: Math.round(v.unit_price * v.quantity * 100) / 100, quantity: v.quantity, staff_id: activeStaffId, staff_name: activeStaffName, ...approverMeta },
    });
  }
  if (scWaived && !isTraining) {
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "service_charge_waived",
      reason_code: scWaiveCode,
      reason_note: scWaiveNote ? scWaiveNote.slice(0, 500) : null,
      metadata: { pct: scPct, staff_id: activeStaffId, staff_name: activeStaffName, ...approverMeta },
    });
  }
  if (manualExempt && !isTraining) {
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "tax_exempt",
      reason_code: exemptCode,
      reason_note: exemptNote ? exemptNote.slice(0, 500) : null,
      metadata: { staff_id: activeStaffId, staff_name: activeStaffName, taxable_base: taxableBase, ...approverMeta },
    });
  }

  const itemsPayload = parsed.data.items.map((i) => ({
    catalog_item_id: i.catalog_item_id ?? null,
    name: i.name,
    unit_price: i.unit_price,
    quantity: i.quantity,
    // Carried for a future relational order_item_modifiers table; the current RPC
    // ignores unknown line keys, so this is inert until then.
    modifiers: i.modifiers && i.modifiers.length > 0 ? i.modifiers : undefined,
  }));

  const paymentsPayload = tenders.map((t) => ({
    method: t.method,
    amount: t.amount,
    tendered: t.tendered,
    change_given: t.change,
    tender_type: t.method,
    finix_transfer_id: null,
    finix_state: null,
  }));

  const payload = {
    business_id: business.id,
    status: "paid",
    subtotal: Math.round(subtotal * 100) / 100,
    tax: tax,
    tip: tip,
    discount: discount,
    comp: comp,
    service_charge: serviceCharge,
    auto_gratuity: autoGratuity,
    void_total: voidTotal,
    total: total,
    payment_method: orderPaymentMethod,
    customer_id: customerId,
    drawer_session_id: drawerSessionId,
    is_training: isTraining,
    staff_id: activeStaffId,
    tax_exempt: isExempt,
    idempotency_key: idemKey,
    snapshot: snapshot,
    items: itemsPayload,
    payments: paymentsPayload,
    audit_events: auditEvents,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc("create_pos_order", {
    payload: payload,
  });

  if (rpcError || !rpcData) {
    const msg = rpcError && rpcError.message ? rpcError.message : "";
    if (msg.indexOf("insufficient_stock:") !== -1) {
      const itemName = (msg.split("insufficient_stock:")[1] || "an item").trim();
      return { error: "Out of stock: " + itemName + "." };
    }
    if (msg.indexOf("tender_short") !== -1) {
      return { error: "Payments don't cover the sale total." };
    }
    if (msg.indexOf("not_authorized") !== -1) {
      return { error: "You don't have access to record this sale." };
    }
    if (msg.indexOf("duplicate key") !== -1 || (rpcError && (rpcError as { code?: string }).code === "23505")) {
      if (idemKey) {
        const { data: dup } = await supabase
          .from("orders")
          .select("id, sale_number")
          .eq("business_id", business.id)
          .eq("idempotency_key", idemKey)
          .maybeSingle();
        if (dup) {
          return { ok: true, id: dup.id as string, sale_number: Number(dup.sale_number) };
        }
      }
    }
    console.error("createOrder rpc:", rpcError);
    return { error: "Could not record the sale. Please try again." };
  }

  const result = rpcData as { order_id: string; sale_number: number | string; replayed?: boolean };

  // P2-31: accrue loyalty points for a named customer. Additive and post-settle —
  // it never touches the order's money or snapshot. Skipped on idempotent replays
  // (so a retried request can't double-earn) and for training sales.
  if (customerId && !isTraining && !result.replayed) {
    if (loyaltyRedeemPts > 0) {
      await redeemLoyaltyPoints(supabase, business.id, customerId, result.order_id, loyaltyRedeemPts);
    }
    await accrueLoyaltyPoints(supabase, business.id, customerId, result.order_id, netSubtotal);
  }

  // Phase A: persist covers (guest_count), seated_at (turn-time) and section from
  // the table ticket onto the order before the ticket is dropped — these are lost
  // otherwise. Non-financial columns, so the paid-order guard allows the update.
  if (parsed.data.open_ticket_id && !result.replayed) {
    const { data: ot } = await supabase
      .from("open_tickets")
      .select("guest_count, opened_at, element_id")
      .eq("id", parsed.data.open_ticket_id)
      .eq("business_id", business.id)
      .maybeSingle();
    if (ot) {
      let sectionId: string | null = null;
      if (ot.element_id) {
        const { data: el } = await supabase
          .from("floor_elements")
          .select("section_id")
          .eq("id", ot.element_id as string)
          .maybeSingle();
        sectionId = (el?.section_id as string | null) ?? null;
      }
      await supabase
        .from("orders")
        .update({ guest_count: ot.guest_count ?? null, seated_at: ot.opened_at ?? null, section_id: sectionId })
        .eq("id", result.order_id)
        .eq("business_id", business.id);
    }
  }

  // GAP-1 (channel): carry the originating channel from the ticket onto the order
  // (NULL = in-store register sale, exactly as today). Self-contained + guarded so
  // it no-ops cleanly until migration 0071 adds the channel columns.
  if (parsed.data.open_ticket_id && !result.replayed && result.order_id) {
    const { data: ch } = await supabase
      .from("open_tickets")
      .select("channel")
      .eq("id", parsed.data.open_ticket_id)
      .eq("business_id", business.id)
      .maybeSingle();
    const channel = (ch as { channel?: string | null } | null)?.channel ?? null;
    if (channel) {
      await supabase
        .from("orders")
        .update({ channel })
        .eq("id", result.order_id)
        .eq("business_id", business.id);
    }
  }

  // E2: store the guest's on-screen signature (non-financial; guard-safe).
  if (parsed.data.signature_data && !result.replayed && result.order_id) {
    await supabase
      .from("orders")
      .update({ signature_data: parsed.data.signature_data })
      .eq("id", result.order_id)
      .eq("business_id", business.id);
  }

  // P2-32b: decrement the gift cards used as tenders. Atomic + overdraft-safe via
  // the RPC; validated above, skipped on idempotent replay. Real money, so a
  // failure is logged (the sale is already recorded) but never fails the sale.
  if (!result.replayed) {
    for (const g of giftRedemptions) {
      const { error: gcErr } = await supabase.rpc("apply_gift_card_delta", {
        p_business_id: business.id,
        p_gift_card_id: g.cardId,
        p_delta_cents: -g.amountCents,
        p_kind: "redeem",
        p_order_id: result.order_id,
      });
      if (gcErr) console.error("gift card redeem:", gcErr);
    }
    // P2-33: draw down store credit (atomic, overdraft-safe, order-linked).
    if (storeCreditCents > 0 && customerId) {
      const { error: scErr } = await supabase.rpc("apply_store_credit_delta", {
        p_business_id: business.id,
        p_customer_id: customerId,
        p_delta_cents: -storeCreditCents,
        p_kind: "redeem",
        p_order_id: result.order_id,
      });
      if (scErr) console.error("store credit redeem:", scErr);
    }
    // House account: add the charge to the customer's balance (atomic, limit-checked,
    // order-linked). The sale is already recorded, so a failure is logged, not fatal.
    if (houseAccountCents > 0 && customerId) {
      const { error: haErr } = await supabase.rpc("apply_house_account_delta", {
        p_business_id: business.id,
        p_customer_id: customerId,
        p_delta_cents: houseAccountCents,
        p_kind: "charge",
        p_order_id: result.order_id,
        p_note: null,
      });
      if (haErr) console.error("house account charge:", haErr);
    }
  }

  revalidatePath("/app/pos");
  // A charge-to-account moves the customer's AR balance — refresh their profile
  // and the accounting AR total.
  if (houseAccountCents > 0 && customerId) {
    revalidatePath("/app/customers/" + customerId);
    revalidatePath("/app/accounting");
  }
  return { ok: true, id: result.order_id, sale_number: Number(result.sale_number) };
}

// Spend points at redemption: append a negative ledger row and decrement the
// balance. Validated against the balance before the sale; best-effort here.
async function redeemLoyaltyPoints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  customerId: string,
  orderId: string,
  points: number
): Promise<void> {
  if (points <= 0) return;
  try {
    await supabase
      .from("loyalty_transactions")
      .insert({ business_id: businessId, customer_id: customerId, order_id: orderId, points: -points, kind: "redeem" });
    const { data: acct } = await supabase
      .from("loyalty_accounts")
      .select("points")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (acct) {
      await supabase
        .from("loyalty_accounts")
        .update({ points: Math.max(0, (acct.points as number) - points), updated_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .eq("customer_id", customerId);
    }
  } catch (e) {
    console.error("redeemLoyaltyPoints:", e);
  }
}

// Earn points = floor(net pre-tax spend × earn-per-dollar). Writes an append-only
// ledger row and bumps the running balance. Best-effort: a failure here must not
// fail the (already-recorded) sale.
async function accrueLoyaltyPoints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  customerId: string,
  orderId: string,
  netSubtotal: number
): Promise<void> {
  try {
    const { data: biz } = await supabase
      .from("businesses")
      .select("loyalty_settings")
      .eq("id", businessId)
      .maybeSingle();
    const ls = (biz?.loyalty_settings ?? {}) as { enabled?: boolean; earnPerDollar?: number };
    if (ls.enabled !== true) return;
    const earnPerDollar = Number(ls.earnPerDollar);
    if (!Number.isFinite(earnPerDollar) || earnPerDollar <= 0) return;

    const points = Math.floor((Number(netSubtotal) || 0) * earnPerDollar);
    if (points <= 0) return;

    await supabase
      .from("loyalty_transactions")
      .insert({ business_id: businessId, customer_id: customerId, order_id: orderId, points, kind: "earn" });

    const { data: acct } = await supabase
      .from("loyalty_accounts")
      .select("points")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (acct) {
      await supabase
        .from("loyalty_accounts")
        .update({ points: (acct.points as number) + points, updated_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .eq("customer_id", customerId);
    } else {
      await supabase
        .from("loyalty_accounts")
        .insert({ business_id: businessId, customer_id: customerId, points });
    }
  } catch (e) {
    console.error("accrueLoyaltyPoints:", e);
  }
}

export async function voidOrder(
  orderId: string,
  reasonCode: string,
  reasonNote?: string,
  approverPin?: string
): Promise<{ ok: true } | { needs_approval: true } | { error: string }> {
  if (!orderId) return { error: "Missing order." };

  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can void a sale." };
  }

  const code = (reasonCode || "").trim();
  if (!isValidReason(VOID_REASONS, code)) {
    return { error: "Choose a reason for voiding this sale." };
  }
  const note = (reasonNote || "").trim();
  if (code === "other" && !note) {
    return { error: "Add a note explaining the reason." };
  }

  const supabase = await createClient();

  const active = await getActiveStaffRow(supabase, business.id);
  let approver: { id: string; name: string } | null = null;
  // The acting cashier needs the `void` permission; otherwise a staff member who
  // holds it must approve by PIN. With the default role matrix this is identical
  // to the old "staff/trainee need a manager" behavior.
  if (active) {
    const actorPerms = await staffPermissionsById(supabase, business.id, active.id);
    const actorCanVoid = actorPerms?.can("void") ?? false;
    if (!actorCanVoid) {
      if (!approverPin) return { needs_approval: true };
      approver = await getApproverByPin(supabase, business.id, approverPin, "void");
      if (!approver) return { error: "That PIN can't approve a void." };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The voided amount — recorded in the audit event (so the exception report can
  // total it) and compared against the manager-alert threshold.
  const { data: ord } = await supabase
    .from("orders")
    .select("total, sale_number, created_at")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  const voidTotal = ord ? Number(ord.total) || 0 : 0;

  // Period lock: can't void a sale in a closed fiscal period.
  if (ord) {
    const tz = (business as { timezone?: string }).timezone || "America/Toronto";
    if (await isOrderPeriodLocked(supabase, business.id, ord.created_at as string, tz)) {
      return { error: "That period is locked — this sale can't be voided." };
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "voided" })
    .eq("id", orderId)
    .eq("business_id", business.id);

  if (error) {
    console.error("voidOrder:", error);
    return { error: "Could not void the sale. Please try again." };
  }

  const { error: auditError } = await supabase.from("audit_events").insert({
    business_id: business.id,
    actor_id: user ? user.id : null,
    actor_role: role,
    action: "void",
    order_id: orderId,
    reason_code: code,
    reason_note: note ? note.slice(0, 500) : null,
    metadata: {
      amount: voidTotal,
      staff_id: active ? active.id : null,
      staff_name: active ? active.name : null,
      approved_by: approver ? approver.id : null,
      approver_name: approver ? approver.name : null,
    },
  });
  if (auditError) {
    console.error("voidOrder audit:", auditError);
  }

  // Push a manager alert when the void exceeds the configured amount (best-effort).
  const th = parseThresholds((business as { settings?: Record<string, unknown> }).settings);
  if (th.alertVoidAmount > 0 && voidTotal >= th.alertVoidAmount) {
    const who = active ? active.name : "a cashier";
    const label = "$" + voidTotal.toFixed(2) + " voided by " + who + (ord?.sale_number ? " (#" + ord.sale_number + ")" : "");
    await notifyBusiness(business.id, "exception", { title: "Large void", body: label, url: "/app/exceptions" });
    // Also email the owner/manager recipients (toggleable, best-effort).
    await emailOwnerAlert(business as { settings?: unknown; name?: string }, {
      key: "large_txn_email",
      subject: "Large void — " + ((business as { name?: string }).name || "your business"),
      html: "<p><strong>" + label + "</strong></p><p>Threshold: $" + th.alertVoidAmount.toFixed(2) + ". Review in Exceptions.</p>",
    });
  }

  revalidatePath("/app/pos/sales");
  return { ok: true };
}

export async function searchCustomers(
  query: string
): Promise<{ id: string; name: string; phone: string | null; tax_exempt: boolean }[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  let q = supabase
    .from("customers")
    .select("id, name, phone, tax_exempt")
    .eq("business_id", business.id)
    .order("name", { ascending: true })
    .limit(10);

  const term = (query || "").trim().replace(/[(),]/g, " ").trim();
  if (term) {
    const like = "%" + term + "%";
    q = q.or("name.ilike." + like + ",phone.ilike." + like);
  }

  const { data, error } = await q;
  if (error) {
    console.error("searchCustomers:", error);
    return [];
  }
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    phone: (c.phone as string | null) ?? null,
    tax_exempt: (c.tax_exempt as boolean | null) === true,
  }));
}

export async function quickCreateCustomer(
  name: string,
  phone?: string,
  opts?: { force?: boolean }
): Promise<{ ok: true; id: string; name: string } | { exists: true; id: string; name: string } | { error: string }> {
  const clean = (name || "").trim();
  if (!clean) return { error: "Customer name is required." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  // Dedupe guard: only when a phone is actually provided. On a match, hand back
  // the existing customer so the register can attach them instead of duplicating.
  const cleanPhone = phone && phone.trim() ? phone.trim() : "";
  if (!opts?.force && cleanPhone) {
    const { data: hit } = await supabase
      .from("customers")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("phone", cleanPhone)
      .limit(1)
      .maybeSingle();
    if (hit) return { exists: true, id: hit.id as string, name: hit.name as string };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: business.id,
      name: clean.slice(0, 120),
      phone: phone && phone.trim() ? phone.trim().slice(0, 40) : null,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    console.error("quickCreateCustomer:", error);
    return { error: "Could not add customer. Please try again." };
  }

  revalidatePath("/app/customers");
  return { ok: true, id: data.id as string, name: data.name as string };
}