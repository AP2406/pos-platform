"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";

// HQ-3a manual pipeline transitions. provisioned/live are set only by HQ-3b
// (Approve & provision), not here.
const ALLOWED = ["new", "kyc", "submitted", "approved", "rejected"];

export async function setApplicationStatus(
  id: string,
  status: string,
  note?: string
): Promise<{ ok: true } | { error: string }> {
  const { admin, db } = await requirePlatformAdmin();
  if (admin.role !== "owner" && admin.role !== "ops") return { error: "Your platform role can't change applications." };
  if (!id || !ALLOWED.includes(status)) return { error: "Invalid transition." };

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (note && note.trim()) patch.notes = note.trim().slice(0, 1000);

  const { error } = await db.from("merchant_applications").update(patch).eq("id", id);
  if (error) {
    console.error("setApplicationStatus:", error);
    return { error: "Could not update the application." };
  }
  await auditHq(db, admin, "application_status", null, { application_id: id, status });
  revalidatePath("/hq/onboarding/" + id);
  revalidatePath("/hq/onboarding");
  return { ok: true };
}
