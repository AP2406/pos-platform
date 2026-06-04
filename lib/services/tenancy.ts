import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ACTIVE_BUSINESS_COOKIE = "surge_active_business";

export type IndustryType =
  | "transportation"
  | "restaurant"
  | "retail"
  | "service"
  | "mobile_seller";

export type MemberRole = "owner" | "manager" | "staff" | "trainee";

export type BusinessContext = {
  role: MemberRole;
  business: {
    id: string;
    name: string;
    industry: IndustryType;
    currency: string;
    default_tax_rate: number;
    timezone: string;
    drivers_enabled: boolean;
  };
};

export type BusinessSummary = {
  id: string;
  name: string;
  industry: IndustryType;
  role: MemberRole;
  mode: string | null;
};

/**
 * Requires the user to be signed in. Redirects to /login if not.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Every business the current user belongs to, oldest first. Used by the
 * workspace switcher.
 */
export async function listBusinesses(): Promise<BusinessSummary[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_members")
    .select("role, business:businesses(id, name, industry, config)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("listBusinesses:", error);
    return [];
  }

  const out: BusinessSummary[] = [];
  for (const row of data) {
    const b = (Array.isArray(row.business) ? row.business[0] : row.business) as
      | { id: string; name: string; industry: string; config?: unknown }
      | null
      | undefined;
    if (!b) continue;

    let mode: string | null = null;
    if (b.config && typeof b.config === "object") {
      const c = b.config as { mode?: unknown };
      if (typeof c.mode === "string") mode = c.mode;
    }

    out.push({
      id: b.id,
      name: b.name,
      industry: b.industry as IndustryType,
      role: row.role as MemberRole,
      mode,
    });
  }
  return out;
}

/**
 * Returns the user's ACTIVE business. If an active-business cookie is set and
 * the user is a member of that business, it wins; otherwise it falls back to
 * the first business they joined (identical to the previous one-business
 * behavior, so nothing changes for existing single-business logins).
 */
export async function getCurrentBusiness(): Promise<BusinessContext | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_members")
    .select("role, business:businesses(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getCurrentBusiness:", error);
    return null;
  }
  if (!data || data.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

  let chosen = data[0];
  if (activeId) {
    const match = data.find((row) => {
      const b = Array.isArray(row.business) ? row.business[0] : row.business;
      return b && b.id === activeId;
    });
    if (match) chosen = match;
  }

  const biz = Array.isArray(chosen.business)
    ? chosen.business[0]
    : chosen.business;
  if (!biz) return null;

  return {
    role: chosen.role as MemberRole,
    business: biz as BusinessContext["business"],
  };
}

/**
 * Same as getCurrentBusiness but redirects to /onboarding if they don't have one.
 */
export async function requireBusiness(): Promise<BusinessContext> {
  const ctx = await getCurrentBusiness();
  if (!ctx) redirect("/onboarding");
  return ctx;
}