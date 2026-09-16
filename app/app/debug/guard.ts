import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The same gate layout.tsx applies to the debug PAGES, applied to the ACTIONS.
 *
 * WHY THIS IS NOT REDUNDANT WITH THE LAYOUT. A Next.js server action is a POST
 * to a build-time action id, and that id is embedded in the client bundle of the
 * page that imports it. The bundle still ships in a production build even though
 * the layout calls notFound() before rendering anything — layouts run for page
 * renders, not for action invocations. So the layout protects the screen and
 * protects nothing else: an action id lifted from the production bundle can be
 * POSTed from any /app path, where middleware sees that path rather than
 * /app/debug, and the action would then run with whatever authorization it
 * checks for itself.
 *
 * Which, for these, was nothing. Every action under /app/debug called
 * requireBusiness() — signed in, has a business, not paused — and no role check,
 * and four of them hold createAdminClient(), which is the service-role key and
 * bypasses RLS completely. They move money: chargeTestCard and
 * chargeIntoSubMerchant create Finix transfers and write finix_payments;
 * onboardCurrentBusiness creates a live Finix identity for the caller's business.
 *
 * Every exported action in this folder calls this first. It throws rather than
 * returning an error shape, because a caller who reaches one of these has no
 * legitimate reason to be there and deserves no detail about why it failed.
 */
export async function assertDebugAllowed(): Promise<void> {
  // 1. Never in production. Same first line as the layout, and the one that
  //    matters most: it does not depend on any table or env var being right.
  if (process.env.NODE_ENV === "production") {
    throw new Error("not_found");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;
  const email = (data.user?.email ?? "").toLowerCase();
  if (!userId) throw new Error("not_found");

  // 2. platform_admins, read through the service-role client so tenant RLS
  //    cannot be used to fake membership.
  let isPlatformAdmin = false;
  try {
    const db = createAdminClient();
    const { data: row } = await db
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    isPlatformAdmin = !!row;
  } catch {
    isPlatformAdmin = false;
  }
  if (isPlatformAdmin) return;

  // 3. Local-dev escape hatch for a machine with no platform_admins row. Can
  //    only ever widen access outside production, which step 1 already closed.
  const allow = (process.env.SURGE_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (email && allow.includes(email)) return;

  throw new Error("not_found");
}
