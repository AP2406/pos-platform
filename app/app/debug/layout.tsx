import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Platform-admin allowlist. Set SURGE_ADMIN_EMAILS in the environment to a
// comma-separated list of the emails allowed to reach /app/debug/*.
// Fail closed: if the list is empty or the user is not on it, the debug
// routes return 404 as if they do not exist.
function adminEmails(): string[] {
  const raw = process.env.SURGE_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export default async function DebugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && user.email ? user.email.toLowerCase() : "";
  const allowed = adminEmails();
  if (!email || !allowed.includes(email)) {
    notFound();
  }
  return <>{children}</>;
}