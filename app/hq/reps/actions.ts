"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";

export async function addRep(input: {
  name: string; email: string; code: string; residualPct: string; bounty: string; clawbackMonths: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const { admin, db } = await requirePlatformAdmin();
  if (admin.role !== "owner" && admin.role !== "ops") return { error: "Your platform role can't add reps." };
  const name = (input.name || "").trim();
  const code = (input.code || "").trim().toLowerCase();
  if (!name) return { error: "Name is required." };
  if (!/^[a-z0-9_-]{2,40}$/.test(code)) return { error: "Code: 2–40 chars, letters/numbers/-/_ only." };
  const pct = Number(input.residualPct);
  if (!isFinite(pct) || pct < 0 || pct > 1) return { error: "Residual % as a fraction 0–1 (e.g. 0.30)." };
  const bounty = Number(input.bounty) || 0;
  const clawback = Math.max(0, Math.floor(Number(input.clawbackMonths) || 0));

  const { data, error } = await db.from("reps").insert({
    name, email: (input.email || "").trim() || null, code, residual_pct: pct, bounty, clawback_months: clawback,
  }).select("id").single();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { error: "That code is already taken." };
    console.error("addRep:", error);
    return { error: "Could not add the rep." };
  }
  await auditHq(db, admin, "rep_add", null, { rep_id: data.id, code });
  revalidatePath("/hq/reps");
  return { ok: true, id: data.id as string };
}

export async function recordPayout(repId: string, amount: string, period: string, note: string): Promise<{ ok: true } | { error: string }> {
  const { admin, db } = await requirePlatformAdmin();
  if (admin.role !== "owner" && admin.role !== "ops") return { error: "Your platform role can't record payouts." };
  const amt = Number(amount);
  if (!repId || !isFinite(amt) || amt <= 0) return { error: "Enter a positive payout amount." };

  const { error } = await db.from("rep_payouts").insert({
    rep_id: repId, amount: Math.round(amt * 100) / 100, period: (period || "").trim() || null,
    note: (note || "").trim().slice(0, 500) || null, created_by: admin.userId,
  });
  if (error) { console.error("recordPayout:", error); return { error: "Could not record the payout." }; }
  await auditHq(db, admin, "rep_payout", null, { rep_id: repId, amount: Math.round(amt * 100) / 100 });
  revalidatePath("/hq/reps/" + repId);
  return { ok: true };
}

// Attribute a merchant (tenant) to a rep, or clear it. Used from the merchant detail.
export async function setMerchantRep(businessId: string, repId: string | null): Promise<{ ok: true } | { error: string }> {
  const { admin, db } = await requirePlatformAdmin();
  if (admin.role !== "owner" && admin.role !== "ops") return { error: "Your platform role can't attribute merchants." };
  if (!businessId) return { error: "Missing merchant." };

  const { error } = await db.from("businesses").update({ rep_id: repId }).eq("id", businessId);
  if (error) { console.error("setMerchantRep:", error); return { error: "Could not attribute the merchant." }; }
  await auditHq(db, admin, "tenant_set_rep", businessId, { rep_id: repId });
  revalidatePath("/hq/merchants/" + businessId);
  revalidatePath("/hq/reps");
  return { ok: true };
}
