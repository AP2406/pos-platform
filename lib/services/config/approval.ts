// CUST-1 approval matrix resolution. Plain server module (takes no SupabaseClient;
// uses getConfig + requireBusiness). Defaults reproduce today's behavior, and a
// missing config store falls back to those defaults — so the money path is safe
// even before migrations 0069/0070 are applied.
import { requireBusiness } from "@/lib/services/tenancy";
import { getConfig, configContext, type ConfigCtx } from "./resolver";
import { APPROVAL_DEFAULTS, approvalKey, type ApprovalAction, type ApprovalMode, type ApprovalRule } from "./registry";

function normalizeRule(raw: unknown, action: ApprovalAction): ApprovalRule {
  const d = APPROVAL_DEFAULTS[action];
  if (!raw || typeof raw !== "object") return d;
  const o = raw as { mode?: unknown; threshold?: unknown };
  const mode = (["none", "pin", "async", "either"] as ApprovalMode[]).includes(o.mode as ApprovalMode) ? (o.mode as ApprovalMode) : d.mode;
  const threshold = Number.isFinite(Number(o.threshold)) ? Number(o.threshold) : d.threshold;
  return { mode, threshold };
}

export async function resolveApprovalRule(action: ApprovalAction, ctx: ConfigCtx): Promise<ApprovalRule> {
  return normalizeRule(await getConfig<unknown>(approvalKey(action), ctx), action);
}

// Whether the action needs authorization (given the cashier lacks the permission/
// cap) and how. amount = the $ involved, or null for actions with no amount.
// threshold ≤ 0 ⇒ always (today's default). 'none' ⇒ never.
export function approvalDecision(rule: ApprovalRule, amount: number | null): { required: boolean; mode: ApprovalMode } {
  const required = rule.mode !== "none" && (rule.threshold <= 0 || amount == null || amount > rule.threshold);
  return { required, mode: rule.mode };
}

// Convenience for a server action: resolve the rule for the active business and
// decide. roleId is optional (business/location-scoped resolution for now).
export async function requiresApproval(action: ApprovalAction, amount: number | null, opts?: { roleId?: string | null }): Promise<{ required: boolean; mode: ApprovalMode }> {
  const { business } = await requireBusiness();
  const ctx = await configContext(business as never, { roleId: opts?.roleId ?? null });
  const rule = await resolveApprovalRule(action, ctx);
  return approvalDecision(rule, amount);
}
