import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// /app/debug/* are Surge-internal payment-rail sandboxes (Finix onboarding,
// tokenized charges, Square, reconciliation). No merchant should ever reach
// them, and nothing here belongs in a production build.
//
// Gate, in order — any failure 404s, so the routes don't advertise that they
// exist:
//   1. Never in production. These are dev/staging tools, full stop.
//   2. The caller must be a row in platform_admins (the same table /hq uses,
//      read through the service-role client so tenant RLS can't be used to
//      fake membership).
//   3. SURGE_ADMIN_EMAILS stays as a local-dev escape hatch for a machine with
//      no platform_admins row — it can only ever widen access outside prod.
function devAllowlist(): string[] {
  return (process.env.SURGE_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default async function DebugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  let userId: string | null = null;
  let email = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
    email = (data.user?.email ?? "").toLowerCase();
  } catch {
    userId = null;
  }
  if (!userId) notFound();

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

  if (!isPlatformAdmin && !(email && devAllowlist().includes(email))) {
    notFound();
  }

  return <>{children}</>;
}
