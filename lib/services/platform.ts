import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Surge HQ operator gate. This is the ONLY entry point to cross-tenant data: it
// verifies the caller is a platform admin (via the service-role client, NOT tenant
// RLS) and hands back that service-role handle for HQ reads. Call it at the top of
// every /hq layout, page, AND server action — layouts don't protect actions.
// Fails closed with notFound() (404, never reveals that /hq exists).

export type PlatformRole = "owner" | "ops" | "support" | "readonly";
export type PlatformAdmin = { userId: string; email: string; role: PlatformRole };
type AdminDb = ReturnType<typeof createAdminClient>;

export async function requirePlatformAdmin(): Promise<{ admin: PlatformAdmin; db: AdminDb }> {
  // 1. Who is the authenticated user? (user-scoped client; an invalid/absent
  //    session must not 500 — treat as not-an-admin.)
  let userId: string | null = null;
  let email = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
    email = data.user?.email ?? "";
  } catch {
    userId = null;
  }
  if (!userId) notFound();

  // 2. Is that user a platform admin? Checked via the SERVICE-ROLE client so it
  //    bypasses (deny-all) RLS — and so this path is the only way to read it.
  const db = createAdminClient();
  const { data: row } = await db
    .from("platform_admins")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) notFound();

  return { admin: { userId, email, role: (row.role as PlatformRole) ?? "readonly" }, db };
}

// Append an operator action to the isolated platform audit log. Best-effort: an
// audit failure must never break the HQ action itself.
export async function auditHq(
  db: AdminDb,
  admin: PlatformAdmin,
  action: string,
  targetBusinessId: string | null = null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db.from("platform_audit_events").insert({
      actor_id: admin.userId,
      actor_role: "platform_" + admin.role,
      action,
      target_business_id: targetBusinessId,
      metadata,
    });
  } catch (e) {
    console.error("auditHq:", e);
  }
}
