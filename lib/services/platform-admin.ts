import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Is the signed-in user a Surge platform admin — us, not a merchant?
 *
 * Read through the SERVICE-ROLE client on purpose. `platform_admins` is a
 * tenant-agnostic table, and reading it through the caller's own client would
 * put the answer inside the reach of the tenant RLS the caller controls. The
 * whole point of the check is that a merchant cannot influence it.
 *
 * Strictly the table, with no environment-variable escape hatch. There IS one
 * in app/app/debug/guard.ts and it stays local to that file: its safety
 * argument is "this can only widen access outside production, which the
 * NODE_ENV check above already closed", and that argument does not survive
 * being moved somewhere production-effective. A gate on who may create a
 * business is production-effective.
 *
 * Returns false rather than throwing on a failed read. A gate that fails open
 * because the database hiccuped is not a gate.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;
  if (!userId) return false;

  try {
    const db = createAdminClient();
    const { data: row } = await db
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    return !!row;
  } catch {
    return false;
  }
}
