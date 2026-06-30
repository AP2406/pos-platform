"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";
import { isFinixConfigured, finix } from "@/lib/services/finix";
import { createMerchantIdentity, createMerchantBankAccount, provisionMerchant, getMerchant } from "@/lib/services/finix-onboarding";
import type { FinixBusinessType } from "@/lib/services/finix-onboarding";
import { BUSINESS_MODES } from "@/lib/modules/modes";

export type ProvisionKyc = {
  businessName: string;
  businessType: FinixBusinessType;
  businessTaxId: string;
  mcc: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerDob: string; // YYYY-MM-DD
  ownerTaxId: string;
};
export type ProvisionBank = { accountNumber: string; transitNumber: string; institutionNumber: string };

type Ok = { ok: true; businessId: string; ownerEmail: string; recoveryLink: string | null; finixMerchantId: string; finixState: string };
type Err = { error: string };

function pickMode(industry: string | null) {
  const byKey: Record<string, string> = { restaurant: "full_service", retail: "retail", service: "services" };
  const key = byKey[industry ?? ""] ?? "standard";
  return BUSINESS_MODES.find((m) => m.key === key && m.status === "live")
    ?? BUSINESS_MODES.find((m) => m.status === "live")!;
}

function dob(s: string): { day: number; month: number; year: number } | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return undefined;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

