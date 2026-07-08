// Resolves the current business's card-present terminal context (device +
// merchant) with the same demo/training/approval guards the register uses for
// card payments. Shared by the /api/terminal routes and the finalize action so
// authorization and resolution can't drift between them.

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { isFinixConfigured, resolveMerchantId } from "@/lib/services/finix";
import { resolveDeviceId } from "@/lib/services/finix-terminal";

export type TerminalContext =
  | { ok: true; businessId: string; merchantId: string; deviceId: string }
  | { ok: false; reason: string; message: string };

export async function resolveTerminalContext(): Promise<TerminalContext> {
  const { business } = await requireBusiness();

  if ((business as { is_demo?: boolean }).is_demo) {
    return { ok: false, reason: "demo", message: "Demo businesses can't take terminal payments." };
  }
  if (!isFinixConfigured()) {
    return { ok: false, reason: "not_configured", message: "Card processing isn't configured for this business." };
  }
  if ((business as { training_mode?: boolean }).training_mode === true) {
    return { ok: false, reason: "training", message: "Training mode is on — no real charges." };
  }

  const supabase = await createClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("finix_merchant_id, finix_merchant_state")
    .eq("id", business.id)
    .single();

  // The per-location device column may not exist before migration 0086 is
  // applied; read it separately so a missing column just falls back to env.
  let deviceCol: string | null = null;
  const { data: dev } = await supabase
    .from("businesses")
    .select("finix_device_id")
    .eq("id", business.id)
    .maybeSingle();
  deviceCol = (dev?.finix_device_id as string | null | undefined) ?? null;

  const merchantId = resolveMerchantId((biz?.finix_merchant_id as string | null) ?? null);
  if (!merchantId) {
    return { ok: false, reason: "no_merchant", message: "This business isn't set up to accept card payments yet." };
  }
  if (biz?.finix_merchant_id) {
    const state = (biz.finix_merchant_state as string | null) || "";
    if (state && state.toUpperCase() !== "APPROVED") {
      return { ok: false, reason: "not_approved", message: "This business's card account isn't approved yet." };
    }
  }

  const deviceId = resolveDeviceId(deviceCol);
  if (!deviceId) {
    return { ok: false, reason: "no_device", message: "No card terminal is configured for this location." };
  }

  return { ok: true, businessId: business.id, merchantId, deviceId };
}
