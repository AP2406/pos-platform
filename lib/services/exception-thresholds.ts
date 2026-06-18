// Loss-prevention thresholds (Phase 5c). Rate thresholds drive the per-employee
// exception report flags; alertVoidAmount drives the manager push alert. Stored
// on businesses.settings.exception_thresholds (jsonb); rates are fractions.

export type ExceptionThresholds = {
  voidRate: number;
  compRate: number;
  discountRate: number;
  refundRate: number;
  alertVoidAmount: number; // dollars; 0 = no push alert
};

export const DEFAULT_THRESHOLDS: ExceptionThresholds = {
  voidRate: 0.05,
  compRate: 0.05,
  discountRate: 0.1,
  refundRate: 0.1,
  alertVoidAmount: 50,
};

export function parseThresholds(
  settings: Record<string, unknown> | null | undefined
): ExceptionThresholds {
  const raw =
    settings && typeof settings === "object"
      ? (settings as { exception_thresholds?: unknown }).exception_thresholds
      : null;
  if (!raw || typeof raw !== "object") return DEFAULT_THRESHOLDS;
  const t = raw as Partial<ExceptionThresholds>;
  const num = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d;
  return {
    voidRate: num(t.voidRate, DEFAULT_THRESHOLDS.voidRate),
    compRate: num(t.compRate, DEFAULT_THRESHOLDS.compRate),
    discountRate: num(t.discountRate, DEFAULT_THRESHOLDS.discountRate),
    refundRate: num(t.refundRate, DEFAULT_THRESHOLDS.refundRate),
    alertVoidAmount: num(t.alertVoidAmount, DEFAULT_THRESHOLDS.alertVoidAmount),
  };
}