// Approve & provision: create the Finix sub-merchant, then the POS tenant, then mark
// the application live. Idempotent — re-runs skip already-created Finix/tenant pieces
// (keyed on stored ids), so a partial failure resumes without double-provisioning.
export async function provisionApplication(id: string, kyc: ProvisionKyc, bank: ProvisionBank): Promise<Ok | Err> {
  const { admin, db } = await requirePlatformAdmin();
  if (admin.role !== "owner" && admin.role !== "ops") return { error: "Your platform role can't provision." };
  if (!isFinixConfigured()) return { error: "Finix isn't configured on the server." };
  if (!id) return { error: "Missing application." };

  const { data: appRow } = await db.from("merchant_applications").select("*").eq("id", id).maybeSingle();
  const app = appRow as Record<string, unknown> | null;
  if (!app) return { error: "Application not found." };
  if (app.status === "live" && app.provisioned_business_id) {
    return { error: "Already provisioned." };
  }
  if (app.status !== "approved" && app.status !== "provisioned") {
    return { error: "Approve the application before provisioning." };
  }

  const contactEmail = (app.contact_email as string) || "";
  const contactPhone = (app.contact_phone as string) || "0000000000";
  const address = { line1: kyc.line1, city: kyc.city, region: kyc.region, postal_code: kyc.postalCode, country: "CAN" };

  // ---- 1. Finix sub-merchant (skip if already created) ----
  let finixIdentityId = (app.finix_identity_id as string | null) ?? null;
  let finixMerchantId = (app.finix_merchant_id as string | null) ?? null;
  let finixState = "PROVISIONING";

  if (!finixMerchantId) {
    const idRes = await createMerchantIdentity({
      businessName: kyc.businessName,
      businessType: kyc.businessType,
      businessPhone: contactPhone,
      businessTaxId: kyc.businessTaxId || undefined,
      businessAddress: address,
      businessDescription: (app.industry as string) || "Merchant",
      mcc: kyc.mcc || "5812",
      maxTransactionAmountCents: 1_000_000, // app ceiling ($10,000)
      ownerFirstName: kyc.ownerFirstName,
      ownerLastName: kyc.ownerLastName,
      ownerEmail: contactEmail,
      ownerPhone: contactPhone,
      ownerDob: dob(kyc.ownerDob),
      ownerTaxId: kyc.ownerTaxId || undefined,
      ownerPersonalAddress: address,
      principalPercentageOwnership: 100,
      defaultStatementDescriptor: kyc.businessName.slice(0, 20),
    });
    if ("error" in idRes) return { error: "Finix identity failed: " + idRes.error };
    finixIdentityId = idRes.data.id;

    const bankRes = await createMerchantBankAccount(finixIdentityId, {
      name: kyc.businessName, accountNumber: bank.accountNumber, accountType: "BUSINESS_CHECKING",
      institutionNumber: bank.institutionNumber, transitNumber: bank.transitNumber, country: "CAN", currency: "CAD",
    });
    if ("error" in bankRes) return { error: "Finix bank account failed: " + bankRes.error };

    const merRes = await provisionMerchant(finixIdentityId, { application_id: id });
    if ("error" in merRes) return { error: "Finix merchant provisioning failed: " + merRes.error };
    finixMerchantId = merRes.data.id;

    // Push DUMMY_V1 sandbox merchant to APPROVED.
    await finix.post("/merchants/" + finixMerchantId + "/verifications", { processor: "DUMMY_V1" });
    const got = await getMerchant(finixMerchantId);
    finixState = ("error" in got ? null : got.data.onboarding_state) || "APPROVED";

    await db.from("merchant_applications").update({
      finix_identity_id: finixIdentityId, finix_merchant_id: finixMerchantId, status: "provisioned", updated_at: new Date().toISOString(),
    }).eq("id", id);
    await auditHq(db, admin, "application_provision_finix", null, { application_id: id, finix_merchant_id: finixMerchantId, state: finixState });
  } else {
    const got = await getMerchant(finixMerchantId);
    finixState = ("error" in got ? null : got.data.onboarding_state) || "APPROVED";
  }

  // ---- 2. POS tenant (skip if already created) ----
  let businessId = (app.provisioned_business_id as string | null) ?? null;
  let recoveryLink: string | null = null;

  if (!businessId) {
    // Owner auth user — create or reuse, then a recovery link to set their password.
    let ownerId: string | null = null;
    const created = await db.auth.admin.createUser({ email: contactEmail, email_confirm: true });
    if (created.data.user) ownerId = created.data.user.id;
    if (!ownerId) {
      const list = await db.auth.admin.listUsers();
      ownerId = list.data.users.find((u) => (u.email || "").toLowerCase() === contactEmail.toLowerCase())?.id ?? null;
    }
    if (!ownerId) return { error: "Could not create the owner account." };
    try {
      const linkRes = await db.auth.admin.generateLink({ type: "recovery", email: contactEmail });
      recoveryLink = linkRes.data.properties?.action_link ?? null;
    } catch { /* link is a convenience */ }

    const mode = pickMode(app.industry as string | null);

    // Attribute to the referring rep (by code) so residuals flow (HQ-4).
    let repId: string | null = null;
    const repCode = (app.referred_by_rep as string | null) ?? null;
    if (repCode) {
      const { data: rep } = await db.from("reps").select("id").eq("code", repCode.toLowerCase()).maybeSingle();
      repId = (rep?.id as string | null) ?? null;
    }

    const { data: org } = await db.from("orgs").insert({ name: kyc.businessName }).select("id").single();
    const orgId = (org?.id as string) ?? null;

    const { data: biz, error: bizErr } = await db.from("businesses").insert({
      name: (app.business_name as string) || kyc.businessName,
      industry: mode.industry,
      owner_id: ownerId,
      org_id: orgId,
      rep_id: repId,
      plan: (app.plan as string | null) ?? null,
      config: { ...mode.config, mode: mode.key },
      finix_identity_id: finixIdentityId,
      finix_merchant_id: finixMerchantId,
      finix_merchant_state: finixState,
      finix_onboarded_at: new Date().toISOString(),
    }).select("id").single();
    if (bizErr || !biz) return { error: "Tenant creation failed: " + (bizErr?.message || "unknown") };
    businessId = biz.id as string;

    const { error: memErr } = await db.from("business_members").insert({ business_id: businessId, user_id: ownerId, role: "owner" });
    if (memErr) return { error: "Owner membership failed: " + memErr.message };

    await db.from("merchant_applications").update({
      provisioned_business_id: businessId, provisioned_org_id: orgId, status: "live", updated_at: new Date().toISOString(),
    }).eq("id", id);
    await auditHq(db, admin, "application_provision_tenant", businessId, { application_id: id, owner_id: ownerId });
  }

  revalidatePath("/hq/onboarding/" + id);
  revalidatePath("/hq/merchants");
  return { ok: true, businessId: businessId!, ownerEmail: contactEmail, recoveryLink, finixMerchantId: finixMerchantId!, finixState };
}
