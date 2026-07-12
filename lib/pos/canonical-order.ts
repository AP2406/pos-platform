// The ONE canonical order payload every tender type carries. Cash, split, manual
// card, tap-to-pay and the physical terminal all build this same shape and pass
// ALL of it to createOrder — so a card/terminal sale can never save a narrower
// order than cash did (which previously dropped comp/service-charge/voids/etc.
// and could reverse a charge after the customer paid).
//
// To add an order-level field: add it here + to CANONICAL_ORDER_KEYS. The unit
// test then fails until every payment path forwards it, preventing silent drift.

export type OrderLineInput = {
  catalog_item_id?: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  // Item-level extras (variation_id, taxable, seat, course_id, note, allergy…)
  // ride along at runtime; createOrder validates what it needs.
  [k: string]: unknown;
};

export type VoidLineInput = {
  name: string;
  unit_price: number;
  quantity: number;
  reason_code?: string;
  reason_note?: string;
};

export type CanonicalOrderInput = {
  items: OrderLineInput[];
  voids?: VoidLineInput[];
  tip?: number;
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
  idempotency_key: string;
  dining_option?: "dine_in" | "takeout" | "delivery" | "pickup" | null;
  open_ticket_id?: string | null;
  signature_data?: string | null;
  // Whole-check note (TouchBistro "Add Note") — stored on the order snapshot and
  // printed on the bill/receipt.
  note?: string | null;
  // Client-supplied approver — DISPLAY ONLY. createOrder re-verifies the approving
  // manager from `approver_pin` server-side (never trusts this bare id/name).
  approver?: { id: string; name: string } | null;
  // Manager PIN authorizing a sensitive action (discount/comp/void/tax-exempt/SC waive)
  // when the cashier lacks the permission/cap. Re-verified server-side in createOrder;
  // must ride through EVERY tender path (cash/card/terminal/split) or an approved sale
  // would be rejected at close.
  approver_pin?: string | null;
};

// Every canonical key, in one place. The test asserts the picker preserves all
// of them, so a new field can't be added to the type but forgotten in forwarding.
export const CANONICAL_ORDER_KEYS: (keyof CanonicalOrderInput)[] = [
  "items",
  "voids",
  "tip",
  "discount_type",
  "discount_value",
  "discount_reason_code",
  "discount_reason_note",
  "comp_value",
  "comp_reason_code",
  "comp_reason_note",
  "service_charge",
  "service_charge_auto",
  "service_charge_waive_reason_code",
  "service_charge_waive_reason_note",
  "tax_exempt",
  "tax_exempt_reason_code",
  "tax_exempt_reason_note",
  "customer_id",
  "idempotency_key",
  "dining_option",
  "open_ticket_id",
  "signature_data",
  "note",
  "approver",
  "approver_pin",
];

// Select exactly the canonical fields to forward into createOrder. Explicit (not
// a spread) so the set is auditable and the test can prove nothing is dropped.
export function forwardOrderFields(input: CanonicalOrderInput): CanonicalOrderInput {
  return {
    items: input.items,
    voids: input.voids,
    tip: input.tip,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    discount_reason_code: input.discount_reason_code,
    discount_reason_note: input.discount_reason_note,
    comp_value: input.comp_value,
    comp_reason_code: input.comp_reason_code,
    comp_reason_note: input.comp_reason_note,
    service_charge: input.service_charge,
    service_charge_auto: input.service_charge_auto,
    service_charge_waive_reason_code: input.service_charge_waive_reason_code,
    service_charge_waive_reason_note: input.service_charge_waive_reason_note,
    tax_exempt: input.tax_exempt,
    tax_exempt_reason_code: input.tax_exempt_reason_code,
    tax_exempt_reason_note: input.tax_exempt_reason_note,
    customer_id: input.customer_id,
    idempotency_key: input.idempotency_key,
    dining_option: input.dining_option,
    open_ticket_id: input.open_ticket_id,
    signature_data: input.signature_data,
    note: input.note,
    approver: input.approver,
    approver_pin: input.approver_pin,
  };
}
