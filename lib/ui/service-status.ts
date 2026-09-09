// One vocabulary for service state, shared with the iPad app.
//
// The web and the iPad had drifted: the same moment in service was "Done ·
// ready" on the web KDS and "Ready" on the iPad, "Payment due" in one place and
// "Check dropped" in another. Since both surfaces now read STAGE_LABEL /
// AGING_LABEL out of @surge/design-tokens, renaming a stage is a one-line
// change that lands in both at once.
//
// Colour still comes from the web's own OKLCH theme tokens (the iPad palette is
// hex for React Native), but the *thresholds* and *names* are shared, so
// "Running long" and "Late" mean the same thing in both products.

import {
  STAGE_LABEL,
  STAGE_LABEL_SHORT,
  AGING_LABEL,
  type ServiceStage,
  type AgingTier,
} from "@surge/design-tokens";

export { STAGE_LABEL, STAGE_LABEL_SHORT, AGING_LABEL };
export type { ServiceStage, AgingTier };

/** Tailwind classes for a stage chip, matched to the iPad's stage colours. */
export const STAGE_CHIP: Record<ServiceStage, string> = {
  available: "text-muted-foreground border-border bg-muted/40",
  open: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  sent: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  ready: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  pay: "text-amber-400 border-amber-500/30 bg-amber-500/10",
};

/** Tailwind classes for the "Running long" / "Late" chip. */
export const AGING_CHIP: Record<Exclude<AgingTier, "normal">, string> = {
  warning: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  late: "text-red-400 border-red-500/30 bg-red-500/10",
};

export function stageLabel(stage: ServiceStage, short = false): string {
  return short ? STAGE_LABEL_SHORT[stage] : STAGE_LABEL[stage];
}
