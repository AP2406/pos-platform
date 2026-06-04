export type ReasonCode = { code: string; label: string };

export const VOID_REASONS: ReasonCode[] = [
  { code: "customer_cancelled", label: "Customer changed mind" },
  { code: "entered_in_error", label: "Entered in error" },
  { code: "duplicate", label: "Duplicate sale" },
  { code: "item_unavailable", label: "Item unavailable" },
  { code: "test", label: "Test transaction" },
  { code: "other", label: "Other" },
];

export const DISCOUNT_REASONS: ReasonCode[] = [
  { code: "promotion", label: "Promotion / sale" },
  { code: "loyalty", label: "Loyalty / regular customer" },
  { code: "price_match", label: "Price match" },
  { code: "damaged", label: "Damaged item" },
  { code: "employee", label: "Employee discount" },
  { code: "manager_comp", label: "Manager comp" },
  { code: "other", label: "Other" },
];

export const REFUND_REASONS: ReasonCode[] = [
  { code: "customer_request", label: "Customer request" },
  { code: "defective", label: "Defective" },
  { code: "wrong_item", label: "Wrong item" },
  { code: "overcharge", label: "Overcharge" },
  { code: "duplicate", label: "Duplicate charge" },
  { code: "other", label: "Other" },
];

export function isValidReason(list: ReasonCode[], code: string): boolean {
  return list.some((r) => r.code === code);
}

export function reasonLabel(list: ReasonCode[], code: string): string {
  const found = list.find((r) => r.code === code);
  return found ? found.label : code;
}

export function reasonLabelForAction(action: string, code: string): string {
  if (action === "void") return reasonLabel(VOID_REASONS, code);
  if (action === "discount") return reasonLabel(DISCOUNT_REASONS, code);
  if (action === "refund") return reasonLabel(REFUND_REASONS, code);
  return code;
}

