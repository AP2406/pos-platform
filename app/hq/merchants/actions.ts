"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";

// Pause/resume a tenant by flipping the EXISTING access_status (suspended → the
// tenant hits /account-paused via existing logic; active → restored). Platform
// admins only (writes need owner/ops, not readonly/support). Audited.
export async function setTenantAccessStatus(
  businessId: string,
  status: "active" | "suspended"
): Promise<{ ok: true } | { error: string }> {
  const { admin, db } = await requirePlatformAdmin();
  if (admin.role !== "owner" && admin.role !== "ops") return { error: "Your platform role can't change tenant status." };
  if (!businessId) return { error: "Missing merchant." };

  const { error } = await db.from("businesses").update({ access_status: status }).eq("id", businessId);
  if (error) {
    console.error("setTenantAccessStatus:", error);
    return { error: "Could not update the merchant." };
  }
  await auditHq(db, admin, status === "suspended" ? "tenant_pause" : "tenant_resume", businessId, { access_status: status });
  revalidatePath("/hq/merchants/" + businessId);
  revalidatePath("/hq/merchants");
  return { ok: true };
}

export async function setTenantPlan(
  businessId: string,
  plan: string
): Promise<{ ok: true } | { error: string }> {
  const { admin, db } = await requirePlatformAdmin();
  if (admin.role !== "owner" && admin.role !== "ops") return { error: "Your platform role can't change plans." };
  if (!businessId) return { error: "Missing merchant." };
  const clean = (plan || "").trim().slice(0, 40) || null;

  const { error } = await db.from("businesses").update({ plan: clean }).eq("id", businessId);
  if (error) {
    console.error("setTenantPlan:", error);
    return { error: "Could not update the plan." };
  }
  await auditHq(db, admin, "tenant_set_plan", businessId, { plan: clean });
  revalidatePath("/hq/merchants/" + businessId);
  revalidatePath("/hq/merchants");
  return { ok: true };
}
